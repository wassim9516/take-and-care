// ============================================================
// src/screens/LoginScreen.js — Connexion / Inscription
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  // Bascule entre "connexion" et "inscription"
  const [mode, setMode]             = useState('connexion');

  // Champs du formulaire
  const [prenom, setPrenom]         = useState('');
  const [nom, setNom]               = useState('');
  const [email, setEmail]           = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [chargement, setChargement] = useState(false);

  const { seConnecter, sInscrire } = useAuth();

  // -------------------------------------------------------
  // Soumission du formulaire
  // -------------------------------------------------------
  const handleSubmit = async () => {
    // Validation basique
    if (!email.trim() || !motDePasse.trim()) {
      return Alert.alert('Champs manquants', 'Email et mot de passe sont obligatoires.');
    }
    if (mode === 'inscription' && (!prenom.trim() || !nom.trim())) {
      return Alert.alert('Champs manquants', 'Prénom et nom sont obligatoires.');
    }

    setChargement(true);
    try {
      if (mode === 'connexion') {
        await seConnecter(email.trim(), motDePasse);
      } else {
        await sInscrire(prenom.trim(), nom.trim(), email.trim(), motDePasse);
      }
      // Si succès : App.js redirige automatiquement vers l'app principale
    } catch (err) {
      const message = err.response?.data?.erreur || 'Une erreur est survenue.';
      Alert.alert('Erreur', message);
    } finally {
      setChargement(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo + Titre */}
        <View style={styles.entete}>
          <MaterialCommunityIcons name="clover" size={60} color={COLORS.primaire} />
          <Text style={styles.titre}>Take & Care</Text>
          <Text style={styles.sousTitre}>Luttez contre les prix et le gaspillage</Text>
        </View>

        {/* Onglets Connexion / Inscription */}
        <View style={styles.onglets}>
          <TouchableOpacity
            style={[styles.onglet, mode === 'connexion' && styles.ongletActif]}
            onPress={() => setMode('connexion')}
          >
            <Text style={[styles.texteOnglet, mode === 'connexion' && styles.texteOngletActif]}>
              Connexion
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.onglet, mode === 'inscription' && styles.ongletActif]}
            onPress={() => setMode('inscription')}
          >
            <Text style={[styles.texteOnglet, mode === 'inscription' && styles.texteOngletActif]}>
              Inscription
            </Text>
          </TouchableOpacity>
        </View>

        {/* Formulaire */}
        <View style={styles.formulaire}>

          {/* Champs prénom + nom (inscription seulement) */}
          {mode === 'inscription' && (
            <View style={styles.ligneChamps}>
              <TextInput
                style={[styles.champ, { flex: 1 }]}
                placeholder="Prénom"
                placeholderTextColor={COLORS.texteClair}
                value={prenom}
                onChangeText={setPrenom}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.champ, { flex: 1 }]}
                placeholder="Nom"
                placeholderTextColor={COLORS.texteClair}
                value={nom}
                onChangeText={setNom}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* Email */}
          <TextInput
            style={styles.champ}
            placeholder="Email"
            placeholderTextColor={COLORS.texteClair}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Mot de passe */}
          <View style={styles.champMdp}>
            <TextInput
              style={styles.inputMdp}
              placeholder="Mot de passe"
              placeholderTextColor={COLORS.texteClair}
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry={!afficherMdp}
              autoCapitalize="none"
            />
            {/* Bouton afficher/masquer le mot de passe */}
            <TouchableOpacity onPress={() => setAfficherMdp(!afficherMdp)}>
              <MaterialCommunityIcons
                name={afficherMdp ? 'eye-off' : 'eye'}
                size={20}
                color={COLORS.texteClair}
              />
            </TouchableOpacity>
          </View>

          {/* Bouton principal */}
          <TouchableOpacity
            style={[styles.bouton, chargement && styles.boutonDesactive]}
            onPress={handleSubmit}
            disabled={chargement}
          >
            {chargement
              ? <ActivityIndicator color={COLORS.blanc} />
              : <Text style={styles.texteBouton}>
                  {mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
                </Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  entete: {
    alignItems: 'center',
    marginBottom: 36,
  },
  titre: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primaireF,
    marginTop: 12,
  },
  sousTitre: {
    fontSize: 14,
    color: COLORS.texteClair,
    marginTop: 4,
  },
  onglets: {
    flexDirection: 'row',
    backgroundColor: COLORS.blanc,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  onglet: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  ongletActif: {
    backgroundColor: COLORS.primaire,
  },
  texteOnglet: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.texteClair,
  },
  texteOngletActif: {
    color: COLORS.blanc,
  },
  formulaire: {
    gap: 12,
  },
  ligneChamps: {
    flexDirection: 'row',
    gap: 12,
  },
  champ: {
    backgroundColor: COLORS.blanc,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.texte,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  champMdp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blanc,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  inputMdp: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.texte,
  },
  bouton: {
    backgroundColor: COLORS.primaire,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonDesactive: {
    opacity: 0.6,
  },
  texteBouton: {
    color: COLORS.blanc,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
