// ============================================================
// server.js — Point d'entrée du serveur Take & Care
// ============================================================

require('dotenv').config();

// Vérification des variables d'environnement critiques au démarrage
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'pharmasave_secret_key_change_moi_en_prod') {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ JWT_SECRET non défini ou non changé. Arrêt du serveur.');
    process.exit(1);
  } else {
    console.warn('⚠️  JWT_SECRET par défaut détecté — change-le avant de déployer !');
  }
}

const app       = require('./app');
const sequelize = require('./database/connection');
const { executerMigrations }  = require('./database/migrations');
const { traiterReservationsEnCours } = require('./utils/reservations');
const { nettoyerCodes }       = require('./utils/codes');
const { messageErreur }       = require('./utils/erreurs');

const PORT = process.env.PORT || 3000;

// -------------------------------------------------------
// CONNEXION BDD + DÉMARRAGE
// -------------------------------------------------------
sequelize.authenticate()
  .then(() => {
    console.log('✅ Connecté à PostgreSQL');
    // sync() crée les tables manquantes ; les migrations ajoutent les colonnes
    // manquantes aux tables existantes (sync ne le fait pas)
    return sequelize.sync();
  })
  .then(() => executerMigrations())
  .then(() => {
    // Tâches périodiques : rappels et expiration des réservations non
    // retirées (toutes les 10 min), nettoyage des codes de vérification
    const tache = (fn, nom) => () => fn().catch(err => console.error(`Tâche ${nom} :`, err.message));
    tache(traiterReservationsEnCours, 'réservations')();
    setInterval(tache(traiterReservationsEnCours, 'réservations'), 10 * 60 * 1000);
    setInterval(tache(nettoyerCodes, 'codes'), 60 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
      if (process.env.BACKEND_URL) console.log(`   Depuis iPhone : ${process.env.BACKEND_URL}`);
    });
  })
  .catch(err => {
    console.error('❌ Impossible de démarrer :', messageErreur(err));
    process.exit(1);
  });
