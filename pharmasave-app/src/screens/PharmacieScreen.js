// ============================================================
// src/screens/PharmacieScreen.js — Fiche détail d'une pharmacie
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Linking, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { getPharmacie } from '../api/client';
import OfferCard from '../components/OfferCard';
import { useFavoris } from '../context/FavorisContext';

export default function PharmacieScreen({ navigation, route }) {
  const { pharmacie: pharmacieBase } = route.params;
  const { favorisIds, toggleFavori }  = useFavoris();

  // On part des données déjà reçues (depuis la carte) et on enrichit avec les offres
  const [pharmacie, setPharmacie]   = useState(pharmacieBase);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    chargerDetails();
  }, []);

  const chargerDetails = async () => {
    try {
      const data = await getPharmacie(pharmacieBase.id);
      setPharmacie(data);
    } catch {
      // On garde les données de base si l'appel échoue
    } finally {
      setChargement(false);
    }
  };

  // -------------------------------------------------------
  // Actions natives
  // -------------------------------------------------------
  const appelTelephone = () => {
    const url = `tel:${pharmacie.telephone}`;
    Linking.canOpenURL(url).then(ok => {
      if (ok) Linking.openURL(url);
      else Alert.alert('Erreur', "Impossible d'ouvrir le téléphone.");
    });
  };

  const ouvrirCarte = () => {
    const adresse = encodeURIComponent(pharmacie.adresse);
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${adresse}`
      : `https://maps.google.com/?q=${adresse}`;
    Linking.openURL(url);
  };

  const ouvrirSite = () => {
    if (pharmacie.siteWeb) Linking.openURL(pharmacie.siteWeb);
  };

  // -------------------------------------------------------
  // Composant étoiles
  // -------------------------------------------------------
  const renderEtoiles = (note) =>
    [1, 2, 3, 4, 5].map(i => (
      <Ionicons
        key={i}
        name={i <= Math.round(note || 0) ? 'star' : 'star-outline'}
        size={14}
        color="#F1C40F"
        style={{ marginRight: 2 }}
      />
    ));

  const offres = pharmacie.offres || [];

  // -------------------------------------------------------
  // Rendu
  // -------------------------------------------------------
  return (
    <View style={styles.conteneur}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>

        {/* ── IMAGE EN-TÊTE ── */}
        <View style={styles.conteneurImage}>
          {pharmacie.image ? (
            <Image source={{ uri: pharmacie.image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="storefront-outline" size={64} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          {/* Dégradé bas pour lisibilité */}
          <View style={styles.degrade} />
        </View>

        {/* ── BOUTON RETOUR FLOTTANT ── */}
        <TouchableOpacity style={styles.boutonRetour} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* ── CORPS BLANC ── */}
        <View style={styles.corps}>

          {/* Nom */}
          <Text style={styles.nom}>{pharmacie.nom}</Text>

          {/* Note + distance */}
          <View style={styles.ligneNote}>
            {renderEtoiles(pharmacie.note)}
            <Text style={styles.noteTexte}>{pharmacie.note ? `${pharmacie.note}/5` : '—'}</Text>
            {pharmacie.distance != null && (
              <Text style={styles.distance}>  ·  📍 {pharmacie.distance} km</Text>
            )}
          </View>

          <View style={styles.separateur} />

          {/* ── BLOC INFOS ── */}
          <View style={styles.sectionInfos}>

            <LigneInfo
              icone="location-outline"
              texte={pharmacie.adresse}
              onPress={ouvrirCarte}
              actionLabel="Itinéraire"
              actionIcone="navigate-outline"
            />

            <LigneInfo
              icone="call-outline"
              texte={pharmacie.telephone}
              onPress={appelTelephone}
              actionLabel="Appeler"
              actionIcone="call"
            />

            <LigneInfo
              icone="time-outline"
              texte={pharmacie.horaires || 'Horaires non renseignés'}
            />

            {pharmacie.siteWeb ? (
              <LigneInfo
                icone="globe-outline"
                texte={pharmacie.siteWeb}
                onPress={ouvrirSite}
                actionLabel="Visiter"
                actionIcone="open-outline"
              />
            ) : null}

          </View>

          <View style={styles.separateur} />

          {/* ── OFFRES EN COURS ── */}
          <View style={styles.enteteSection}>
            <Text style={styles.titreSection}>Offres en cours</Text>
            {!chargement && (
              <View style={styles.badgeNbOffres}>
                <Text style={styles.badgeTexte}>{offres.length}</Text>
              </View>
            )}
          </View>

          {chargement ? (
            <ActivityIndicator color={COLORS.primaire} style={{ marginVertical: 24 }} />
          ) : offres.length === 0 ? (
            <View style={styles.videOffres}>
              <Ionicons name="leaf-outline" size={40} color={COLORS.bordure} />
              <Text style={styles.texteVide}>Aucune offre pour le moment</Text>
            </View>
          ) : (
            offres.map(offre => (
              <OfferCard
                key={offre.id}
                offre={{ ...offre, pharmacieNom: pharmacie.nom }}
                estFavori={favorisIds.includes(offre.id)}
                onToggleFavori={() => toggleFavori(offre.id)}
                onPress={() => navigation.navigate('OfferDetail', { offerId: offre.id })}
              />
            ))
          )}

          {/* Espace pour le bouton fixe */}
          <View style={{ height: 90 }} />
        </View>
      </ScrollView>

      {/* ── BOUTON FIXE EN BAS ── */}
      <View style={styles.piedPage}>
        <TouchableOpacity
          style={styles.boutonVoirOffres}
          onPress={() =>
            navigation.navigate('Offres', {
              screen: 'Accueil',
              params: { pharmacieNom: pharmacie.nom },
            })
          }
        >
          <Ionicons name="storefront-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.texteBouton}>Filtrer les offres de cette pharmacie</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// -------------------------------------------------------
// Ligne d'information avec icône + action optionnelle
// -------------------------------------------------------
function LigneInfo({ icone, texte, onPress, actionLabel, actionIcone }) {
  return (
    <View style={styles.ligneInfo}>
      <View style={styles.iconeConteneur}>
        <Ionicons name={icone} size={18} color={COLORS.primaire} />
      </View>
      <Text style={styles.texteInfo} numberOfLines={3}>{texte}</Text>
      {onPress && (
        <TouchableOpacity style={styles.boutonAction} onPress={onPress}>
          <Ionicons name={actionIcone} size={13} color={COLORS.primaire} style={{ marginRight: 3 }} />
          <Text style={styles.texteAction}>{actionLabel}</Text>
        </TouchableOpacity>
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

  // Image en-tête
  conteneurImage: {
    height: 230,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 230,
  },
  imagePlaceholder: {
    backgroundColor: COLORS.primaire,
    justifyContent: 'center',
    alignItems: 'center',
  },
  degrade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    // Simule un dégradé du transparent vers blanc
    backgroundColor: 'transparent',
  },

  // Bouton retour
  boutonRetour: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Corps
  corps: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    minHeight: 300,
  },
  nom: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaireF,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  ligneNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  noteTexte: {
    fontSize: 13,
    color: COLORS.texteClair,
    fontWeight: '600',
    marginLeft: 4,
  },
  distance: {
    fontSize: 13,
    color: COLORS.primaire,
    fontWeight: '600',
  },
  separateur: {
    height: 1,
    backgroundColor: COLORS.bordure,
    marginVertical: 16,
  },

  // Bloc infos
  sectionInfos: {
    gap: 4,
  },
  ligneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F0',
  },
  iconeConteneur: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaire + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  texteInfo: {
    flex: 1,
    fontSize: 14,
    color: COLORS.texte,
    lineHeight: 20,
  },
  boutonAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaire + '12',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  texteAction: {
    fontSize: 12,
    color: COLORS.primaire,
    fontWeight: '700',
  },

  // Section offres
  enteteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  titreSection: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primaireF,
  },
  badgeNbOffres: {
    backgroundColor: COLORS.primaire,
    borderRadius: 99,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeTexte: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  videOffres: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  texteVide: {
    fontSize: 15,
    color: COLORS.texteClair,
    fontWeight: '500',
  },

  // Pied de page fixe
  piedPage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.blanc,
    borderTopWidth: 1,
    borderTopColor: COLORS.bordure,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  boutonVoirOffres: {
    backgroundColor: COLORS.primaire,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  texteBouton: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
