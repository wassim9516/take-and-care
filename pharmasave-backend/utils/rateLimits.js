// ============================================================
// utils/rateLimits.js — Limites de requêtes partagées
// ============================================================

const rateLimit = require('express-rate-limit');

// Routes sensibles (connexion, inscription, code SMS, mot de passe) :
// 15 tentatives / 15 min par IP. Ne PAS l'appliquer à /moi, /profil…
// qui sont appelées à chaque ouverture de l'app.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

// API générale : 200 requêtes / minute par IP
const limiteAPI = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes. Réessaie dans un instant.' },
});

module.exports = { limiteAuth, limiteAPI };
