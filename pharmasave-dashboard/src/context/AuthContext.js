// ============================================================
// src/context/AuthContext.js — Gestion connexion pharmacien
// ============================================================

import React, { createContext, useState, useEffect, useContext } from 'react';
import { connexionPharmacien } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [pharmacien, setPharmacien] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Vérifie si déjà connecté au démarrage
  useEffect(() => {
    const token = localStorage.getItem('token_pharmacien');
    const data  = localStorage.getItem('pharmacien_data');
    if (token && data) {
      try {
        setPharmacien(JSON.parse(data));
      } catch {
        localStorage.removeItem('token_pharmacien');
        localStorage.removeItem('pharmacien_data');
      }
    }
    setChargement(false);
  }, []);

  const seConnecter = async (email, motDePasse) => {
    const data = await connexionPharmacien(email, motDePasse);
    localStorage.setItem('token_pharmacien', data.token);
    localStorage.setItem('pharmacien_data', JSON.stringify(data.utilisateur));
    setPharmacien(data.utilisateur);
  };

  const seDeconnecter = () => {
    localStorage.removeItem('token_pharmacien');
    localStorage.removeItem('pharmacien_data');
    setPharmacien(null);
  };

  return (
    <AuthContext.Provider value={{ pharmacien, chargement, seConnecter, seDeconnecter, estConnecte: !!pharmacien }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
