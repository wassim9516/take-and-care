// ============================================================
// src/screens/FavorisScreen.js — Mes offres favorites
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import OfferCard from '../components/OfferCard';
import { getMesFavoris } from '../api/client';
import { useFavoris } from '../context/FavorisContext';

export default function FavorisScreen({ navigation }) {
  const [offres, setOffres]           = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const { favorisIds, toggleFavori }  = useFavoris();

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [])
  );

  const charger = async () => {
    try {
      const data = await getMesFavoris();
      setOffres(data);
    } catch (err) {
      console.error('Erreur chargement favoris:', err);
      Alert.alert('Erreur', 'Impossible de charger tes favoris. Vérifie ta connexion.');
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  };

  // Retire l'offre de la liste si on la désfavorise depuis cet écran
  const handleToggle = async (offreId) => {
    await toggleFavori(offreId);
    setOffres(prev => prev.filter(o => o.id !== offreId));
  };

  if (chargement) {
    return (
      <View style={styles.centrer}>
        <ActivityIndicator size="large" color={COLORS.primaire} />
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Mes favoris</Text>
        <Text style={styles.sousTitre}>{offres.length} offre{offres.length !== 1 ? 's' : ''} sauvegardée{offres.length !== 1 ? 's' : ''}</Text>
      </View>

      {offres.length === 0 ? (
        <View style={styles.centrer}>
          <Ionicons name="heart-outline" size={56} color={COLORS.bordure} />
          <Text style={styles.texteVide}>Aucun favori pour l'instant</Text>
          <Text style={styles.texteClair}>Appuie sur ❤️ sur une offre pour la sauvegarder</Text>
        </View>
      ) : (
        <FlatList
          data={offres}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <OfferCard
              offre={item}
              estFavori={favorisIds.includes(item.id)}
              onToggleFavori={() => handleToggle(item.id)}
              onPress={() => navigation.navigate('OfferDetail', { offerId: item.id, offreData: item })}
            />
          )}
          contentContainerStyle={styles.liste}
          refreshControl={
            <RefreshControl refreshing={rafraichissement} onRefresh={() => { setRafraichissement(true); charger(); }} tintColor={COLORS.primaire} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.fondClair },
  entete: {
    backgroundColor: '#FAF7F0',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8DF',
  },
  titre: { fontSize: 24, fontWeight: '800', color: COLORS.primaireF, letterSpacing: 0.3 },
  sousTitre: { fontSize: 13, color: COLORS.texteClair, marginTop: 4 },
  liste: { paddingBottom: 20, paddingTop: 4 },
  centrer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  texteVide: { fontSize: 17, fontWeight: '600', color: COLORS.texte },
  texteClair: { color: COLORS.texteClair, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
