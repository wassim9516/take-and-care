// ============================================================
// src/config.js — Configuration globale de l'application
// ============================================================
// ⚠️  IMPORTANT : Change l'adresse IP ci-dessous !
//
// Pour trouver ton IP locale sur Mac :
//   1. Ouvre un Terminal
//   2. Tape : ifconfig | grep "inet 192"
//   3. Tu verras quelque chose comme "inet 192.168.1.XX"
//   4. Remplace "192.168.1.XX" par cette adresse
//
// L'iPhone et le Mac doivent être sur le même réseau WiFi !
// ============================================================

export const CONFIG = {
  API_URL: 'http://10.30.1.65:3000/api',
  RAYON_RECHERCHE: 5,
  // Clé publique Stripe (commence par pk_test_ ou pk_live_)
  // Récupère-la sur https://dashboard.stripe.com/apikeys
  STRIPE_PUBLISHABLE_KEY: 'pk_test_51TRCQ1FFctA1LMICB6vSmxbsU3wPr2lEb6CHb06HG2Y1dYVxXGppqDcCMsXwoZA2WpccJ5WsYAdz1sbhfeMwKPSy00qLwqH9u9',
};
