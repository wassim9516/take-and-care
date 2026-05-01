// ============================================================
// routes/reservations.js — Gestion des réservations
// ============================================================
// Toutes ces routes nécessitent d'être connecté (authMiddleware)
// ============================================================

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/auth');
const { Reservation, Offre, Pharmacie, Utilisateur } = require('../database/models');
const sequelize      = require('../database/connection');
const { Op }         = require('sequelize');
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

const COMMISSION_TAUX = parseFloat(process.env.COMMISSION_TAUX || '0.10');

// GET /api/reservations/pharmacie/:pharmacieId — Réservations pour le dashboard pharmacien
router.get('/pharmacie/:pharmacieId', authMiddleware, async (req, res) => {
  // Vérifier que le pharmacien connecté est bien propriétaire de cette pharmacie
  if (Number(req.utilisateur.pharmacieId) !== Number(req.params.pharmacieId)) {
    return res.status(403).json({ erreur: 'Accès refusé.' });
  }
  try {
    const reservations = await Reservation.findAll({
      include: [
        {
          model: Offre,
          as: 'offre',
          where: { pharmacieId: req.params.pharmacieId },
          include: [{ model: Pharmacie, as: 'pharmacie' }],
        },
        { model: Utilisateur, as: 'utilisateur', attributes: ['prenom', 'nom', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/reservations
// Crée une réservation pour l'utilisateur connecté
// Body : { offreId }
// -------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
  const { offreId, paymentIntentId } = req.body;
  const utilisateurId = req.utilisateur.id;

  if (!offreId) return res.status(400).json({ erreur: 'offreId est requis.' });

  // Vérification du paiement Stripe si clé configurée
  if (process.env.STRIPE_SECRET_KEY && paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        return res.status(402).json({ erreur: 'Paiement non confirmé.' });
      }
      // Vérifie que le PaymentIntent correspond bien à cet utilisateur et cette offre
      if (intent.metadata?.offreId !== String(offreId) || intent.metadata?.utilisateurId !== String(utilisateurId)) {
        return res.status(403).json({ erreur: 'PaymentIntent invalide.' });
      }
      // Vérifie que le montant payé correspond au prix réel de l'offre
      const offreVerif = await Offre.findByPk(offreId);
      if (offreVerif) {
        const montantAttenduCentimes = Math.round(offreVerif.prixReduit * 100);
        if (intent.amount !== montantAttenduCentimes) {
          return res.status(402).json({ erreur: 'Montant du paiement incorrect.' });
        }
      }
      // Empêche la réutilisation d'un PaymentIntent
      const dejaUtilise = await Reservation.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
      if (dejaUtilise) return res.status(400).json({ erreur: 'Ce paiement a déjà été utilisé.' });
    } catch (err) {
      return res.status(402).json({ erreur: 'Impossible de vérifier le paiement.' });
    }
  } else if (process.env.STRIPE_SECRET_KEY && !paymentIntentId) {
    return res.status(402).json({ erreur: 'Paiement requis pour réserver.' });
  }

  try {
    let reservationResultat;

    await sequelize.transaction(async (t) => {
      const offre = await Offre.findByPk(offreId, { lock: t.LOCK.UPDATE, transaction: t });

      if (!offre) { const e = new Error('Offre introuvable.'); e.status = 404; throw e; }

      if (!offre.actif || offre.quantiteDisponible <= 0) {
        // Stock épuisé après paiement → remboursement automatique
        if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
          stripe.refunds.create({ payment_intent: paymentIntentId }).catch(() => {});
        }
        const e = new Error('Offre épuisée. Remboursement en cours.'); e.status = 400; throw e;
      }

      const pharmacie = await Pharmacie.findByPk(offre.pharmacieId, { transaction: t });
      const numero    = `TCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const commission = paymentIntentId ? parseFloat((offre.prixReduit * COMMISSION_TAUX).toFixed(2)) : null;

      const reservation = await Reservation.create({
        numero, utilisateurId, offreId,
        prixPaye: offre.prixReduit,
        statut:   'confirmee',
        stripePaymentIntentId: paymentIntentId || null,
        commission,
      }, { transaction: t });

      await offre.update({ quantiteDisponible: offre.quantiteDisponible - 1 }, { transaction: t });

      reservationResultat = {
        id: reservation.id, numero: reservation.numero, statut: reservation.statut,
        offre: offre.titre, pharmacie: pharmacie?.nom, adresse: pharmacie?.adresse,
        heureRetrait: offre.heureRetrait, prixPaye: reservation.prixPaye,
      };
    });

    res.status(201).json({ message: 'Réservation confirmée !', reservation: reservationResultat });
  } catch (err) {
    console.error(err);
    if (err.status) return res.status(err.status).json({ erreur: err.message });
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// GET /api/reservations
// Retourne toutes les réservations de l'utilisateur connecté
// -------------------------------------------------------
router.get('/', authMiddleware, async (req, res) => {
  try {
    const reservations = await Reservation.findAll({
      where: { utilisateurId: req.utilisateur.id },
      include: [{
        model: Offre,
        as: 'offre',
        include: [{ model: Pharmacie, as: 'pharmacie' }],
      }],
      order: [['createdAt', 'DESC']], // Les plus récentes en premier
    });

    res.json(reservations);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// PATCH /api/reservations/:id/statut
// Permet au pharmacien de marquer une réservation comme "retiree"
// -------------------------------------------------------
router.patch('/:id/statut', authMiddleware, async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id, {
      include: [{ model: Offre, as: 'offre' }],
    });

    if (!reservation) {
      return res.status(404).json({ erreur: 'Réservation introuvable.' });
    }

    // Vérifie que le pharmacien connecté est bien propriétaire de la pharmacie
    if (Number(reservation.offre.pharmacieId) !== Number(req.utilisateur.pharmacieId)) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    if (reservation.statut !== 'confirmee') {
      return res.status(400).json({ erreur: 'Seules les réservations confirmées peuvent être marquées retirées.' });
    }

    await reservation.update({ statut: 'retiree' });
    res.json({ message: 'Réservation marquée comme retirée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// DELETE /api/reservations/:id
// Annule une réservation (seulement si elle est "confirmee")
// -------------------------------------------------------
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const reservation = await Reservation.findOne({
      where: {
        id: req.params.id,
        utilisateurId: req.utilisateur.id, // Vérifie que c'est bien SA réservation
      },
      include: [{ model: Offre, as: 'offre' }],
    });

    if (!reservation) {
      return res.status(404).json({ erreur: 'Réservation introuvable.' });
    }

    if (reservation.statut !== 'confirmee') {
      return res.status(400).json({ erreur: 'Impossible d\'annuler cette réservation.' });
    }

    // Remet le stock disponible + annulation dans une transaction
    await sequelize.transaction(async (t) => {
      // Re-lit l'offre avec un verrou pour éviter la race condition
      const offre = await Offre.findByPk(reservation.offreId, { lock: t.LOCK.UPDATE, transaction: t });
      await offre.update(
        { quantiteDisponible: offre.quantiteDisponible + 1 },
        { transaction: t }
      );
      await reservation.update({ statut: 'annulee' }, { transaction: t });
    });

    res.json({ message: 'Réservation annulée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/reservations/:id/noter
// L'utilisateur note une réservation retirée (1-5 étoiles)
// Met à jour la note moyenne de la pharmacie
// -------------------------------------------------------
router.post('/:id/noter', authMiddleware, async (req, res) => {
  const { note } = req.body;

  if (!note || note < 1 || note > 5) {
    return res.status(400).json({ erreur: 'La note doit être comprise entre 1 et 5.' });
  }

  try {
    const reservation = await Reservation.findOne({
      where: {
        id:            req.params.id,
        utilisateurId: req.utilisateur.id,
        statut:        'retiree',
      },
      include: [{ model: Offre, as: 'offre' }],
    });

    if (!reservation) {
      return res.status(404).json({ erreur: 'Réservation introuvable ou non éligible à une note.' });
    }

    if (reservation.noteClient !== null) {
      return res.status(400).json({ erreur: 'Tu as déjà noté cette réservation.' });
    }

    // Enregistre la note
    await reservation.update({ noteClient: parseInt(note) });

    // Recalcule la moyenne de la pharmacie
    const pharmacieId = reservation.offre.pharmacieId;
    const stats = await Reservation.findAll({
      where: {
        noteClient: { [Op.not]: null },
      },
      include: [{
        model: Offre,
        as: 'offre',
        where: { pharmacieId },
        required: true,
      }],
      attributes: ['noteClient'],
    });

    if (stats.length > 0) {
      const moyenne = stats.reduce((s, r) => s + r.noteClient, 0) / stats.length;
      await Pharmacie.update(
        { note: Math.round(moyenne * 10) / 10 },
        { where: { id: pharmacieId } }
      );
    }

    res.json({ message: 'Note enregistrée. Merci !', note: parseInt(note) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
