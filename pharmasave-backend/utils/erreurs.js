// ============================================================
// utils/erreurs.js — Message lisible pour les erreurs de démarrage
// ============================================================
// Quand PostgreSQL est arrêté, Sequelize renvoie une erreur au message
// vide (échec en IPv4 et en IPv6 regroupés) : on l'explique en clair.
// ============================================================

function messageErreur(err) {
  const codes = [err?.parent?.code, ...(err?.parent?.errors || []).map(e => e.code)];
  if (err?.name === 'SequelizeConnectionRefusedError' || codes.includes('ECONNREFUSED')) {
    return 'PostgreSQL ne répond pas : il n\'est pas lancé. Démarre-le avec :\n' +
           '   pg_ctl -D ~/.local/pgdata -l ~/.local/pgdata/server.log start';
  }
  if (err?.name === 'SequelizeConnectionError' && /password|authentication/i.test(err.message)) {
    return 'Connexion à PostgreSQL refusée : vérifie DB_USER et DB_PASSWORD dans le .env.';
  }
  if (err?.name === 'SequelizeConnectionError' && /does not exist/i.test(err.message)) {
    return `${err.message} : vérifie DB_NAME dans le .env.`;
  }
  return err?.message || err?.name || String(err);
}

module.exports = { messageErreur };
