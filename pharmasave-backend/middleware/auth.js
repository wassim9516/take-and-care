// ============================================================
// middleware/auth.js — Vérification du token JWT
// ============================================================
// Ce middleware protège les routes qui nécessitent une connexion.
// Usage : router.get('/route-protegee', authMiddleware, (req, res) => {...})
// ============================================================

const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  // Le token doit être dans le header : Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erreur: 'Accès refusé. Connecte-toi d\'abord.' });
  }

  try {
    // Vérifie et décode le token avec la clé secrète
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Ajoute les infos de l'utilisateur à la requête (accessible dans les routes)
    req.utilisateur = decoded;
    next(); // Passe à la route suivante
  } catch {
    return res.status(403).json({ erreur: 'Token invalide ou expiré. Reconnecte-toi.' });
  }
};
