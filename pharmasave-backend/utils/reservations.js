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
const { Op }    = require('sequelize');
const sequelize = require('../database/connection');
const { Reservation, Offre, Pharmacie, Utilisateur } = require('../database/models');
const { stripe } = require('./stripe');
const { envoyerNotifications } = require('./notifications');

const COMMISSION_TAUX = parseFloat(process.env.COMMISSION_TAUX || '0.10');

// Délai pour retirer un panier. Passé ce délai, la réservation expire,
// le panier est remis en vente et un panier payé n'est pas remboursé
// (règle annoncée au client au moment de réserver et dans les CGU).
const DUREE_RESERVATION_HEURES = parseInt(process.env.RESERVATION_DUREE_HEURES || '48', 10);

// Date du jour au format AAAA-MM-JJ (fuseau du serveur)
function aujourdhuiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Une offre peut-elle être réservée ? (indépendamment du stock)
function offrePerimee(offre) {
  return !!offre.datePeremption && offre.datePeremption < aujourdhuiISO();
}

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
    expireLe: reservation.expireLe,
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

      if (!offre.actif || offre.quantiteDisponible <= 0 || !pharmacie?.valide || offrePerimee(offre)) {
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
        expireLe: new Date(Date.now() + DUREE_RESERVATION_HEURES * 3600 * 1000),
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

// Envoie un rappel aux clients dont la réservation expire bientôt
const RAPPEL_AVANT_HEURES = parseInt(process.env.RAPPEL_RETRAIT_HEURES || '6', 10);

async function envoyerRappels() {
  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() + RAPPEL_AVANT_HEURES * 3600 * 1000);
  const aRappeler = await Reservation.findAll({
    where: {
      statut: 'confirmee',
      rappelEnvoye: false,
      expireLe: { [Op.between]: [maintenant, limite] },
    },
    include: [
      { model: Utilisateur, as: 'utilisateur', attributes: ['pushToken'] },
      { model: Offre, as: 'offre', attributes: ['titre'], include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom'] }] },
    ],
  });

  for (const reservation of aRappeler) {
    // Marqué d'abord : un rappel ne part jamais deux fois
    const [nb] = await Reservation.update(
      { rappelEnvoye: true },
      { where: { id: reservation.id, rappelEnvoye: false } }
    );
    if (!nb || !reservation.utilisateur?.pushToken) continue;
    const heure = reservation.expireLe.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit',
    });
    envoyerNotifications(
      [reservation.utilisateur.pushToken],
      '⏰ Pense à retirer ton panier',
      `« ${reservation.offre?.titre || 'Ton panier'} » t'attend chez ${reservation.offre?.pharmacie?.nom || 'la pharmacie'} jusqu'à ${heure}.`,
      { reservationId: reservation.id }
    );
  }
}

// Passe en « expiree » les réservations non retirées à temps et remet
// les paniers en vente. Lancé périodiquement par server.js.
async function expirerReservations() {
  const aExpirer = await Reservation.findAll({
    where: { statut: 'confirmee', expireLe: { [Op.lt]: new Date() } },
    attributes: ['id'],
  });

  for (const { id } of aExpirer) {
    let notification = null;
    await sequelize.transaction(async (t) => {
      const reservation = await Reservation.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
      if (!reservation || reservation.statut !== 'confirmee') return;

      const offre = await Offre.findByPk(reservation.offreId, { lock: t.LOCK.UPDATE, transaction: t });
      if (offre) {
        await offre.update({ quantiteDisponible: offre.quantiteDisponible + 1 }, { transaction: t });
      }
      await reservation.update({ statut: 'expiree' }, { transaction: t });

      const client = await Utilisateur.findByPk(reservation.utilisateurId, { attributes: ['pushToken'], transaction: t });
      if (client?.pushToken) {
        notification = {
          token: client.pushToken,
          corps: `Ta réservation ${reservation.numero}${offre ? ` (« ${offre.titre} »)` : ''} n'a pas été retirée à temps et a expiré.`,
        };
      }
    });
    if (notification) {
      envoyerNotifications([notification.token], 'Réservation expirée', notification.corps);
    }
  }

  if (aExpirer.length) console.log(`⏰ ${aExpirer.length} réservation(s) expirée(s)`);
}

// Tâche périodique lancée par server.js
async function traiterReservationsEnCours() {
  await envoyerRappels();
  await expirerReservations();
}

module.exports = {
  creerReservation, annulerReservation, expirerReservations, envoyerRappels, traiterReservationsEnCours,
  offrePerimee, aujourdhuiISO,
  DUREE_RESERVATION_HEURES,
};
