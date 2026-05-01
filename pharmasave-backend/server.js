// ============================================================
// server.js — Point d'entrée du serveur PharmaSave
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
const rateLimit     = require('express-rate-limit');
const sequelize     = require('./database/connection');

const authRouter         = require('./routes/auth');
const pharmaciesRouter   = require('./routes/pharmacies');
const offersRouter       = require('./routes/offers');
const reservationsRouter = require('./routes/reservations');
const uploadRouter       = require('./routes/upload');
const favorisRouter      = require('./routes/favoris');
const paiementsRouter    = require('./routes/paiements');

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

// En développement, autoriser aussi les origines locales
if (process.env.NODE_ENV !== 'production') {
  originesAutorisees.push(
    'http://localhost:3001',
    'http://localhost:8081',
    'http://192.168.1.99:3001',
  );
}

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (app mobile, Postman)
    if (!origin) return callback(null, true);
    if (originesAutorisees.length === 0 || originesAutorisees.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origine non autorisée : ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting — auth : 15 tentatives / 15 min par IP
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

// Rate limiting — API générale : 200 requêtes / minute par IP
const limiteAPI = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes. Réessaie dans un instant.' },
});

// -------------------------------------------------------
// ROUTES
// -------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ message: 'Take & Care API ✅', version: '2.0.0' });
});

app.use('/api/auth',         limiteAuth, authRouter);
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
    // sync() vérifie que les tables existent (ne les recrée pas si elles existent déjà)
    return sequelize.sync();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
      console.log(`   Depuis iPhone : http://${process.env.BACKEND_URL?.replace(/https?:\/\//, '').replace(/:.*/, '') || '192.168.1.99'}:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Impossible de se connecter à PostgreSQL :', err.message);
    console.error('   Vérifie que PostgreSQL est lancé : brew services start postgresql@14');
  });
