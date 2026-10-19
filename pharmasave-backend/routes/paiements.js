// ============================================================
// routes/paiements.js — Paiements Stripe + Connect
// ============================================================

const express        = require('express');
const router         = express.Router();
const { stripe }     = require('../utils/stripe');
const authMiddleware = require('../middleware/auth');
const { pharmacienValide } = authMiddleware;
const { Offre, Pharmacie } = require('../database/models');
const { creerReservation } = require('../utils/reservations');

const COMMISSION_TAUX = parseFloat(process.env.COMMISSION_TAUX || '0.10');

// -------------------------------------------------------
// POST /api/paiements/intent
// Crée un PaymentIntent Stripe pour une offre
// Body : { offreId }
// -------------------------------------------------------
router.post('/intent', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(503).json({ erreur: 'Paiements non configurés sur ce serveur.' });
  const offreId = parseInt(req.body.offreId);
  if (!offreId) return res.status(400).json({ erreur: 'offreId requis.' });

  try {
    const offre = await Offre.findByPk(offreId, {
      include: [{ model: Pharmacie, as: 'pharmacie' }],
    });

    if (!offre || !offre.pharmacie?.valide) return res.status(404).json({ erreur: 'Offre introuvable.' });
    if (!offre.actif || offre.quantiteDisponible <= 0) {
      return res.status(400).json({ erreur: 'Cette offre n\'est plus disponible.' });
    }

    const montantCentimes    = Math.round(offre.prixReduit * 100);
    const commissionCentimes = Math.round(montantCentimes * COMMISSION_TAUX);

    const params = {
      amount:   montantCentimes,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        offreId:       String(offreId),
        utilisateurId: String(req.utilisateur.id),
      },
    };

    // Split automatique si la pharmacie a un compte Stripe Connect
    if (offre.pharmacie?.stripeAccountId) {
      params.application_fee_amount = commissionCentimes;
      params.transfer_data = { destination: offre.pharmacie.stripeAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    res.json({
      clientSecret:  paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      montant:       offre.prixReduit,
      commission:    parseFloat((commissionCentimes / 100).toFixed(2)),
      commissionTaux: Math.round(COMMISSION_TAUX * 100),
    });
  } catch (err) {
    console.error('Stripe intent error:', err.message);
    res.status(500).json({ erreur: 'Erreur lors de la création du paiement.' });
  }
});

// -------------------------------------------------------
// POST /api/paiements/onboarding
// Génère un lien Stripe Connect Express pour la pharmacie
// -------------------------------------------------------
router.post('/onboarding', authMiddleware, pharmacienValide, async (req, res) => {
  if (!stripe) return res.status(503).json({ erreur: 'Paiements non configurés sur ce serveur.' });
  const pharmacieId = req.utilisateur.pharmacieId;

  try {
    const pharmacie = await Pharmacie.findByPk(pharmacieId);

    let stripeAccountId = pharmacie.stripeAccountId;
    if (!stripeAccountId) {
      const compte = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
      });
      stripeAccountId = compte.id;
      await pharmacie.update({ stripeAccountId });
    }

    const frontendUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL;
    const lien = await stripe.accountLinks.create({
      account:     stripeAccountId,
      refresh_url: `${frontendUrl}/dashboard`,
      return_url:  `${frontendUrl}/dashboard`,
      type:        'account_onboarding',
    });

    res.json({ url: lien.url });
  } catch (err) {
    console.error('Stripe onboarding error:', err.message);
    res.status(500).json({ erreur: 'Erreur Stripe Connect.' });
  }
});

// -------------------------------------------------------
// GET /api/paiements/compte
// Retourne le statut du compte Stripe Connect de la pharmacie
// -------------------------------------------------------
router.get('/compte', authMiddleware, async (req, res) => {
  if (!stripe) return res.json({ connecte: false });
  const pharmacieId = req.utilisateur.pharmacieId;
  if (!pharmacieId) return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });

  try {
    const pharmacie = await Pharmacie.findByPk(pharmacieId);

    if (!pharmacie.stripeAccountId) {
      return res.json({ connecte: false });
    }

    const compte = await stripe.accounts.retrieve(pharmacie.stripeAccountId);
    res.json({
      connecte:        compte.charges_enabled && compte.payouts_enabled,
      chargesActives:  compte.charges_enabled,
      virementsActifs: compte.payouts_enabled,
      stripeAccountId: pharmacie.stripeAccountId,
    });
  } catch (err) {
    console.error('Stripe account error:', err.message);
    res.status(500).json({ erreur: 'Erreur Stripe.' });
  }
});

// -------------------------------------------------------
// POST /api/paiements/webhook  (monté dans server.js AVANT express.json :
// Stripe signe le corps brut de la requête)
// Filet de sécurité : si l'app plante entre le paiement et l'appel
// POST /api/reservations, la réservation est créée ici. Sans risque de
// doublon : la création est idempotente par PaymentIntent.
// Stripe Dashboard → Webhooks → endpoint <BACKEND_URL>/api/paiements/webhook,
// événement payment_intent.succeeded, secret dans STRIPE_WEBHOOK_SECRET.
// -------------------------------------------------------
async function webhookStripe(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ erreur: 'Webhook non configuré.' });
  }

  let evenement;
  try {
    evenement = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ erreur: 'Signature invalide.' });
  }

  if (evenement.type === 'payment_intent.succeeded') {
    const intent = evenement.data.object;
    const offreId       = parseInt(intent.metadata?.offreId);
    const utilisateurId = parseInt(intent.metadata?.utilisateurId);
    if (offreId && utilisateurId) {
      try {
        await creerReservation({
          utilisateurId, offreId,
          paiement: { id: intent.id, montantCentimes: intent.amount },
        });
      } catch (err) {
        // Offre épuisée → déjà remboursée par creerReservation. Autre erreur
        // → 500 pour que Stripe renvoie l'événement plus tard.
        if (!err.status) {
          console.error('Webhook Stripe :', err.message);
          return res.status(500).json({ erreur: 'Erreur serveur.' });
        }
      }
    }
  }

  res.json({ recu: true });
}

module.exports = router;
module.exports.webhookStripe = webhookStripe;
