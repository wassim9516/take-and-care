// ============================================================
// src/config.js — Configuration globale de l'application
// ============================================================
// Les valeurs viennent des variables d'environnement EXPO_PUBLIC_*
// (fichier .env en local, eas.json pour les builds des stores).
//
// En développement avec Expo Go, crée pharmasave-app/.env :
//   EXPO_PUBLIC_API_URL=http://192.168.1.XX:3000/api
// (IP du Mac : ifconfig | grep "inet 192" — l'iPhone et le Mac
// doivent être sur le même réseau Wi-Fi)
// ============================================================

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.86:3000/api';

export const CONFIG = {
  API_URL,
  // Racine du serveur (pages légales…)
  SERVEUR_URL: API_URL.replace(/\/api\/?$/, ''),
  // Clé publique Stripe (pk_test_… ou pk_live_). Vide = réservation sans
  // paiement en ligne (obligatoire dans Expo Go : Stripe nécessite un build EAS)
  STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@takeandcare.fr',
};

export const LIENS_LEGAUX = {
  cgu:             `${CONFIG.SERVEUR_URL}/legal/cgu`,
  confidentialite: `${CONFIG.SERVEUR_URL}/legal/confidentialite`,
};
