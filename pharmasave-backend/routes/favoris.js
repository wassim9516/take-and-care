// ============================================================
// routes/favoris.js — Gestion des favoris
// ============================================================

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/auth');
const { Favori, Offre, Pharmacie } = require('../database/models');

// GET /api/favoris — Mes offres favorites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const favoris = await Favori.findAll({
      where: { utilisateurId: req.utilisateur.id },
      include: [{
        model: Offre,
        as: 'offre',
        where: { actif: true },
        required: true,
        include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom'] }],
      }],
      order: [['createdAt', 'DESC']],
    });

    const resultat = favoris.map(f => ({
      ...f.offre.toJSON(),
      pharmacieNom: f.offre.pharmacie?.nom,
    }));

    res.json(resultat);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/favoris/ids — Juste les IDs des offres favorites (pour l'UI)
router.get('/ids', authMiddleware, async (req, res) => {
  try {
    const favoris = await Favori.findAll({
      where: { utilisateurId: req.utilisateur.id },
      attributes: ['offreId'],
    });
    res.json(favoris.map(f => f.offreId));
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// POST /api/favoris — Ajouter un favori
router.post('/', authMiddleware, async (req, res) => {
  const { offreId } = req.body;
  if (!offreId) return res.status(400).json({ erreur: 'offreId requis.' });

  try {
    const [favori, cree] = await Favori.findOrCreate({
      where: { utilisateurId: req.utilisateur.id, offreId },
    });
    res.status(cree ? 201 : 200).json(favori);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// DELETE /api/favoris/:offreId — Retirer un favori
router.delete('/:offreId', authMiddleware, async (req, res) => {
  try {
    await Favori.destroy({
      where: { utilisateurId: req.utilisateur.id, offreId: req.params.offreId },
    });
    res.json({ message: 'Favori retiré.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
