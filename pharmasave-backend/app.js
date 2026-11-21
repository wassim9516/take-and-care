// ============================================================
// app.js — Application Express (routes, middlewares)
// ============================================================
// Séparée de server.js pour être testée sans ouvrir de port ni
// lancer les tâches périodiques (voir tests/).
// ============================================================

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const path          = require('path');
const { limiteAPI } = require('./utils/rateLimits');
const { DOSSIER_UPLOADS } = require('./utils/images');

const authRouter         = require('./routes/auth');
const pharmaciesRouter   = require('./routes/pharmacies');
const offersRouter       = require('./routes/offers');
const reservationsRouter = require('./routes/reservations');
const uploadRouter       = require('./routes/upload');
const favorisRouter      = require('./routes/favoris');
const paiementsRouter    = require('./routes/paiements');
const adminRouter        = require('./routes/admin');
const { webhookStripe }  = paiementsRouter;

const app = express();

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
app.use('/uploads', express.static(DOSSIER_UPLOADS, { maxAge: '7d' }));

// Pages légales (CGU, confidentialité) : leurs URL sont demandées par
// l'App Store et le Play Store, et affichées dans l'app et le dashboard
app.use('/legal', express.static(path.join(__dirname, 'public', 'legal'), { extensions: ['html'] }));

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
app.use('/api/paiements',    limiteAPI,  paiementsRouter);
app.use('/api/admin',        limiteAPI,  adminRouter);

// -------------------------------------------------------
// Middleware de gestion d'erreurs globale
// Attrape toutes les erreurs non gérées dans les routes
// -------------------------------------------------------
app.use((err, req, res, next) => {
  // Corps de requête mal formé (JSON invalide, trop gros…) → erreur client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erreur: 'Requête invalide (JSON mal formé).' });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ erreur: 'Requête invalide.' });
  }
  if (process.env.NODE_ENV === 'development') {
    console.error('Erreur non gérée :', err.stack);
  } else {
    console.error('Erreur non gérée :', err.message);
  }
  res.status(500).json({ erreur: 'Erreur serveur inattendue.' });
});

module.exports = app;
