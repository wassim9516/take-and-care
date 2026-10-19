// ============================================================
// src/config.js — Configuration du dashboard
// ============================================================

// URL de l'API : variable REACT_APP_API_URL au build (ex. dans .env.production :
//   REACT_APP_API_URL=https://ton-backend.up.railway.app/api)
// Par défaut en local : le backend sur le même ordinateur.
export const CONFIG = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
};
