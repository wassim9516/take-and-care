// ============================================================
// routes/pharmacies.js — Routes liées aux pharmacies (PostgreSQL)
// ============================================================

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/auth');
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

  const latitude  = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (!lat || !lng || isNaN(latitude) || isNaN(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ erreur: 'Coordonnées GPS invalides.' });
  }

  try {
    const pharmacies = await Pharmacie.findAll();

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

// PUT /api/pharmacies/:id — Modifier les infos de la pharmacie (pharmacien connecté)
router.put('/:id', authMiddleware, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;

  if (Number(pharmacieId) !== Number(req.params.id)) {
    return res.status(403).json({ erreur: 'Action non autorisée.' });
  }

  const { nom, adresse, telephone, horaires, latitude, longitude, image } = req.body;

  if (!nom || !adresse) {
    return res.status(400).json({ erreur: 'Nom et adresse sont obligatoires.' });
  }

  try {
    const pharmacie = await Pharmacie.findByPk(req.params.id);
    if (!pharmacie) return res.status(404).json({ erreur: 'Pharmacie introuvable.' });

    await pharmacie.update({
      nom, adresse, telephone, horaires,
      ...(latitude  ? { latitude:  parseFloat(latitude)  } : {}),
      ...(longitude ? { longitude: parseFloat(longitude) } : {}),
      ...(image     ? { image }                             : {}),
    });

    res.json({ message: 'Pharmacie mise à jour.', pharmacie });
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
