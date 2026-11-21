// ============================================================
// src/screens/MotDePasseOublieScreen.js — Réinitialisation du
// mot de passe par code envoyé par email
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { demanderReinitialisation, reinitialiserMotDePasse } from '../api/client';
import { erreurMotDePasse } from '../utils/validation';

export default function MotDePasseOublieScreen({ navigation, route }) {
  const [etape, setEtape]           = useState(1); // 1 = email, 2 = code + nouveau mot de passe
  const [email, setEmail]           = useState(route.params?.email || '');
  const [code, setCode]             = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  const envoyerCode = async () => {
    if (!email.trim()) return Alert.alert('Email manquant', 'Saisis l\'email de ton compte.');
    setChargement(true);
    try {
      const resultat = await demanderReinitialisation(email.trim());
      Alert.alert('Vérifie tes emails', resultat.message);
      setEtape(2);
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.erreur || 'Impossible d\'envoyer le code. Réessaie.');
    } finally {
      setChargement(false);
    }
  };

  const valider = async () => {
    if (!/^\d{6}$/.test(code.trim())) return Alert.alert('Code incomplet', 'Saisis le code à 6 chiffres reçu par email.');
    const erreurMdp = erreurMotDePasse(motDePasse);
    if (erreurMdp) return Alert.alert('Mot de passe trop faible', erreurMdp);

    setChargement(true);
    try {
      const resultat = await reinitialiserMotDePasse(email.trim(), code.trim(), motDePasse);
      Alert.alert('C\'est fait !', resultat.message, [{ text: 'Se connecter', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.erreur || 'Code incorrect ou expiré.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.conteneur} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.corps} keyboardShouldPersistTaps="handled">
        {etape === 1 ? (
          <>
            <Text style={styles.titre}>Réinitialise ton mot de passe</Text>
            <Text style={styles.texte}>Saisis l'email de ton compte : on t'envoie un code à 6 chiffres.</Text>
            <TextInput
              style={styles.champ}
              placeholder="Email"
              placeholderTextColor={COLORS.texteClair}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            <TouchableOpacity style={[styles.bouton, chargement && styles.desactive]} onPress={envoyerCode} disabled={chargement}>
              {chargement ? <ActivityIndicator color="#fff" /> : <Text style={styles.texteBouton}>Recevoir le code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.titre}>Choisis un nouveau mot de passe</Text>
            <Text style={styles.texte}>Code envoyé à {email.trim()} (valable 10 minutes).</Text>
            <TextInput
              style={styles.champ}
              placeholder="Code à 6 chiffres"
              placeholderTextColor={COLORS.texteClair}
              value={code}
              onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
            <TextInput
              style={styles.champ}
              placeholder="Nouveau mot de passe (8 caractères, lettres et chiffres)"
              placeholderTextColor={COLORS.texteClair}
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <TouchableOpacity style={[styles.bouton, chargement && styles.desactive]} onPress={valider} disabled={chargement}>
              {chargement ? <ActivityIndicator color="#fff" /> : <Text style={styles.texteBouton}>Changer le mot de passe</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={envoyerCode} disabled={chargement} style={styles.lien}>
              <Text style={styles.texteLien}>Renvoyer un code</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur:   { flex: 1, backgroundColor: '#FAF7F0' },
  corps:       { padding: 24, gap: 14 },
  titre:       { fontSize: 22, fontWeight: '800', color: COLORS.primaireF },
  texte:       { fontSize: 14, color: COLORS.texteClair, lineHeight: 20 },
  champ:       {
    backgroundColor: COLORS.blanc, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bordure,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.texte,
  },
  bouton:      { backgroundColor: COLORS.primaire, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  desactive:   { opacity: 0.6 },
  texteBouton: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lien:        { alignItems: 'center', paddingVertical: 8 },
  texteLien:   { color: COLORS.primaire, fontWeight: '600' },
});
