// ============================================================
// middleware/auth.js — Vérification du token JWT
// ============================================================
// Ce middleware protège les routes qui nécessitent une connexion.
// Usage : router.get('/route-protegee', authMiddleware, (req, res) => {...})
//
// Le token est vérifié puis l'utilisateur est relu en base : un compte
// supprimé, un mot de passe changé (tokenVersion) ou une pharmacie
// modifiée sont pris en compte immédiatement.
// ============================================================

const jwt = require('jsonwebtoken');
const { Utilisateur, Pharmacie } = require('../database/models');

module.exports = async function authMiddleware(req, res, next) {
  // Le token doit être dans le header : Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erreur: 'Accès refusé. Connecte-toi d\'abord.' });
  }

  let decoded;
  try {
    // Vérifie et décode le token avec la clé secrète
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ erreur: 'Token invalide ou expiré. Reconnecte-toi.' });
  }

  try {
    const utilisateur = await Utilisateur.findByPk(decoded.id, {
      attributes: ['id', 'email', 'pharmacieId', 'tokenVersion'],
      include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['valide'] }],
    });

    if (!utilisateur || (decoded.v ?? 0) !== utilisateur.tokenVersion) {
      return res.status(401).json({ erreur: 'Session expirée. Reconnecte-toi.' });
    }

    // Infos de l'utilisateur accessibles dans les routes
    req.utilisateur = {
      id:               utilisateur.id,
      email:            utilisateur.email,
      pharmacieId:      utilisateur.pharmacieId,
      pharmacieValidee: !!utilisateur.pharmacie?.valide,
    };
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware à chaîner après authMiddleware : réservé aux pharmaciens
// dont la pharmacie a été validée par un administrateur.
module.exports.pharmacienValide = function pharmacienValide(req, res, next) {
  if (!req.utilisateur.pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  if (!req.utilisateur.pharmacieValidee) {
    return res.status(403).json({
      erreur: 'Ta pharmacie est en attente de validation par l\'équipe Take & Care.',
    });
  }
  next();
};
