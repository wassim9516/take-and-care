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

// -------------------------------------------------------
// INTERCEPTEUR — Ajoute automatiquement le token JWT
// à chaque requête si l'utilisateur est connecté
// -------------------------------------------------------
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// -------------------------------------------------------
// AUTH
// -------------------------------------------------------

export const inscription = async (prenom, nom, email, motDePasse) => {
  const response = await api.post('/auth/inscription', { prenom, nom, email, motDePasse });
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

export const getOffres = async (categorie = null) => {
  const params   = categorie ? { categorie } : {};
  const response = await api.get('/offers', { params });
  return response.data;
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

export const creerReservation = async (offreId) => {
  const response = await api.post('/reservations', { offreId });
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
