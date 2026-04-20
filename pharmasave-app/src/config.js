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
  // Adresse du serveur backend
  // En développement : ton IP locale (voir instructions ci-dessus)
  // En production : l'URL de ton serveur hébergé (ex: https://api.pharmasave.com)
  API_URL: 'http://10.30.1.65:3000/api',

  // Rayon de recherche par défaut (en km)
  RAYON_RECHERCHE: 5,
};
