// ============================================================
// src/screens/OnboardingScreen.js — Slides de bienvenue
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '🍀',
    titre: 'Bienvenue sur\nTake & Care',
    description: 'Réservez des paniers beauté et santé à prix réduits dans les pharmacies proches de chez vous.',
    fond: '#E8F5EE',
    couleurAccent: COLORS.primaire,
  },
  {
    id: '2',
    emoji: '🗺️',
    titre: 'Trouvez vos\npharmacies',
    description: 'Explorez la carte pour découvrir les pharmacies partenaires et leurs offres du moment, près de chez vous.',
    fond: '#EEF3FF',
    couleurAccent: '#3498DB',
  },
  {
    id: '3',
    emoji: '🛍️',
    titre: 'Réservez en\nquelques secondes',
    description: 'Choisissez votre panier, réservez, et récupérez-le à la pharmacie. Simple, rapide, et malin !',
    fond: '#FFF8EE',
    couleurAccent: '#E67E22',
  },
];

export default function OnboardingScreen({ onTerminer }) {
  const [indexActuel, setIndexActuel] = useState(0);
  const flatListRef = useRef(null);

  const allerSlide = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setIndexActuel(index);
  };

  const suivant = () => {
    if (indexActuel < SLIDES.length - 1) {
      allerSlide(indexActuel + 1);
    } else {
      onTerminer();
    }
  };

  const renderSlide = ({ item }) => (
    <View style={[styles.slide, { backgroundColor: item.fond, width }]}>
      <View style={styles.slideCorps}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={styles.titreSlidePre}>{item.titre}</Text>
        <Text style={styles.descriptionSlide}>{item.description}</Text>
      </View>
    </View>
  );

  const slide = SLIDES[indexActuel];

  return (
    <View style={styles.conteneur}>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={item => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      />

      {/* Pied de page fixe */}
      <View style={styles.piedPage}>

        {/* Indicateurs de progression */}
        <View style={styles.indicateurs}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => allerSlide(i)}>
              <View style={[
                styles.point,
                i === indexActuel && { ...styles.pointActif, backgroundColor: slide.couleurAccent },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Boutons */}
        <View style={styles.ligneBoutons}>
          {indexActuel < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity style={styles.boutonPasser} onPress={onTerminer}>
                <Text style={styles.textePasser}>Passer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.boutonSuivant, { backgroundColor: slide.couleurAccent }]}
                onPress={suivant}
              >
                <Text style={styles.texteSuivant}>Suivant</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.boutonCommencer, { backgroundColor: slide.couleurAccent }]}
              onPress={onTerminer}
            >
              <Text style={styles.texteCommencer}>Commencer</Text>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#fff' },

  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  slideCorps: { alignItems: 'center', gap: 20 },

  emoji: { fontSize: 80, marginBottom: 8 },

  titreSlidePre: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primaireF,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  descriptionSlide: {
    fontSize: 16,
    color: COLORS.texteClair,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },

  piedPage: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 20,
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.bordure,
  },

  indicateurs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  point: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.bordure,
  },
  pointActif: {
    width: 24,
    borderRadius: 4,
  },

  ligneBoutons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  boutonPasser: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.bordure,
    alignItems: 'center',
  },
  textePasser: { fontSize: 16, fontWeight: '600', color: COLORS.texteClair },

  boutonSuivant: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  texteSuivant: { fontSize: 16, fontWeight: '700', color: '#fff' },

  boutonCommencer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  texteCommencer: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
