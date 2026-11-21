// ============================================================
// src/utils/validation.js — Règles partagées avec le serveur
// ============================================================

// 8 caractères minimum, au moins une lettre et un chiffre
export function erreurMotDePasse(mdp) {
  if (!mdp || mdp.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (!/[A-Za-z]/.test(mdp) || !/\d/.test(mdp)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  return null;
}
