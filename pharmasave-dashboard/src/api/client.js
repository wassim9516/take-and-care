// ============================================================
// src/api/client.js — Requêtes vers le backend
// ============================================================

import axios from 'axios';
import { CONFIG } from '../config';

const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 8000,
});

// Ajoute automatiquement le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token_pharmacien');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// -------------------------------------------------------
// AUTH PHARMACIEN
// -------------------------------------------------------
export const connexionPharmacien = async (email, motDePasse) => {
  const response = await api.post('/auth/connexion', { email, motDePasse });
  return response.data;
};

// -------------------------------------------------------
// OFFRES
// -------------------------------------------------------
export const getOffresPharmacien = async (pharmacieId) => {
  const response = await api.get(`/offers/pharmacie/${pharmacieId}`);
  return response.data;
};

export const creerOffre = async (data) => {
  const response = await api.post('/offers', data);
  return response.data;
};

export const modifierOffre = async (id, data) => {
  const response = await api.put(`/offers/${id}`, data);
  return response.data;
};

export const supprimerOffre = async (id) => {
  const response = await api.delete(`/offers/${id}`);
  return response.data;
};

// -------------------------------------------------------
// RÉSERVATIONS
// -------------------------------------------------------
export const getReservationsPharmacien = async (pharmacieId) => {
  const response = await api.get(`/reservations/pharmacie/${pharmacieId}`);
  return response.data;
};

export const marquerReservationRetiree = async (id) => {
  const response = await api.patch(`/reservations/${id}/statut`);
  return response.data;
};

export const uploadImage = async (fichier) => {
  const formData = new FormData();
  formData.append('image', fichier);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
};
