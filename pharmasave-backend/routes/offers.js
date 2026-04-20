// ============================================================
// routes/offers.js — Routes liées aux offres (PostgreSQL)
// ============================================================

const express        = require('express');
const router         = express.Router();
const { Offre, Pharmacie, Utilisateur } = require('../database/models');
const authMiddleware = require('../middleware/auth');
const { envoyerNotifications } = require('../utils/notifications');

// GET /api/offers — Toutes les offres actives (filtrables par catégorie)
router.get('/', async (req, res) => {
  try {
    const where = { actif: true };
    if (req.query.categorie) where.categorie = req.query.categorie;

    const offres = await Offre.findAll({
      where,
      include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom', 'adresse'] }],
      order: [['createdAt', 'DESC']],
    });

    const resultat = offres.map(o => ({
      ...o.toJSON(),
      pharmacieNom: o.pharmacie?.nom,
    }));

    res.json(resultat);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/offers/pharmacie/:pharmacieId — Offres d'une pharmacie (dashboard)
router.get('/pharmacie/:pharmacieId', async (req, res) => {
  try {
    const offres = await Offre.findAll({
      where: { pharmacieId: req.params.pharmacieId },
      include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom', 'adresse'] }],
      order: [['createdAt', 'DESC']],
    });
    const resultat = offres.map(o => ({
      ...o.toJSON(),
      pharmacieNom: o.pharmacie?.nom,
    }));
    res.json(resultat);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/offers/:id — Détail d'une offre
router.get('/:id', async (req, res) => {
  try {
    const offre = await Offre.findByPk(req.params.id, {
      include: [{ model: Pharmacie, as: 'pharmacie' }],
    });

    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });
    res.json({ ...offre.toJSON(), pharmacieNom: offre.pharmacie?.nom });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// POST /api/offers — Créer une offre (pharmacien connecté)
router.post('/', authMiddleware, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;
  if (!pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  try {
    const pharmacie = await Pharmacie.findByPk(pharmacieId);
    const offre = await Offre.create({ ...req.body, pharmacieId });

    // Notifie tous les utilisateurs ayant un push token
    const utilisateurs = await Utilisateur.findAll({
      where: { pharmacieId: null },
      attributes: ['pushToken'],
    });
    const tokens = utilisateurs.map(u => u.pushToken).filter(Boolean);
    envoyerNotifications(
      tokens,
      '🛍️ Nouvelle offre disponible !',
      `${pharmacie?.nom} propose "${offre.titre}" à ${offre.prixReduit}€`,
      { offreId: offre.id }
    );

    res.status(201).json(offre);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// PUT /api/offers/:id — Modifier une offre
router.put('/:id', authMiddleware, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;
  if (!pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  try {
    const offre = await Offre.findByPk(req.params.id);
    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });

    if (offre.pharmacieId !== pharmacieId) {
      return res.status(403).json({ erreur: 'Action non autorisée.' });
    }

    await offre.update(req.body);
    res.json(offre);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// DELETE /api/offers/:id — Supprimer une offre
router.delete('/:id', authMiddleware, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;
  if (!pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  try {
    const offre = await Offre.findByPk(req.params.id);
    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });

    if (offre.pharmacieId !== pharmacieId) {
      return res.status(403).json({ erreur: 'Action non autorisée.' });
    }

    await offre.destroy();
    res.json({ message: 'Offre supprimée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
