// ============================================================
// src/utils/preferences.js — Préférences d'affichage du pharmacien
// ============================================================
// Enregistrées dans ce navigateur uniquement (localStorage).
// ============================================================

import { useCallback, useEffect, useState } from 'react';

const CLE = 'preferences_dashboard';
const EVENEMENT = 'preferences-dashboard';

export const PREFERENCES_DEFAUT = {
  vueOffres: 'grille',          // 'grille' | 'liste'
  ongletDemarrage: 'offres',    // onglet ouvert à la connexion
  rafraichissement: 60,         // secondes, 0 = désactivé
  alerteNouvelleResa: true,     // notification à l'arrivée d'une réservation
};

function lire() {
  try {
    return { ...PREFERENCES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE) || '{}') };
  } catch {
    return { ...PREFERENCES_DEFAUT };
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState(lire);

  // Synchronise les composants qui utilisent le hook
  useEffect(() => {
    const maj = () => setPreferences(lire());
    window.addEventListener(EVENEMENT, maj);
    return () => window.removeEventListener(EVENEMENT, maj);
  }, []);

  const modifier = useCallback((changements) => {
    const nouvelles = { ...lire(), ...changements };
    try { localStorage.setItem(CLE, JSON.stringify(nouvelles)); } catch { /* navigation privée */ }
    setPreferences(nouvelles);
    window.dispatchEvent(new Event(EVENEMENT));
  }, []);

  return [preferences, modifier];
}
