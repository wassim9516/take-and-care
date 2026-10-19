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

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const path          = require('path');
const sequelize     = require('./database/connection');
const { executerMigrations } = require('./database/migrations');
const { limiteAPI } = require('./utils/rateLimits');

const authRouter         = require('./routes/auth');
const pharmaciesRouter   = require('./routes/pharmacies');
const offersRouter       = require('./routes/offers');
const reservationsRouter = require('./routes/reservations');
const uploadRouter       = require('./routes/upload');
const favorisRouter      = require('./routes/favoris');
const paiementsRouter    = require('./routes/paiements');
const { webhookStripe }  = paiementsRouter;

const app  = express();
const PORT = process.env.PORT || 3000;

// Nécessaire sur Railway/Heroku — le serveur est derrière un reverse proxy
app.set('trust proxy', 1);

// -------------------------------------------------------
// MIDDLEWARE
// -------------------------------------------------------

// Headers de sécurité HTTP
app.use(helmet());

// CORS restrictif — seuls les domaines autorisés peuvent appeler l'API
const originesAutorisees = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// En développement, autoriser aussi les origines locales (dashboard sur le
// port 3001, Expo web sur 8081) — y compris depuis l'IP du Mac
if (process.env.NODE_ENV !== 'production') {
  originesAutorisees.push('http://localhost:3001', 'http://localhost:8081');
  if (process.env.BACKEND_URL) {
    const hote = new URL(process.env.BACKEND_URL).hostname;
    originesAutorisees.push(`http://${hote}:3001`, `http://${hote}:8081`);
  }
} else if (originesAutorisees.length === 0) {
  console.warn('⚠️  CORS_ORIGINS vide en production : aucun site web ne pourra appeler l\'API (l\'app mobile fonctionne).');
}

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (app mobile, Postman)
    if (!origin) return callback(null, true);
    if (originesAutorisees.includes(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Webhook Stripe : doit recevoir le corps brut (signature) → avant express.json
app.post('/api/paiements/webhook', express.raw({ type: 'application/json' }), webhookStripe);

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting : limiteAPI partout, limiteAuth (plus strict) directement
// sur les routes sensibles de routes/auth.js — voir utils/rateLimits.js

// -------------------------------------------------------
// ROUTES
// -------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ message: 'Take & Care API ✅', version: '2.0.0' });
});

app.use('/api/auth',         limiteAPI,  authRouter);
app.use('/api/pharmacies',   limiteAPI,  pharmaciesRouter);
app.use('/api/offers',       limiteAPI,  offersRouter);
app.use('/api/reservations', limiteAPI,  reservationsRouter);
app.use('/api/upload',       limiteAPI,  uploadRouter);
app.use('/api/favoris',      limiteAPI,  favorisRouter);
app.use('/api/paiements',   limiteAPI,  paiementsRouter);

// -------------------------------------------------------
// Middleware de gestion d'erreurs globale
// Attrape toutes les erreurs non gérées dans les routes
// -------------------------------------------------------
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('Erreur non gérée :', err.stack);
  } else {
    console.error('Erreur non gérée :', err.message);
  }
  res.status(500).json({ erreur: 'Erreur serveur inattendue.' });
});

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
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
      if (process.env.BACKEND_URL) console.log(`   Depuis iPhone : ${process.env.BACKEND_URL}`);
    });
  })
  .catch(err => {
    console.error('❌ Impossible de démarrer :', err.message);
    console.error('   Vérifie que PostgreSQL est lancé (voir DEMARRAGE.md)');
    process.exit(1);
  });
