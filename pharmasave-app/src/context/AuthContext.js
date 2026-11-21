// ============================================================
// src/context/AuthContext.js — État global de l'authentification
// ============================================================
// Ce fichier gère l'état de connexion dans toute l'app.
// Utilise React Context pour partager l'info "connecté/déconnecté"
// entre tous les écrans sans avoir à la passer manuellement.
// ============================================================

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { lireToken, enregistrerToken, supprimerToken } from '../api/tokenStorage';
import {
  connexion, demanderVerification, confirmerInscription, getMonProfil, savePushToken,
  supprimerPushToken, modifierProfil, setDeconnexionCallback, supprimerCompte as apiSupprimerCompte,
} from '../api/client';

// Configure l'affichage des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

async function obtenirPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // Expo Go sans projet EAS : pas de push

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch {
    return null;
  }
}

// Dernière position connue, seulement si l'utilisateur a déjà donné la
// permission (aucune demande ici). Sert à recevoir les offres proches.
async function positionApproximative() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getLastKnownPositionAsync();
    return loc?.coords ? { latitude: loc.coords.latitude, longitude: loc.coords.longitude } : null;
  } catch {
    return null;
  }
}

// Enregistre le push token en arrière-plan (silencieux si erreur)
function enregistrerPushToken() {
  Promise.all([obtenirPushToken(), positionApproximative()])
    .then(([token, position]) => { if (token) return savePushToken(token, position); })
    .catch(() => {});
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

  const restaurerSession = useCallback(async () => {
    try {
      const token = await lireToken();
      if (token) {
        const profil = await getMonProfil();
        setUtilisateur(profil);
        // Le token push peut changer (réinstallation…) : on le renvoie
        enregistrerPushToken();
      }
    } catch (err) {
      // Erreur réseau (pas de réponse) : garder le token, afficher l'écran d'erreur
      if (!err.response) {
        setErreurReseau(true);
        return;
      }
      // Erreur 401 (token expiré ou révoqué) : déconnecter
      await supprimerToken();
    } finally {
      setChargement(false);
    }
  }, []);

  // Au démarrage : vérifie si un token est déjà sauvegardé
  useEffect(() => { restaurerSession(); }, [restaurerSession]);

  const seConnecter = async (email, motDePasse) => {
    const data = await connexion(email, motDePasse);
    await enregistrerToken(data.token);
    setUtilisateur(data.utilisateur);
    enregistrerPushToken();
  };

  // Inscription en 2 étapes avec vérification SMS
  const demanderCodeSMS = (prenom, nom, email, motDePasse, telephone) =>
    demanderVerification(prenom, nom, email, motDePasse, telephone);

  const confirmerCompte = async (telephone, code) => {
    const data = await confirmerInscription(telephone, code);
    await enregistrerToken(data.token);
    setUtilisateur(data.utilisateur);
    enregistrerPushToken();
  };

  const mettreAJourProfil = async (data) => {
    const resultat = await modifierProfil(data);
    setUtilisateur(resultat.utilisateur);
  };

  // Après une action qui renvoie le profil à jour (téléphone, notifications)
  const remplacerUtilisateur = (profil) => setUtilisateur(profil);

  const seDeconnecter = async () => {
    // L'appareil ne doit plus recevoir les notifications de ce compte
    await supprimerPushToken().catch(() => {});
    await supprimerToken();
    setUtilisateur(null);
  };

  const supprimerCompte = async (motDePasse) => {
    await apiSupprimerCompte(motDePasse);
    await supprimerToken();
    setUtilisateur(null);
  };

  const retenterConnexion = async () => {
    setErreurReseau(false);
    setChargement(true);
    await restaurerSession();
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
      supprimerCompte,
      mettreAJourProfil,
      remplacerUtilisateur,
      retenterConnexion,
      enregistrerPushToken,
      estConnecte: !!utilisateur,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personnalisé pour utiliser le contexte facilement
// Usage dans un écran : const { utilisateur, seConnecter } = useAuth();
export const useAuth = () => useContext(AuthContext);
