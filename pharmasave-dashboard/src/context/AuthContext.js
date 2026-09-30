// ============================================================
// src/context/AuthContext.js — Gestion connexion pharmacien
// ============================================================

import React, { createContext, useState, useEffect, useContext } from 'react';
import { connexionPharmacien, inscriptionPharmacien, setDeconnexionCallback, getMoi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [pharmacien, setPharmacien] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Enregistre le callback de déconnexion automatique (token expiré → 401)
  useEffect(() => {
    setDeconnexionCallback(() => setPharmacien(null));
  }, []);

  // Vérifie si déjà connecté au démarrage en validant le token auprès du serveur
  useEffect(() => {
    const verifierToken = async () => {
      const token = localStorage.getItem('token_pharmacien');
      if (!token) {
        setChargement(false);
        return;
      }
      try {
        const utilisateur = await getMoi();
        setPharmacien(utilisateur);
      } catch {
        // Token invalide ou expiré → nettoyage
        localStorage.removeItem('token_pharmacien');
        localStorage.removeItem('pharmacien_data');
      } finally {
        setChargement(false);
      }
    };
    verifierToken();
  }, []);

  const seConnecter = async (email, motDePasse) => {
    const data = await connexionPharmacien(email, motDePasse);
    localStorage.setItem('token_pharmacien', data.token);
    localStorage.setItem('pharmacien_data', JSON.stringify(data.utilisateur));
    setPharmacien(data.utilisateur);
  };

  const sInscrirePharmacien = async (data) => {
    const resp = await inscriptionPharmacien(data);
    localStorage.setItem('token_pharmacien', resp.token);
    localStorage.setItem('pharmacien_data', JSON.stringify(resp.utilisateur));
    setPharmacien(resp.utilisateur);
  };

  const seDeconnecter = () => {
    localStorage.removeItem('token_pharmacien');
    localStorage.removeItem('pharmacien_data');
    setPharmacien(null);
  };

  return (
    <AuthContext.Provider value={{ pharmacien, chargement, seConnecter, seDeconnecter, sInscrirePharmacien, estConnecte: !!pharmacien }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
