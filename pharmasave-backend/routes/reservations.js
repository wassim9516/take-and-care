// ============================================================
// routes/reservations.js — Gestion des réservations
// ============================================================
// Toutes ces routes nécessitent d'être connecté (authMiddleware)
// ============================================================

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/auth');
const { Reservation, Offre, Pharmacie, Utilisateur } = require('../database/models');
const { Op }         = require('sequelize');
const { stripe }     = require('../utils/stripe');
const { creerReservation, annulerReservation } = require('../utils/reservations');

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
          where: { pharmacieId: req.utilisateur.pharmacieId },
          include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['id', 'nom', 'adresse'] }],
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
// Body : { offreId, paymentIntentId? }
// Si Stripe est configuré, le paiement est obligatoire et vérifié ici.
// -------------------------------------------------------
router.post('/', authMiddleware, async (req, res) => {
  const { paymentIntentId } = req.body;
  const offreId       = parseInt(req.body.offreId);
  const utilisateurId = req.utilisateur.id;

  if (!offreId) return res.status(400).json({ erreur: 'offreId est requis.' });

  let paiement = null;
  if (stripe) {
    if (typeof paymentIntentId !== 'string' || !paymentIntentId) {
      return res.status(402).json({ erreur: 'Paiement requis pour réserver.' });
    }
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        return res.status(402).json({ erreur: 'Paiement non confirmé.' });
      }
      // Les metadata sont fixées par le serveur à la création de l'intent
      if (intent.metadata?.offreId !== String(offreId) || intent.metadata?.utilisateurId !== String(utilisateurId)) {
        return res.status(403).json({ erreur: 'PaymentIntent invalide.' });
      }
      paiement = { id: intent.id, montantCentimes: intent.amount };
    } catch (err) {
      return res.status(402).json({ erreur: 'Impossible de vérifier le paiement.' });
    }
  }

  try {
    const reservation = await creerReservation({ utilisateurId, offreId, paiement });
    res.status(201).json({ message: 'Réservation confirmée !', reservation });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erreur: err.message });
    console.error(err);
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
        include: [{ model: Pharmacie, as: 'pharmacie', attributes: { exclude: ['stripeAccountId', 'valide'] } }],
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
    const reservation = await Reservation.findByPk(parseInt(req.params.id) || 0, {
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
    const { rembourse } = await annulerReservation({
      reservationId: parseInt(req.params.id) || 0,
      utilisateurId: req.utilisateur.id, // Vérifie que c'est bien SA réservation
    });
    res.json({
      message: rembourse
        ? 'Réservation annulée. Le remboursement arrive sous 5 à 10 jours.'
        : 'Réservation annulée.',
      rembourse,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erreur: err.message });
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/reservations/:id/noter
// L'utilisateur note une réservation retirée (1-5 étoiles)
// Met à jour la note moyenne de la pharmacie
// -------------------------------------------------------
router.post('/:id/noter', authMiddleware, async (req, res) => {
  const note = Number(req.body.note);

  if (!Number.isInteger(note) || note < 1 || note > 5) {
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
    await reservation.update({ noteClient: note });

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

    res.json({ message: 'Note enregistrée. Merci !', note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
