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
import { connexion, demanderVerification, confirmerInscription, getMonProfil, savePushToken, modifierProfil, setDeconnexionCallback } from '../api/client';

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
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement]   = useState(true);
  const [erreurReseau, setErreurReseau] = useState(false);

  // Enregistre le callback de déconnexion automatique (token expiré → 401)
  useEffect(() => {
    setDeconnexionCallback(() => setUtilisateur(null));
  }, []);

  // Au démarrage : vérifie si un token est déjà sauvegardé
  useEffect(() => {
    const verifierToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const profil = await getMonProfil();
          setUtilisateur(profil);
        }
      } catch (err) {
        // Erreur réseau (pas de réponse) : garder le token, afficher l'écran d'erreur
        if (!err.response) {
          setErreurReseau(true);
          return;
        }
        // Erreur 401 (token expiré) : déconnecter
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
  // Inscription en 2 étapes avec vérification SMS
  // -------------------------------------------------------
  const demanderCodeSMS = async (prenom, nom, email, motDePasse, telephone) => {
    return await demanderVerification(prenom, nom, email, motDePasse, telephone);
  };

  const confirmerCompte = async (telephone, code) => {
    const data = await confirmerInscription(telephone, code);
    await AsyncStorage.setItem('token', data.token);
    setUtilisateur(data.utilisateur);
    enregistrerPushToken().then(token => { if (token) savePushToken(token).catch(() => {}); });
  };

  // -------------------------------------------------------
  // Fonction de déconnexion
  // -------------------------------------------------------
  const mettreAJourProfil = async (data) => {
    const resultat = await modifierProfil(data);
    setUtilisateur(resultat.utilisateur);
  };

  const seDeconnecter = async () => {
    await AsyncStorage.removeItem('token');
    setUtilisateur(null);
  };

  const retenterConnexion = async () => {
    setErreurReseau(false);
    setChargement(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const profil = await getMonProfil();
        setUtilisateur(profil);
      }
    } catch (err) {
      if (!err.response) setErreurReseau(true);
      else await AsyncStorage.removeItem('token');
    } finally {
      setChargement(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      utilisateur,
      chargement,
      erreurReseau,
      seConnecter,
      demanderCodeSMS,
      confirmerCompte,
      seDeconnecter,
      mettreAJourProfil,
      retenterConnexion,
      estConnecte: !!utilisateur,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personnalisé pour utiliser le contexte facilement
// Usage dans un écran : const { utilisateur, seConnecter } = useAuth();
export const useAuth = () => useContext(AuthContext);
