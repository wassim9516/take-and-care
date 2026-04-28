// ============================================================
// src/screens/HomeScreen.js — Écran principal (liste des offres)
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Alert, TextInput, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS } from '../constants/colors';
import OfferCard from '../components/OfferCard';
import { getOffres } from '../api/client';
import { useFavoris } from '../context/FavorisContext';

const CATEGORIES = [
  { id: null,          label: 'Tout' },
  { id: 'soin_visage', label: 'Visage' },
  { id: 'soin_corps',  label: 'Corps' },
  { id: 'complement',  label: 'Compléments' },
  { id: 'bebe',        label: 'Bébé' },
  { id: 'solaire',     label: 'Solaire' },
];

const PRIX_MAX_OPTIONS = [
  { label: 'Tout', valeur: null },
  { label: ' -10€', valeur: 10 },
  { label: ' -15€', valeur: 15 },
  { label: ' -20€', valeur: 20 },
];

const TRIS = [
  { id: 'recent',   label: 'Récent',   icone: 'time-outline' },
  { id: 'distance', label: 'Distance', icone: 'location-outline' },
  { id: 'prix',     label: 'Prix ↑',   icone: 'pricetag-outline' },
];

// Formule Haversine — distance en km entre deux coordonnées GPS
function calculerDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export default function HomeScreen({ navigation, route }) {
  const { favorisIds, toggleFavori } = useFavoris();

  const [offres, setOffres]                         = useState([]);
  const [chargement, setChargement]                 = useState(true);
  const [chargementPlus, setChargementPlus]         = useState(false);
  const [rafraichissement, setRafraichissement]     = useState(false);
  const [categorieActive, setCategorieActive]       = useState(null);
  const [recherche, setRecherche]                   = useState('');
  const [filtrePharmacieNom, setFiltrePharmacieNom] = useState(null);
  const [tri, setTri]                               = useState('recent');
  const [maxPrix, setMaxPrix]                       = useState(null);
  const [position, setPosition]                     = useState(null);
  const [hasMore, setHasMore]                       = useState(false);
  const [horsLigne, setHorsLigne]                   = useState(false);
  const offsetRef                                   = useRef(0);
  const LIMITE                                      = 20;

  // Récupère la dernière position connue (silencieux, pas de prompt)
  useEffect(() => {
    Location.getLastKnownPositionAsync().then(loc => {
      if (loc?.coords) setPosition(loc.coords);
    }).catch(() => {});
  }, []);

  // Si l'utilisateur veut trier par distance et qu'on n'a pas la position, on demande
  const handleTri = async (id) => {
    if (id === 'distance' && !position) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        if (loc?.coords) setPosition(loc.coords);
      } else {
        Alert.alert('Permission refusée', 'Active la localisation pour trier par distance.');
        return;
      }
    }
    setTri(id);
  };

  // Filtre pharmacie depuis la carte
  useEffect(() => {
    if (route.params?.pharmacieNom) {
      setFiltrePharmacieNom(route.params.pharmacieNom);
    }
  }, [route.params?.pharmacieNom]);

  const chargerOffres = useCallback(async (offset = 0) => {
    try {
      const data = await getOffres(categorieActive, offset, LIMITE);
      const nouvelles = data.offres ?? data;
      if (offset === 0) {
        setOffres(nouvelles);
        await AsyncStorage.setItem('cache_offres', JSON.stringify(nouvelles));
      } else {
        setOffres(prev => [...prev, ...nouvelles]);
      }
      setHasMore(data.hasMore ?? false);
      setHorsLigne(false);
    } catch {
      if (offset === 0) {
        const cache = await AsyncStorage.getItem('cache_offres');
        if (cache) {
          setOffres(JSON.parse(cache));
          setHorsLigne(true);
        } else {
          Alert.alert(
            'Connexion impossible',
            "Vérifie que le serveur backend est lancé et que l'IP dans config.js est correcte."
          );
        }
      }
    } finally {
      setChargement(false);
      setRafraichissement(false);
      setChargementPlus(false);
    }
  }, [categorieActive]);

  useEffect(() => {
    offsetRef.current = 0;
    setHasMore(false);
    setChargement(true);
    chargerOffres(0);
  }, [chargerOffres]);

  const onRefresh = () => {
    offsetRef.current = 0;
    setRafraichissement(true);
    chargerOffres(0);
  };

  const chargerPlus = () => {
    if (chargementPlus || !hasMore) return;
    const nouvelOffset = offsetRef.current + LIMITE;
    offsetRef.current = nouvelOffset;
    setChargementPlus(true);
    chargerOffres(nouvelOffset);
  };

  // -------------------------------------------------------
  // Filtrage + tri
  // -------------------------------------------------------
  const offresFiltrees = offres
    .filter(o => {
      if (filtrePharmacieNom && (o.pharmacieNom || '') !== filtrePharmacieNom) return false;
      if (maxPrix !== null && o.prixReduit > maxPrix) return false;
      if (!recherche.trim()) return true;
      const terme = recherche.toLowerCase();
      return (
        o.titre.toLowerCase().includes(terme) ||
        (o.pharmacieNom || '').toLowerCase().includes(terme)
      );
    })
    .map(o => ({
      ...o,
      distance: calculerDistance(
        position?.latitude, position?.longitude,
        o.pharmacieLat, o.pharmacieLng
      ),
    }))
    .sort((a, b) => {
      if (tri === 'prix')     return a.prixReduit - b.prixReduit;
      if (tri === 'distance') {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      }
      return 0; // 'recent' : déjà trié par le backend
    });

  const renderOffre = ({ item }) => (
    <OfferCard
      offre={item}
      estFavori={favorisIds.includes(item.id)}
      onToggleFavori={() => toggleFavori(item.id)}
      onPress={() => navigation.navigate('OfferDetail', { offerId: item.id })}
    />
  );

  const nbFiltresActifs = (maxPrix !== null ? 1 : 0) + (tri !== 'recent' ? 1 : 0);

  return (
    <View style={styles.conteneur}>

      {/* ---- EN-TÊTE ---- */}
      <View style={styles.entete}>
        <View style={styles.ligneTitre}>
          <MaterialCommunityIcons name="clover" size={32} color={COLORS.primaireF} />
          <Text style={styles.titre}>Take & Care</Text>
        </View>
        <Text style={styles.sousTitre}>Luttez contre les prix et le gaspillage</Text>

        <View style={styles.conteneurRecherche}>
          <Ionicons name="search-outline" size={17} color={COLORS.texteClair} style={styles.iconeRecherche} />
          <TextInput
            style={styles.champRecherche}
            placeholder="Pharmacie, produit..."
            placeholderTextColor={COLORS.texteClair}
            value={recherche}
            onChangeText={setRecherche}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {recherche.length > 0 && (
            <TouchableOpacity onPress={() => setRecherche('')}>
              <Ionicons name="close-circle" size={17} color={COLORS.texteClair} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ---- FILTRES PAR CATÉGORIE ---- */}
      <View style={styles.conteneurFiltres}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={String(cat.id)}
            style={[styles.filtre, categorieActive === cat.id && styles.filtreActif]}
            onPress={() => setCategorieActive(cat.id)}
          >
            <Text style={[styles.texteFiltre, categorieActive === cat.id && styles.texteFiltreActif]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ---- TRI + FILTRE PRIX ---- */}
      <View style={styles.barreOptions}>
        {/* Tri */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.groupeOptions}>
            <Text style={styles.labelOption}>Trier :</Text>
            {TRIS.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.pillOption, tri === t.id && styles.pillOptionActif]}
                onPress={() => handleTri(t.id)}
              >
                <Ionicons
                  name={t.icone}
                  size={12}
                  color={tri === t.id ? COLORS.blanc : COLORS.texteClair}
                />
                <Text style={[styles.textePill, tri === t.id && styles.textePillActif]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.separateurPill} />

            <Text style={styles.labelOption}>Prix :</Text>
            {PRIX_MAX_OPTIONS.map(p => (
              <TouchableOpacity
                key={String(p.valeur)}
                style={[styles.pillOption, maxPrix === p.valeur && styles.pillOptionActif]}
                onPress={() => setMaxPrix(p.valeur)}
              >
                <Text style={[styles.textePill, maxPrix === p.valeur && styles.textePillActif]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Bouton reset si filtres actifs */}
        {nbFiltresActifs > 0 && (
          <TouchableOpacity
            style={styles.boutonReset}
            onPress={() => { setTri('recent'); setMaxPrix(null); }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

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

      {/* ---- BANNIÈRE HORS-LIGNE ---- */}
      {horsLigne && (
        <View style={styles.banniereHorsLigne}>
          <Ionicons name="cloud-offline-outline" size={14} color="#92400e" />
          <Text style={styles.texteHorsLigne}>Mode hors-ligne — données en cache</Text>
        </View>
      )}

      {/* ---- COMPTEUR ---- */}
      {!chargement && (
        <Text style={styles.compteur}>
          {offresFiltrees.length} offre{offresFiltrees.length !== 1 ? 's' : ''}
          {tri === 'distance' && position ? ' · triées par distance' : ''}
          {tri === 'prix' ? ' · triées par prix' : ''}
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
          <Text style={styles.texteClair}>Essaie un autre filtre</Text>
        </View>
      ) : (
        <FlatList
          data={offresFiltrees}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOffre}
          contentContainerStyle={styles.listeOffres}
          refreshControl={
            <RefreshControl refreshing={rafraichissement} onRefresh={onRefresh} tintColor={COLORS.primaire} />
          }
          onEndReached={chargerPlus}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            chargementPlus ? (
              <ActivityIndicator size="small" color={COLORS.primaire} style={{ marginVertical: 16 }} />
            ) : hasMore ? (
              <TouchableOpacity style={styles.boutonChargerPlus} onPress={chargerPlus}>
                <Text style={styles.texteChargerPlus}>Charger plus d'offres</Text>
              </TouchableOpacity>
            ) : null
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
  ligneTitre: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  titre: { fontSize: 24, fontWeight: '800', color: COLORS.primaireF, letterSpacing: 0.3 },
  sousTitre: { fontSize: 13, color: COLORS.texteClair, marginBottom: 14 },

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
  iconeRecherche: { marginRight: 8 },
  champRecherche: { flex: 1, fontSize: 15, color: COLORS.texte, padding: 0 },

  conteneurFiltres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  filtre: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  filtreActif: { backgroundColor: COLORS.primaire, borderColor: COLORS.primaire },
  texteFiltre: { color: COLORS.texte, fontSize: 13, fontWeight: '500' },
  texteFiltreActif: { color: COLORS.blanc, fontWeight: '700' },

  // Barre tri + prix
  barreOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8DF',
    backgroundColor: '#FAF7F0',
  },
  groupeOptions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  labelOption: { fontSize: 11, fontWeight: '700', color: COLORS.texteClair, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  pillOptionActif: { backgroundColor: COLORS.primaire, borderColor: COLORS.primaire },
  textePill: { fontSize: 12, fontWeight: '600', color: COLORS.texteClair },
  textePillActif: { color: COLORS.blanc },
  separateurPill: { width: 1, height: 16, backgroundColor: COLORS.bordure, marginHorizontal: 4 },
  boutonReset: { padding: 6 },

  badgePharmacieConteneur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: COLORS.primaire + '15',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgePharmacieTexte: { fontSize: 13, color: COLORS.primaire, fontWeight: '600', flex: 1 },

  compteur: { fontSize: 12, color: COLORS.texteClair, paddingHorizontal: 20, paddingTop: 8, marginBottom: 2, fontWeight: '500' },
  listeOffres: { paddingBottom: 20, paddingTop: 4 },

  centrer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  texteVide: { fontSize: 17, fontWeight: '600', color: COLORS.texte },
  texteClair: { color: COLORS.texteClair, fontSize: 14 },
  banniereHorsLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  texteHorsLigne: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  boutonChargerPlus: {
    alignItems: 'center', paddingVertical: 14, marginHorizontal: 20,
    marginBottom: 8, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.bordure, backgroundColor: COLORS.blanc,
  },
  texteChargerPlus: { fontSize: 14, fontWeight: '600', color: COLORS.primaire },
});
