// ============================================================
// src/api/client.js — Toutes les requêtes vers le backend
// ============================================================

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

// Instance axios avec l'URL de base
const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 8000,
});

// Callback enregistré par AuthContext pour déconnecter l'utilisateur
let _onDeconnexion = null;
export const setDeconnexionCallback = (fn) => { _onDeconnexion = fn; };

// Ajoute automatiquement le token JWT à chaque requête
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepte les 401 (token expiré ou invalide) → déconnexion automatique
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      if (_onDeconnexion) _onDeconnexion();
    }
    return Promise.reject(error);
  }
);

// -------------------------------------------------------
// AUTH
// -------------------------------------------------------

export const demanderVerification = async (prenom, nom, email, motDePasse, telephone) => {
  const response = await api.post('/auth/demander-verification', { prenom, nom, email, motDePasse, telephone });
  return response.data;
};

export const confirmerInscription = async (telephone, code) => {
  const response = await api.post('/auth/confirmer-inscription', { telephone, code });
  return response.data;
};

export const connexion = async (email, motDePasse) => {
  const response = await api.post('/auth/connexion', { email, motDePasse });
  return response.data;
};

export const getMonProfil = async () => {
  const response = await api.get('/auth/moi');
  return response.data;
};

export const modifierProfil = async (data) => {
  const response = await api.put('/auth/profil', data);
  return response.data;
};

export const modifierMotDePasse = async (ancienMotDePasse, nouveauMotDePasse) => {
  const response = await api.put('/auth/mot-de-passe', { ancienMotDePasse, nouveauMotDePasse });
  return response.data;
};

// -------------------------------------------------------
// OFFRES
// -------------------------------------------------------

export const getOffres = async (categorie = null, offset = 0, limite = 20) => {
  const params = { limite, offset, ...(categorie ? { categorie } : {}) };
  const response = await api.get('/offers', { params });
  return response.data; // { offres, total, hasMore }
};

export const getOffre = async (id) => {
  const response = await api.get(`/offers/${id}`);
  return response.data;
};

// -------------------------------------------------------
// PHARMACIES
// -------------------------------------------------------

export const getPharmacies = async () => {
  const response = await api.get('/pharmacies');
  return response.data;
};

export const getPharmaciesProches = async (lat, lng) => {
  const response = await api.get('/pharmacies/nearby', { params: { lat, lng } });
  return response.data;
};

export const getPharmacie = async (id) => {
  const response = await api.get(`/pharmacies/${id}`);
  return response.data;
};

// -------------------------------------------------------
// RÉSERVATIONS
// -------------------------------------------------------

export const creerIntentPaiement = async (offreId) => {
  const response = await api.post('/paiements/intent', { offreId });
  return response.data; // { clientSecret, paymentIntentId, montant, commission, commissionTaux }
};

export const creerReservation = async (offreId, paymentIntentId = null) => {
  const response = await api.post('/reservations', { offreId, paymentIntentId });
  return response.data;
};

export const getMesReservations = async () => {
  const response = await api.get('/reservations');
  return response.data;
};

export const annulerReservation = async (id) => {
  const response = await api.delete(`/reservations/${id}`);
  return response.data;
};

export const noterReservation = async (id, note) => {
  const response = await api.post(`/reservations/${id}/noter`, { note });
  return response.data;
};

export const savePushToken = async (pushToken) => {
  const response = await api.put('/auth/push-token', { pushToken });
  return response.data;
};

// -------------------------------------------------------
// FAVORIS
// -------------------------------------------------------

export const getMesFavoris = async () => {
  const response = await api.get('/favoris');
  return response.data;
};

export const getFavorisIds = async () => {
  const response = await api.get('/favoris/ids');
  return response.data;
};

export const ajouterFavori = async (offreId) => {
  const response = await api.post('/favoris', { offreId });
  return response.data;
};

export const supprimerFavori = async (offreId) => {
  const response = await api.delete(`/favoris/${offreId}`);
  return response.data;
};
