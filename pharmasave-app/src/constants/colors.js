// ============================================================
// src/constants/colors.js — Palette de couleurs de l'app
// ============================================================
// Centraliser les couleurs ici permet de les changer facilement.
// Pour modifier le thème : édite uniquement ce fichier.
// ============================================================

export const COLORS = {
  // Couleur principale (vert forêt)
  primaire: '#2D6A4F',
  primaireF: '#1B4332',    // Version foncée pour les boutons actifs

  // Couleur secondaire
  secondaire: '#40916C',

  // Alertes et urgences
  danger: '#C0392B',       // Rouge pour "bientôt épuisé"
  attention: '#E67E22',    // Orange pour "peu de stock"
  succes: '#2D6A4F',       // Vert pour "disponible"

  // Neutres
  blanc: '#FFFFFF',
  fondClair: '#F4F6F4',    // Fond légèrement teinté vert
  bordure: '#E8EDE8',
  texte: '#1A2E1A',        // Texte principal (vert très foncé)
  texteClair: '#6B7C6B',   // Texte secondaire

  // Catégories (badge de couleur sur les cartes)
  categories: {
    soin_visage: '#FF6B9D',
    soin_corps: '#A29BFE',
    complement: '#74B9FF',
    bebe: '#FDD835',
    solaire: '#FD9644',
  },
};
