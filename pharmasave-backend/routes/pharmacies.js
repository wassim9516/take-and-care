// ============================================================
// routes/pharmacies.js — Routes liées aux pharmacies (PostgreSQL)
// ============================================================

const express        = require('express');
const router         = express.Router();
const authMiddleware = require('../middleware/auth');
const { Pharmacie, Offre, PHARMACIE_CHAMPS_PRIVES } = require('../database/models');
const { validerImage } = require('../utils/images');

// Champs internes jamais renvoyés dans les routes publiques
const ATTRIBUTS_PUBLICS = { exclude: [...PHARMACIE_CHAMPS_PRIVES, 'valide'] };

function texteValide(valeur, max) {
  return valeur === undefined || valeur === null || (typeof valeur === 'string' && valeur.length <= max);
}

// GET /api/pharmacies — Toutes les pharmacies validées
router.get('/', async (req, res) => {
  try {
    const pharmacies = await Pharmacie.findAll({ where: { valide: true }, attributes: ATTRIBUTS_PUBLICS });
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
    const pharmacies = await Pharmacie.findAll({ where: { valide: true }, attributes: ATTRIBUTS_PUBLICS });

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

// GET /api/pharmacies/mienne — Pharmacie du pharmacien connecté (dashboard),
// visible même en attente de validation
router.get('/mienne', authMiddleware, async (req, res) => {
  if (!req.utilisateur.pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  try {
    const pharmacie = await Pharmacie.findByPk(req.utilisateur.pharmacieId, {
      attributes: { exclude: PHARMACIE_CHAMPS_PRIVES },
    });
    if (!pharmacie) return res.status(404).json({ erreur: 'Pharmacie introuvable.' });
    res.json(pharmacie);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/pharmacies/:id — Détail d'une pharmacie avec ses offres
// Une pharmacie en attente de validation n'est visible que via /mienne.
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ erreur: 'Identifiant invalide.' });
  try {
    const pharmacie = await Pharmacie.findByPk(id, {
      attributes: { exclude: PHARMACIE_CHAMPS_PRIVES },
      include: [{ model: Offre, as: 'offres', where: { actif: true }, required: false }],
    });

    if (!pharmacie) return res.status(404).json({ erreur: 'Pharmacie introuvable.' });
    if (!pharmacie.valide) {
      return res.status(404).json({ erreur: 'Pharmacie introuvable.' });
    }
    const { valide, ...pharmaciePublique } = pharmacie.toJSON();
    res.json(pharmaciePublique);
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

  if (typeof nom !== 'string' || !nom.trim() || typeof adresse !== 'string' || !adresse.trim()) {
    return res.status(400).json({ erreur: 'Nom et adresse sont obligatoires.' });
  }
  if (!texteValide(nom, 100) || !texteValide(adresse, 200) || !texteValide(telephone, 30) || !texteValide(horaires, 200)) {
    return res.status(400).json({ erreur: 'Un des champs est trop long.' });
  }

  const coordonnees = {};
  if (latitude !== undefined && latitude !== null && latitude !== '') {
    const lat = parseFloat(latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ erreur: 'Latitude invalide.' });
    coordonnees.latitude = lat;
  }
  if (longitude !== undefined && longitude !== null && longitude !== '') {
    const lng = parseFloat(longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ erreur: 'Longitude invalide.' });
    coordonnees.longitude = lng;
  }

  try {
    const pharmacie = await Pharmacie.findByPk(req.params.id);
    if (!pharmacie) return res.status(404).json({ erreur: 'Pharmacie introuvable.' });

    const imageValidee = validerImage(image, pharmacie.image, pharmacieId);
    if (!imageValidee.ok) return res.status(400).json({ erreur: 'Image invalide.' });

    await pharmacie.update({
      nom: nom.trim(), adresse: adresse.trim(), telephone, horaires,
      ...coordonnees,
      ...(imageValidee.valeur !== undefined ? { image: imageValidee.valeur } : {}),
    });

    const { stripeAccountId, ...pharmaciePublique } = pharmacie.toJSON();
    res.json({ message: 'Pharmacie mise à jour.', pharmacie: pharmaciePublique });
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
