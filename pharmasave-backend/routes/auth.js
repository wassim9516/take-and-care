// ============================================================
// routes/auth.js — Inscription et connexion
// ============================================================

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { Utilisateur } = require('../database/models');

// -------------------------------------------------------
// POST /api/auth/inscription
// Crée un nouveau compte utilisateur
// Body : { prenom, nom, email, motDePasse, telephone? }
// -------------------------------------------------------
router.post('/inscription', async (req, res) => {
  const { prenom, nom, email, motDePasse, telephone } = req.body;

  // Validation basique des champs obligatoires
  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({ erreur: 'Tous les champs sont obligatoires.' });
  }

  if (motDePasse.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  try {
    // Vérifie si l'email est déjà utilisé
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    // Hashe le mot de passe (jamais stocker en clair)
    // Le "10" est le nombre de rounds de hachage — plus c'est élevé, plus c'est sécurisé
    const hash = await bcrypt.hash(motDePasse, 10);

    // Crée l'utilisateur en base
    const utilisateur = await Utilisateur.create({
      prenom, nom, email, telephone,
      motDePasse: hash,
    });

    // Génère un token JWT valable 7 jours
    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, pharmacieId: utilisateur.pharmacieId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès !',
      token,
      utilisateur: {
        id:          utilisateur.id,
        prenom:      utilisateur.prenom,
        nom:         utilisateur.nom,
        email:       utilisateur.email,
        pharmacieId: utilisateur.pharmacieId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/connexion
// Connecte un utilisateur existant
// Body : { email, motDePasse }
// -------------------------------------------------------
router.post('/connexion', async (req, res) => {
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: 'Email et mot de passe requis.' });
  }

  try {
    // Cherche l'utilisateur par email
    const utilisateur = await Utilisateur.findOne({ where: { email } });
    if (!utilisateur) {
      // Message volontairement vague pour ne pas indiquer si l'email existe
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    // Compare le mot de passe avec le hash stocké
    const valide = await bcrypt.compare(motDePasse, utilisateur.motDePasse);
    if (!valide) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    // Génère un nouveau token
    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, pharmacieId: utilisateur.pharmacieId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie !',
      token,
      utilisateur: {
        id:          utilisateur.id,
        prenom:      utilisateur.prenom,
        nom:         utilisateur.nom,
        email:       utilisateur.email,
        pharmacieId: utilisateur.pharmacieId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// GET /api/auth/moi
// Retourne les infos de l'utilisateur connecté
// Nécessite un token valide dans le header Authorization
// -------------------------------------------------------
const authMiddleware = require('../middleware/auth');

router.get('/moi', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id, {
      attributes: ['id', 'prenom', 'nom', 'email', 'telephone', 'pharmacieId'], // Exclut le mot de passe
    });
    res.json(utilisateur);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// PUT /api/auth/push-token
// Sauvegarde le token Expo push de l'utilisateur connecté
// Body : { pushToken }
// -------------------------------------------------------
router.put('/push-token', authMiddleware, async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ erreur: 'pushToken requis.' });

  try {
    await Utilisateur.update(
      { pushToken },
      { where: { id: req.utilisateur.id } }
    );
    res.json({ message: 'Token enregistré.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
