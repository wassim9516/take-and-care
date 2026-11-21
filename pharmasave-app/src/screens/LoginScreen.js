// ============================================================
// src/screens/LoginScreen.js — Connexion / Inscription
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { LIENS_LEGAUX } from '../config';
import { erreurMotDePasse } from '../utils/validation';

export default function LoginScreen({ navigation }) {
  const [mode, setMode]               = useState('connexion');
  const [prenom, setPrenom]           = useState('');
  const [nom, setNom]                 = useState('');
  const [email, setEmail]             = useState('');
  const [telephone, setTelephone]     = useState('');
  const [motDePasse, setMotDePasse]   = useState('');
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [chargement, setChargement]   = useState(false);

  const { seConnecter, demanderCodeSMS } = useAuth();

  const handleSubmit = async () => {
    if (!email.trim() || !motDePasse.trim()) {
      return Alert.alert('Champs manquants', 'Email et mot de passe sont obligatoires.');
    }

    if (mode === 'connexion') {
      setChargement(true);
      try {
        await seConnecter(email.trim(), motDePasse);
      } catch (err) {
        Alert.alert('Erreur', err.response?.data?.erreur || 'Email ou mot de passe incorrect.');
      } finally {
        setChargement(false);
      }
      return;
    }

    // Mode inscription
    if (!prenom.trim() || !nom.trim()) {
      return Alert.alert('Champs manquants', 'Prénom et nom sont obligatoires.');
    }
    if (!telephone.trim()) {
      return Alert.alert('Champs manquants', 'Le numéro de téléphone est obligatoire.');
    }
    const erreurMdp = erreurMotDePasse(motDePasse);
    if (erreurMdp) return Alert.alert('Mot de passe trop faible', erreurMdp);

    setChargement(true);
    try {
      const result = await demanderCodeSMS(
        prenom.trim(), nom.trim(), email.trim(), motDePasse, telephone.trim()
      );
      // Navigue vers l'écran de vérification
      navigation.navigate('Verification', {
        telephone: telephone.trim(),
        apercu:    result.apercu,
      });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.erreur || 'Une erreur est survenue.');
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

        <View style={styles.entete}>
          <MaterialCommunityIcons name="clover" size={60} color={COLORS.primaire} />
          <Text style={styles.titre}>Take & Care</Text>
          <Text style={styles.sousTitre}>Luttez contre les prix et le gaspillage</Text>
        </View>

        <View style={styles.onglets}>
          {['connexion', 'inscription'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.onglet, mode === m && styles.ongletActif]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.texteOnglet, mode === m && styles.texteOngletActif]}>
                {m === 'connexion' ? 'Connexion' : 'Inscription'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.formulaire}>

          {/* Champs inscription seulement */}
          {mode === 'inscription' && (
            <>
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
              <TextInput
                style={styles.champ}
                placeholder="Téléphone (ex: 06 12 34 56 78)"
                placeholderTextColor={COLORS.texteClair}
                value={telephone}
                onChangeText={setTelephone}
                keyboardType="phone-pad"
              />
            </>
          )}

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
            <TouchableOpacity onPress={() => setAfficherMdp(!afficherMdp)}>
              <MaterialCommunityIcons
                name={afficherMdp ? 'eye-off' : 'eye'}
                size={20}
                color={COLORS.texteClair}
              />
            </TouchableOpacity>
          </View>

          {mode === 'inscription' && (
            <Text style={styles.noteVerification}>
              📱 Un code de vérification sera envoyé par SMS
            </Text>
          )}

          {mode === 'connexion' && (
            <TouchableOpacity onPress={() => navigation.navigate('MotDePasseOublie', { email: email.trim() })}>
              <Text style={styles.lienOubli}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.bouton, chargement && styles.boutonDesactive]}
            onPress={handleSubmit}
            disabled={chargement}
          >
            {chargement
              ? <ActivityIndicator color={COLORS.blanc} />
              : <Text style={styles.texteBouton}>
                  {mode === 'connexion' ? 'Se connecter' : 'Recevoir le code SMS →'}
                </Text>
            }
          </TouchableOpacity>

          {mode === 'inscription' && (
            <Text style={styles.texteLegal}>
              En créant un compte, tu acceptes les{' '}
              <Text style={styles.lienLegal} onPress={() => Linking.openURL(LIENS_LEGAUX.cgu)}>conditions générales</Text>
              {' '}et la{' '}
              <Text style={styles.lienLegal} onPress={() => Linking.openURL(LIENS_LEGAUX.confidentialite)}>politique de confidentialité</Text>.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  lienOubli: {
    color: COLORS.primaire,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -4,
  },
  texteLegal: {
    color: COLORS.texteClair,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  lienLegal: {
    color: COLORS.primaire,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  conteneur: { flex: 1, backgroundColor: '#FAF7F0' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  entete: { alignItems: 'center', marginBottom: 36 },
  titre: { fontSize: 28, fontWeight: '800', color: COLORS.primaireF, marginTop: 12 },
  sousTitre: { fontSize: 14, color: COLORS.texteClair, marginTop: 4 },
  onglets: {
    flexDirection: 'row',
    backgroundColor: COLORS.blanc,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  onglet: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  ongletActif: { backgroundColor: COLORS.primaire },
  texteOnglet: { fontSize: 15, fontWeight: '600', color: COLORS.texteClair },
  texteOngletActif: { color: COLORS.blanc },
  formulaire: { gap: 12 },
  ligneChamps: { flexDirection: 'row', gap: 12 },
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
  inputMdp: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.texte },
  noteVerification: {
    fontSize: 13,
    color: COLORS.primaire,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 4,
  },
  bouton: {
    backgroundColor: COLORS.primaire,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonDesactive: { opacity: 0.6 },
  texteBouton: { color: COLORS.blanc, fontSize: 16, fontWeight: 'bold' },
});
