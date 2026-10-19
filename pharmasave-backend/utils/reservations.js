// ============================================================
// utils/reservations.js — Création / annulation de réservations
// ============================================================
// Partagé entre la route POST /api/reservations (appelée par l'app
// après paiement) et le webhook Stripe (filet de sécurité si l'app
// plante entre le paiement et la réservation). La création est
// idempotente par PaymentIntent : appeler deux fois ne crée qu'une
// réservation.
// ============================================================

const crypto    = require('crypto');
const sequelize = require('../database/connection');
const { Reservation, Offre, Pharmacie } = require('../database/models');
const { stripe } = require('./stripe');

const COMMISSION_TAUX = parseFloat(process.env.COMMISSION_TAUX || '0.10');

// Limites anti-abus quand les réservations sont gratuites (Stripe désactivé)
const MAX_RESA_ACTIVES_GRATUITES = 5;

function erreurHttp(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function genererNumero() {
  return `TCP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function rembourser(paymentIntentId, cleIdempotence) {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const params = { payment_intent: paymentIntentId };
  // Paiement reversé à une pharmacie (Stripe Connect) : on récupère aussi
  // le virement et la commission
  if (intent.transfer_data?.destination) {
    params.reverse_transfer       = true;
    params.refund_application_fee = true;
  }
  return stripe.refunds.create(params, { idempotencyKey: cleIdempotence });
}

function resume(reservation, offre, pharmacie) {
  return {
    id: reservation.id, numero: reservation.numero, statut: reservation.statut,
    offre: offre.titre, pharmacie: pharmacie?.nom, adresse: pharmacie?.adresse,
    heureRetrait: offre.heureRetrait, prixPaye: reservation.prixPaye,
  };
}

// paiement = { id, montantCentimes } ou null (mode gratuit, Stripe désactivé)
async function creerReservation({ utilisateurId, offreId, paiement }) {
  let resultat;
  let aRembourser = false;

  try {
    await sequelize.transaction(async (t) => {
      // Le verrou sur l'offre sérialise les créations concurrentes
      const offre = await Offre.findByPk(offreId, { lock: t.LOCK.UPDATE, transaction: t });
      if (!offre) throw erreurHttp(404, 'Offre introuvable.');

      const pharmacie = await Pharmacie.findByPk(offre.pharmacieId, { transaction: t });

      if (paiement) {
        // Déjà créée (par l'app ou par le webhook) → on renvoie l'existante
        const existante = await Reservation.findOne({
          where: { stripePaymentIntentId: paiement.id }, transaction: t,
        });
        if (existante) {
          resultat = resume(existante, offre, pharmacie);
          return;
        }
      } else {
        const actives = await Reservation.count({
          where: { utilisateurId, statut: 'confirmee' }, transaction: t,
        });
        if (actives >= MAX_RESA_ACTIVES_GRATUITES) {
          throw erreurHttp(429, `Tu as déjà ${MAX_RESA_ACTIVES_GRATUITES} réservations en cours. Retire-les avant d'en faire d'autres.`);
        }
        const memeOffre = await Reservation.count({
          where: { utilisateurId, offreId, statut: 'confirmee' }, transaction: t,
        });
        if (memeOffre > 0) {
          throw erreurHttp(409, 'Tu as déjà une réservation en cours pour cette offre.');
        }
      }

      if (!offre.actif || offre.quantiteDisponible <= 0 || !pharmacie?.valide) {
        if (paiement) aRembourser = true;
        throw erreurHttp(400, paiement
          ? 'Offre épuisée. Ton paiement va être remboursé.'
          : 'Offre épuisée.');
      }

      // Prix payé = montant réellement encaissé (fixé côté serveur à la
      // création du PaymentIntent), même si le pharmacien a changé le prix depuis
      const prixPaye   = paiement ? paiement.montantCentimes / 100 : offre.prixReduit;
      const commission = paiement ? parseFloat((prixPaye * COMMISSION_TAUX).toFixed(2)) : null;

      const reservation = await Reservation.create({
        numero: genererNumero(), utilisateurId, offreId,
        prixPaye,
        statut:   'confirmee',
        stripePaymentIntentId: paiement?.id || null,
        commission,
      }, { transaction: t });

      await offre.update({ quantiteDisponible: offre.quantiteDisponible - 1 }, { transaction: t });

      resultat = resume(reservation, offre, pharmacie);
    });
  } finally {
    if (aRembourser) {
      await rembourser(paiement.id, `epuise-${paiement.id}`).catch(err =>
        console.error(`❌ Remboursement impossible pour ${paiement.id} :`, err.message));
    }
  }

  return resultat;
}

// Annule une réservation confirmée du client et rembourse s'il a payé.
// Le remboursement est fait avant de valider l'annulation : s'il échoue,
// la réservation reste confirmée.
async function annulerReservation({ reservationId, utilisateurId }) {
  let rembourse = false;

  await sequelize.transaction(async (t) => {
    const reservation = await Reservation.findOne({
      where: { id: reservationId, utilisateurId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!reservation) throw erreurHttp(404, 'Réservation introuvable.');
    if (reservation.statut !== 'confirmee') throw erreurHttp(400, 'Impossible d\'annuler cette réservation.');

    const offre = await Offre.findByPk(reservation.offreId, { lock: t.LOCK.UPDATE, transaction: t });

    if (reservation.stripePaymentIntentId) {
      if (!stripe) throw erreurHttp(503, 'Remboursement impossible : paiements non configurés.');
      try {
        await rembourser(reservation.stripePaymentIntentId, `annulation-${reservation.id}`);
        rembourse = true;
      } catch (err) {
        console.error(`❌ Remboursement échoué (réservation ${reservation.id}) :`, err.message);
        throw erreurHttp(502, 'Le remboursement a échoué. Réessaie plus tard.');
      }
    }

    if (offre) {
      await offre.update({ quantiteDisponible: offre.quantiteDisponible + 1 }, { transaction: t });
    }
    await reservation.update({ statut: 'annulee' }, { transaction: t });
  });

  return { rembourse };
}

module.exports = { creerReservation, annulerReservation };
