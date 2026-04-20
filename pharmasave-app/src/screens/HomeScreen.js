// ============================================================
// src/screens/HomeScreen.js — Écran principal (liste des offres)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Alert, TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import OfferCard from '../components/OfferCard';
import { getOffres } from '../api/client';
import { useFavoris } from '../context/FavorisContext';

// Filtres de catégorie — ajoute une entrée ici pour créer un nouveau filtre
const CATEGORIES = [
  { id: null,          label: 'Tout' },
  { id: 'soin_visage', label: 'Visage' },
  { id: 'soin_corps',  label: 'Corps' },
  { id: 'complement',  label: 'Compléments' },
  { id: 'bebe',        label: 'Bébé' },
  { id: 'solaire',     label: 'Solaire' },
];

export default function HomeScreen({ navigation, route }) {
  const { favorisIds, toggleFavori } = useFavoris();
  const [offres, setOffres]                     = useState([]);
  const [chargement, setChargement]             = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [categorieActive, setCategorieActive]   = useState(null);
  const [recherche, setRecherche]               = useState('');
  const [filtrePharmacieNom, setFiltrePharmacieNom] = useState(null);

  // Applique le filtre pharmacie si on arrive depuis la carte
  useEffect(() => {
    if (route.params?.pharmacieNom) {
      setFiltrePharmacieNom(route.params.pharmacieNom);
    }
  }, [route.params?.pharmacieNom]);

  // -------------------------------------------------------
  // Chargement des offres depuis l'API
  // -------------------------------------------------------
  const chargerOffres = useCallback(async () => {
    try {
      const data = await getOffres(categorieActive);
      setOffres(data);
    } catch {
      Alert.alert(
        'Connexion impossible',
        "Vérifie que le serveur backend est lancé et que l'IP dans config.js est correcte."
      );
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, [categorieActive]);

  useEffect(() => {
    setChargement(true);
    chargerOffres();
  }, [chargerOffres]);

  const onRefresh = () => {
    setRafraichissement(true);
    chargerOffres();
  };

  // -------------------------------------------------------
  // Filtrage local par recherche textuelle
  // Filtre sur le titre du panier ET le nom de la pharmacie
  // -------------------------------------------------------
  const offresFiltrees = offres.filter(o => {
    if (filtrePharmacieNom && (o.pharmacieNom || '') !== filtrePharmacieNom) return false;
    if (!recherche.trim()) return true;
    const terme = recherche.toLowerCase();
    return (
      o.titre.toLowerCase().includes(terme) ||
      (o.pharmacieNom || '').toLowerCase().includes(terme)
    );
  });

  const renderOffre = ({ item }) => (
    <OfferCard
      offre={item}
      estFavori={favorisIds.includes(item.id)}
      onToggleFavori={() => toggleFavori(item.id)}
      onPress={() => navigation.navigate('OfferDetail', { offerId: item.id })}
    />
  );

  return (
    <View style={styles.conteneur}>

      {/* ---- EN-TÊTE ---- */}
      <View style={styles.entete}>

        {/* Ligne logo + nom */}
        <View style={styles.ligneTitre}>
          <MaterialCommunityIcons name="clover" size={32} color={COLORS.primaireF} />
          <Text style={styles.titre}>Take & Care</Text>
        </View>

        <Text style={styles.sousTitre}>Luttez contre les prix et le gaspillage</Text>

        {/* ---- BARRE DE RECHERCHE ---- */}
        <View style={styles.conteneurRecherche}>
          <Ionicons name="search-outline" size={17} color={COLORS.texteClair} style={styles.iconeRecherche} />
          <TextInput
            style={styles.champRecherche}
            placeholder="Pharmacie, produit..."
            placeholderTextColor={COLORS.texteClair}
            value={recherche}
            onChangeText={setRecherche}    // Met à jour le filtre à chaque frappe
            returnKeyType="search"
            clearButtonMode="while-editing" // Bouton ✕ natif iOS
          />
          {/* Bouton effacer manuel (utile sur Android) */}
          {recherche.length > 0 && (
            <TouchableOpacity onPress={() => setRecherche('')}>
              <Ionicons name="close-circle" size={17} color={COLORS.texteClair} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ---- FILTRES PAR CATÉGORIE ---- */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => String(item.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listeFiltres}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.filtre, categorieActive === cat.id && styles.filtreActif]}
            onPress={() => setCategorieActive(cat.id)}
          >
            <Text style={[styles.texteFiltre, categorieActive === cat.id && styles.texteFiltreActif]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ---- BADGE FILTRE PHARMACIE ---- */}
      {filtrePharmacieNom && (
        <View style={styles.badgePharmacieConteneur}>
          <Ionicons name="storefront-outline" size={14} color={COLORS.primaire} />
          <Text style={styles.badgePharmacieTexte} numberOfLines={1}>{filtrePharmacieNom}</Text>
          <TouchableOpacity onPress={() => setFiltrePharmacieNom(null)}>
            <Ionicons name="close-circle" size={16} color={COLORS.primaire} />
          </TouchableOpacity>
        </View>
      )}

      {/* ---- COMPTEUR DE RÉSULTATS ---- */}
      {!chargement && (
        <Text style={styles.compteur}>
          {offresFiltrees.length} offre{offresFiltrees.length !== 1 ? 's' : ''} disponible{offresFiltrees.length !== 1 ? 's' : ''}
        </Text>
      )}

      {/* ---- LISTE DES OFFRES ---- */}
      {chargement ? (
        <View style={styles.centrer}>
          <ActivityIndicator size="large" color={COLORS.primaire} />
        </View>
      ) : offresFiltrees.length === 0 ? (
        <View style={styles.centrer}>
          <Ionicons name="leaf-outline" size={48} color={COLORS.bordure} />
          <Text style={styles.texteVide}>Aucune offre trouvée</Text>
          <Text style={styles.texteClair}>Essaie un autre mot-clé</Text>
        </View>
      ) : (
        <FlatList
          data={offresFiltrees}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOffre}
          contentContainerStyle={styles.listeOffres}
          refreshControl={
            <RefreshControl
              refreshing={rafraichissement}
              onRefresh={onRefresh}
              tintColor={COLORS.primaire}
            />
          }
        />
      )}

    </View>
  );
}

// -------------------------------------------------------
// Styles
// -------------------------------------------------------
const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: COLORS.fondClair,
  },

  // En-tête
  entete: {
    backgroundColor: '#FAF7F0',   // Beige clair
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8DF',
  },
  ligneTitre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  titre: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaireF,   // Vert forêt foncé
    letterSpacing: 0.3,
  },
  sousTitre: {
    fontSize: 13,
    color: COLORS.texteClair,
    marginBottom: 14,
  },

  // Barre de recherche
  conteneurRecherche: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blanc,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EDE8DF',
  },
  iconeRecherche: {
    marginRight: 8,
  },
  champRecherche: {
    flex: 1,
    fontSize: 15,
    color: COLORS.texte,
    padding: 0,
  },

  // Filtres
  listeFiltres: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filtre: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    marginRight: 8,
  },
  filtreActif: {
    backgroundColor: COLORS.primaire,
    borderColor: COLORS.primaire,
  },
  texteFiltre: {
    color: COLORS.texte,
    fontSize: 13,
    fontWeight: '500',
  },
  texteFiltreActif: {
    color: COLORS.blanc,
    fontWeight: '700',
  },

  // Badge filtre pharmacie
  badgePharmacieConteneur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: COLORS.primaire + '15',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgePharmacieTexte: {
    fontSize: 13,
    color: COLORS.primaire,
    fontWeight: '600',
    flex: 1,
  },

  // Compteur
  compteur: {
    fontSize: 12,
    color: COLORS.texteClair,
    paddingHorizontal: 20,
    marginBottom: 4,
    fontWeight: '500',
  },

  // Liste
  listeOffres: {
    paddingBottom: 20,
    paddingTop: 4,
  },

  // États vides / chargement
  centrer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  texteVide: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.texte,
  },
  texteClair: {
    color: COLORS.texteClair,
    fontSize: 14,
  },
});
