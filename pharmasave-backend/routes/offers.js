// ============================================================
// routes/offers.js — Routes liées aux offres (PostgreSQL)
// ============================================================

const express        = require('express');
const router         = express.Router();
const { Op }         = require('sequelize');
const fs             = require('fs');
const path           = require('path');
const { Offre, Pharmacie, Utilisateur } = require('../database/models');
const authMiddleware = require('../middleware/auth');
const { envoyerNotifications } = require('../utils/notifications');

function supprimerFichierImage(imageUrl) {
  if (!imageUrl) return;
  const nomFichier = path.basename(imageUrl);
  if (!nomFichier.startsWith('offre-')) return;
  const cheminFichier = path.join(__dirname, '..', 'uploads', nomFichier);
  fs.unlink(cheminFichier, () => {});
}

// GET /api/offers — Offres actives, paginées
router.get('/', async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limite) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const where = {
      actif: true,
      [Op.or]: [
        { datePeremption: null },
        { datePeremption: { [Op.gte]: aujourdhui } },
      ],
    };
    if (req.query.categorie) where.categorie = req.query.categorie;

    const { count, rows } = await Offre.findAndCountAll({
      where,
      include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom', 'adresse', 'latitude', 'longitude'] }],
      order: [['createdAt', 'DESC']],
      limit:  limite,
      offset,
    });

    const offres = rows.map(o => ({
      ...o.toJSON(),
      pharmacieNom: o.pharmacie?.nom,
      pharmacieLat: o.pharmacie?.latitude,
      pharmacieLng: o.pharmacie?.longitude,
    }));

    res.json({ offres, total: count, hasMore: offset + limite < count });
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

    if (Number(offre.pharmacieId) !== Number(pharmacieId)) {
      return res.status(403).json({ erreur: 'Action non autorisée.' });
    }

    const ancienneImage = offre.image;
    await offre.update(req.body);
    if (req.body.image && ancienneImage && req.body.image !== ancienneImage) {
      supprimerFichierImage(ancienneImage);
    }
    res.json(offre);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// DELETE /api/offers/:id — Supprimer une offre + son image
router.delete('/:id', authMiddleware, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;
  if (!pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  try {
    const offre = await Offre.findByPk(req.params.id);
    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });

    if (Number(offre.pharmacieId) !== Number(pharmacieId)) {
      return res.status(403).json({ erreur: 'Action non autorisée.' });
    }

    const imageUrl = offre.image;
    await offre.destroy();
    supprimerFichierImage(imageUrl);
    res.json({ message: 'Offre supprimée.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
