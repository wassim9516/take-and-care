// ============================================================
// routes/favoris.js — Gestion des favoris
// ============================================================

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/auth');
const { Favori, Offre, Pharmacie } = require('../database/models');

function idValide(valeur) {
  const id = Number(valeur);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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
        include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom', 'latitude', 'longitude'] }],
      }],
      order: [['createdAt', 'DESC']],
    });

    const resultat = favoris.map(f => ({
      ...f.offre.toJSON(),
      pharmacieNom: f.offre.pharmacie?.nom,
      pharmacieLat: f.offre.pharmacie?.latitude,
      pharmacieLng: f.offre.pharmacie?.longitude,
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
  const offreId = idValide(req.body.offreId);
  if (!offreId) return res.status(400).json({ erreur: 'offreId requis.' });

  try {
    if (!(await Offre.findByPk(offreId, { attributes: ['id'] }))) {
      return res.status(404).json({ erreur: 'Offre introuvable.' });
    }
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
  const offreId = idValide(req.params.offreId);
  if (!offreId) return res.status(400).json({ erreur: 'Identifiant invalide.' });
  try {
    await Favori.destroy({
      where: { utilisateurId: req.utilisateur.id, offreId },
    });
    res.json({ message: 'Favori retiré.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
