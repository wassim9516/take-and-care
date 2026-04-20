// ============================================================
// src/context/AuthContext.js — État global de l'authentification
// ============================================================
// Ce fichier gère l'état de connexion dans toute l'app.
// Utilise React Context pour partager l'info "connecté/déconnecté"
// entre tous les écrans sans avoir à la passer manuellement.
// ============================================================

import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { connexion, inscription, getMonProfil, savePushToken } from '../api/client';

// Configure l'affichage des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

async function enregistrerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

// Crée le contexte (accessible depuis n'importe quel écran)
const AuthContext = createContext(null);

// -------------------------------------------------------
// AuthProvider — Enveloppe toute l'app dans App.js
// -------------------------------------------------------
export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);  // null = déconnecté
  const [chargement, setChargement]   = useState(true);  // Vrai au démarrage

  // Au démarrage : vérifie si un token est déjà sauvegardé
  useEffect(() => {
    const verifierToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // Token trouvé → récupère le profil depuis le serveur
          const profil = await getMonProfil();
          setUtilisateur(profil);
        }
      } catch {
        // Token invalide ou expiré → on déconnecte
        await AsyncStorage.removeItem('token');
      } finally {
        setChargement(false);
      }
    };
    verifierToken();
  }, []);

  // -------------------------------------------------------
  // Fonction de connexion
  // -------------------------------------------------------
  const seConnecter = async (email, motDePasse) => {
    const data = await connexion(email, motDePasse);
    await AsyncStorage.setItem('token', data.token);
    setUtilisateur(data.utilisateur);
    // Enregistre le push token en arrière-plan (silencieux si erreur)
    enregistrerPushToken().then(token => { if (token) savePushToken(token).catch(() => {}); });
  };

  // -------------------------------------------------------
  // Fonction d'inscription
  // -------------------------------------------------------
  const sInscrire = async (prenom, nom, email, motDePasse) => {
    const data = await inscription(prenom, nom, email, motDePasse);
    await AsyncStorage.setItem('token', data.token);
    setUtilisateur(data.utilisateur);
    enregistrerPushToken().then(token => { if (token) savePushToken(token).catch(() => {}); });
  };

  // -------------------------------------------------------
  // Fonction de déconnexion
  // -------------------------------------------------------
  const seDeconnecter = async () => {
    await AsyncStorage.removeItem('token');
    setUtilisateur(null);
  };

  return (
    <AuthContext.Provider value={{
      utilisateur,       // Infos de l'utilisateur connecté (ou null)
      chargement,        // True pendant la vérification du token au démarrage
      seConnecter,
      sInscrire,
      seDeconnecter,
      estConnecte: !!utilisateur, // Raccourci booléen
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personnalisé pour utiliser le contexte facilement
// Usage dans un écran : const { utilisateur, seConnecter } = useAuth();
export const useAuth = () => useContext(AuthContext);
