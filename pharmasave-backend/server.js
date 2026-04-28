// ============================================================
// server.js — Point d'entrée du serveur PharmaSave
// ============================================================

require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
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

// -------------------------------------------------------
// MIDDLEWARE
// -------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

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
  console.error('Erreur non gérée :', err.stack);
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
      console.log(`   Depuis iPhone : http://10.30.29.232:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Impossible de se connecter à PostgreSQL :', err.message);
    console.error('   Vérifie que PostgreSQL est lancé : brew services start postgresql@14');
  });
