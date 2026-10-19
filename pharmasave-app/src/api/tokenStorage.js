// ============================================================
// src/api/tokenStorage.js — Stockage sécurisé du token JWT
// ============================================================
// Le token est gardé dans le trousseau iOS / Keystore Android
// (expo-secure-store) et non dans AsyncStorage, qui n'est pas chiffré.
// Les anciens tokens AsyncStorage sont migrés à la première lecture.
// ============================================================

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE = 'token';

export async function lireToken() {
  const token = await SecureStore.getItemAsync(CLE);
  if (token) return token;

  // Migration depuis l'ancien stockage non chiffré
  const ancien = await AsyncStorage.getItem(CLE);
  if (ancien) {
    await SecureStore.setItemAsync(CLE, ancien);
    await AsyncStorage.removeItem(CLE);
  }
  return ancien;
}

export async function enregistrerToken(token) {
  await SecureStore.setItemAsync(CLE, token);
}

export async function supprimerToken() {
  await SecureStore.deleteItemAsync(CLE);
  await AsyncStorage.removeItem(CLE);
}
