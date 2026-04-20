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

// GET /api/reservations/pharmacie/:pharmacieId — Réservations pour le dashboard pharmacien
router.get('/pharmacie/:pharmacieId', authMiddleware, async (req, res) => {
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
  const { offreId } = req.body;
  const utilisateurId = req.utilisateur.id; // Récupéré depuis le token JWT

  if (!offreId) {
    return res.status(400).json({ erreur: 'offreId est requis.' });
  }

  try {
    let reservationResultat;

    await sequelize.transaction(async (t) => {
      // Verrouille la ligne de l'offre pendant la transaction pour éviter la race condition
      const offre = await Offre.findByPk(offreId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!offre) {
        const err = new Error('Offre introuvable.');
        err.status = 404;
        throw err;
      }

      if (!offre.actif || offre.quantiteDisponible <= 0) {
        const err = new Error('Cette offre n\'est plus disponible.');
        err.status = 400;
        throw err;
      }

      // Charge la pharmacie séparément (le lock + include cause une erreur PostgreSQL)
      const pharmacie = await Pharmacie.findByPk(offre.pharmacieId, { transaction: t });

      // Génère un numéro de réservation unique
      const numero = `TCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Crée la réservation et décrémente le stock dans la même transaction
      const reservation = await Reservation.create({
        numero,
        utilisateurId,
        offreId,
        prixPaye: offre.prixReduit,
        statut: 'confirmee',
      }, { transaction: t });

      await offre.update(
        { quantiteDisponible: offre.quantiteDisponible - 1 },
        { transaction: t }
      );

      reservationResultat = {
        id:           reservation.id,
        numero:       reservation.numero,
        statut:       reservation.statut,
        offre:        offre.titre,
        pharmacie:    pharmacie?.nom,
        adresse:      pharmacie?.adresse,
        heureRetrait: offre.heureRetrait,
        prixPaye:     reservation.prixPaye,
      };
    });

    res.status(201).json({ message: 'Réservation confirmée !', reservation: reservationResultat });
  } catch (err) {
    console.error(err);
    if (err.status) {
      return res.status(err.status).json({ erreur: err.message });
    }
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
    if (reservation.offre.pharmacieId !== req.utilisateur.pharmacieId) {
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
      await reservation.offre.update(
        { quantiteDisponible: reservation.offre.quantiteDisponible + 1 },
        { transaction: t }
      );
      await reservation.update({ statut: 'annulee' }, { transaction: t });
    });

    res.json({ message: 'Réservation annulée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
