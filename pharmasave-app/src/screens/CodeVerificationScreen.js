// ============================================================
// src/screens/CodeVerificationScreen.js — Vérification SMS
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const NB_CHIFFRES = 6;

export default function CodeVerificationScreen({ route, navigation }) {
  const { telephone, apercu, onConfirmer } = route.params;

  const [chiffres, setChiffres]     = useState(Array(NB_CHIFFRES).fill(''));
  const [chargement, setChargement] = useState(false);
  const [compteur, setCompteur]     = useState(60); // Cooldown renvoi
  const refsInput = useRef([]);

  // Compte à rebours pour le bouton "Renvoyer"
  useEffect(() => {
    if (compteur <= 0) return;
    const t = setTimeout(() => setCompteur(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [compteur]);

  // Focus automatique sur la première case
  useEffect(() => {
    setTimeout(() => refsInput.current[0]?.focus(), 400);
  }, []);

  const handleChange = (index, valeur) => {
    // Gère le cas du copier-coller d'un code complet
    if (valeur.length > 1) {
      const digits = valeur.replace(/\D/g, '').slice(0, NB_CHIFFRES).split('');
      const nouveau = [...chiffres];
      digits.forEach((d, i) => { if (index + i < NB_CHIFFRES) nouveau[index + i] = d; });
      setChiffres(nouveau);
      const dernierIndex = Math.min(index + digits.length, NB_CHIFFRES - 1);
      refsInput.current[dernierIndex]?.focus();
      return;
    }

    const nouveau = [...chiffres];
    nouveau[index] = valeur.replace(/\D/g, '');
    setChiffres(nouveau);

    if (valeur && index < NB_CHIFFRES - 1) {
      refsInput.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (index, valeur) => {
    if (!valeur && index > 0) {
      const nouveau = [...chiffres];
      nouveau[index - 1] = '';
      setChiffres(nouveau);
      refsInput.current[index - 1]?.focus();
    }
  };

  const handleVerifier = async () => {
    const code = chiffres.join('');
    if (code.length < NB_CHIFFRES) {
      Alert.alert('Code incomplet', 'Saisis les 6 chiffres du code reçu par SMS.');
      return;
    }
    setChargement(true);
    try {
      await onConfirmer(telephone, code);
      // Si succès : AuthContext met à jour → App redirige automatiquement
    } catch (err) {
      const message = err?.response?.data?.erreur || 'Code incorrect ou expiré.';
      Alert.alert('Erreur', message);
      // Vide le code pour resaisie
      setChiffres(Array(NB_CHIFFRES).fill(''));
      refsInput.current[0]?.focus();
    } finally {
      setChargement(false);
    }
  };

  const handleRenvoyer = async () => {
    if (compteur > 0) return;
    try {
      await route.params.onRenvoyer();
      setCompteur(60);
      setChiffres(Array(NB_CHIFFRES).fill(''));
      refsInput.current[0]?.focus();
      Alert.alert('Code renvoyé', 'Un nouveau code a été envoyé par SMS.');
    } catch {
      Alert.alert('Erreur', 'Impossible de renvoyer le code.');
    }
  };

  const codeComplet = chiffres.every(c => c !== '');

  return (
    <KeyboardAvoidingView
      style={styles.conteneur}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.corps}>

        {/* Bouton retour */}
        <TouchableOpacity style={styles.boutonRetour} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.primaireF} />
        </TouchableOpacity>

        {/* En-tête */}
        <View style={styles.entete}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.titre}>Vérifie ton numéro</Text>
          <Text style={styles.description}>
            On a envoyé un code à 6 chiffres au
          </Text>
          <Text style={styles.telephone}>{apercu || telephone}</Text>
        </View>

        {/* Cases de saisie OTP */}
        <View style={styles.casesConteneur}>
          {chiffres.map((chiffre, i) => (
            <TextInput
              key={i}
              ref={(el) => { refsInput.current[i] = el; }}
              style={[
                styles.case,
                chiffre ? styles.caseRemplie : {},
                i === chiffres.findIndex(c => c === '') ? styles.caseFocus : {},
              ]}
              value={chiffre}
              onChangeText={v => handleChange(i, v)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace') handleBackspace(i, chiffre);
              }}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {/* Bouton vérifier */}
        <TouchableOpacity
          style={[styles.boutonVerifier, (!codeComplet || chargement) && styles.boutonDesactive]}
          onPress={handleVerifier}
          disabled={!codeComplet || chargement}
        >
          {chargement
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.texteBouton}>Confirmer mon compte</Text>
          }
        </TouchableOpacity>

        {/* Renvoyer le code */}
        <TouchableOpacity
          style={styles.boutonRenvoyer}
          onPress={handleRenvoyer}
          disabled={compteur > 0}
        >
          <Text style={[styles.texteRenvoyer, compteur > 0 && styles.texteRenvoyerDesactive]}>
            {compteur > 0
              ? `Renvoyer le code dans ${compteur}s`
              : 'Renvoyer le code'
            }
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: '#FAF7F0',
  },
  corps: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
  },
  boutonRetour: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.blanc,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.bordure,
    marginBottom: 32,
  },
  entete: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  titre: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primaireF,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: COLORS.texteClair,
    textAlign: 'center',
  },
  telephone: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaire,
    marginTop: 4,
    textAlign: 'center',
  },

  // Cases OTP
  casesConteneur: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 36,
  },
  case: {
    width: 48,
    height: 60,
    borderRadius: 14,
    backgroundColor: COLORS.blanc,
    borderWidth: 1.5,
    borderColor: COLORS.bordure,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaireF,
  },
  caseRemplie: {
    borderColor: COLORS.primaire,
    backgroundColor: '#F0F9F4',
  },
  caseFocus: {
    borderColor: COLORS.primaire,
    borderWidth: 2,
  },

  // Boutons
  boutonVerifier: {
    backgroundColor: COLORS.primaire,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 16,
  },
  boutonDesactive: {
    opacity: 0.45,
  },
  texteBouton: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  boutonRenvoyer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  texteRenvoyer: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaire,
    textDecorationLine: 'underline',
  },
  texteRenvoyerDesactive: {
    color: COLORS.texteClair,
    textDecorationLine: 'none',
  },
});
