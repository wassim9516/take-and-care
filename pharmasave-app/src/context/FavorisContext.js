// ============================================================
// src/context/FavorisContext.js — État global des favoris
// ============================================================

import React, { createContext, useState, useEffect, useContext } from 'react';
import { getFavorisIds, ajouterFavori, supprimerFavori } from '../api/client';
import { useAuth } from './AuthContext';

const FavorisContext = createContext(null);

export function FavorisProvider({ children }) {
  const { estConnecte } = useAuth();
  const [favorisIds, setFavorisIds] = useState([]);

  useEffect(() => {
    if (estConnecte) chargerIds();
    else setFavorisIds([]);
  }, [estConnecte]);

  const chargerIds = async () => {
    try {
      const ids = await getFavorisIds();
      setFavorisIds(ids);
    } catch (err) {
      console.error('Erreur chargement IDs favoris:', err);
    }
  };

  const toggleFavori = async (offreId) => {
    const estFavori = favorisIds.includes(offreId);
    // Mise à jour optimiste
    setFavorisIds(prev =>
      estFavori ? prev.filter(id => id !== offreId) : [...prev, offreId]
    );
    try {
      if (estFavori) await supprimerFavori(offreId);
      else await ajouterFavori(offreId);
    } catch {
      // Rollback si erreur
      setFavorisIds(prev =>
        estFavori ? [...prev, offreId] : prev.filter(id => id !== offreId)
      );
    }
  };

  return (
    <FavorisContext.Provider value={{ favorisIds, toggleFavori, chargerIds }}>
      {children}
    </FavorisContext.Provider>
  );
}

export const useFavoris = () => useContext(FavorisContext);
