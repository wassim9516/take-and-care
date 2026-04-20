// ============================================================
// routes/pharmacies.js — Routes liées aux pharmacies (PostgreSQL)
// ============================================================

const express    = require('express');
const router     = express.Router();
const { Pharmacie, Offre } = require('../database/models');

// GET /api/pharmacies — Toutes les pharmacies
router.get('/', async (req, res) => {
  try {
    const pharmacies = await Pharmacie.findAll();
    res.json(pharmacies);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/pharmacies/nearby?lat=XX&lng=YY — Pharmacies proches avec distance
router.get('/nearby', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ erreur: 'Paramètres lat et lng requis.' });
  }

  try {
    const pharmacies = await Pharmacie.findAll();
    const latitude   = parseFloat(lat);
    const longitude  = parseFloat(lng);

    const avecDistance = pharmacies.map(p => ({
      ...p.toJSON(),
      distance: Math.round(calculerDistance(latitude, longitude, p.latitude, p.longitude) * 10) / 10,
    }));

    avecDistance.sort((a, b) => a.distance - b.distance);
    res.json(avecDistance);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/pharmacies/:id — Détail d'une pharmacie avec ses offres
router.get('/:id', async (req, res) => {
  try {
    const pharmacie = await Pharmacie.findByPk(req.params.id, {
      include: [{ model: Offre, as: 'offres', where: { actif: true }, required: false }],
    });

    if (!pharmacie) return res.status(404).json({ erreur: 'Pharmacie introuvable.' });
    res.json(pharmacie);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// Formule de Haversine — calcule la distance entre deux points GPS
function calculerDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
