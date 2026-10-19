// ============================================================
// src/components/OfferCard.js — Carte d'une offre
// ============================================================
// Composant réutilisable affiché dans la liste des offres.
// Reçoit les données d'une offre via les "props".
// ============================================================

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

// Libellés lisibles pour chaque catégorie
const LABELS_CATEGORIES = {
  soin_visage: 'Soin Visage',
  soin_corps:  'Soin Corps',
  complement:  'Compléments',
  bebe:        'Bébé',
  solaire:     'Solaire',
};

// -------------------------------------------------------
// Composant OfferCard
// Props attendues :
//   - offre : objet offre complet (voir mockData.js)
//   - onPress : fonction appelée au clic sur la carte
// -------------------------------------------------------
export default function OfferCard({ offre, onPress, estFavori = false, onToggleFavori }) {
  const pourcentageReduction = offre.prixOriginal > 0
    ? Math.round(((offre.prixOriginal - offre.prixReduit) / offre.prixOriginal) * 100)
    : 0;

  // Couleur du badge selon le stock restant
  const couleurStock = offre.quantiteDisponible <= 1
    ? COLORS.danger      // Rouge : dernier panier !
    : offre.quantiteDisponible <= 2
      ? COLORS.attention // Orange : bientôt fini
      : COLORS.succes;   // Vert : stock ok

  return (
    <TouchableOpacity style={styles.carte} onPress={onPress} activeOpacity={0.85}>

      {/* Image du panier */}
      <Image
        source={{ uri: offre.image }}
        style={styles.image}
        // Image de remplacement si l'URL ne charge pas
        defaultSource={require('../../assets/placeholder.png')}
      />

      {/* Badge de réduction (coin haut-gauche de l'image) */}
      <View style={styles.badgeReduction}>
        <Text style={styles.texteBadge}>-{pourcentageReduction}%</Text>
      </View>

      {/* Bouton favori (coin haut-droit) */}
      {onToggleFavori && (
        <TouchableOpacity style={styles.boutonFavori} onPress={onToggleFavori} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={estFavori ? 'heart' : 'heart-outline'}
            size={22}
            color={estFavori ? COLORS.danger : COLORS.blanc}
          />
        </TouchableOpacity>
      )}

      {/* Contenu texte */}
      <View style={styles.contenu}>

        {/* Nom de la pharmacie */}
        <Text style={styles.nomPharmacie}>{offre.pharmacieNom}</Text>

        {/* Titre du panier */}
        <Text style={styles.titre} numberOfLines={1}>{offre.titre}</Text>

        {/* Badge catégorie */}
        <View style={[styles.badgeCategorie, { backgroundColor: COLORS.categories[offre.categorie] + '25' }]}>
          <Text style={[styles.texteCategorie, { color: COLORS.categories[offre.categorie] }]}>
            {LABELS_CATEGORIES[offre.categorie] || offre.categorie}
          </Text>
        </View>

        {/* Ligne prix + stock */}
        <View style={styles.ligneInfos}>

          {/* Prix */}
          <View style={styles.conteneurPrix}>
            <Text style={styles.prixReduit}>{offre.prixReduit.toFixed(2)}€</Text>
            <Text style={styles.prixOriginal}>{offre.prixOriginal.toFixed(2)}€</Text>
          </View>

          {/* Nombre de paniers restants */}
          <View style={[styles.badgeStock, { backgroundColor: couleurStock + '20' }]}>
            <Text style={[styles.texteStock, { color: couleurStock }]}>
              {offre.quantiteDisponible} restant{offre.quantiteDisponible > 1 ? 's' : ''}
            </Text>
          </View>

        </View>

        {/* Heure de retrait + distance */}
        <View style={styles.ligneBasCarte}>
          <Text style={styles.heureRetrait}>⏰ {offre.heureRetrait}</Text>
          {offre.distance != null && (
            <Text style={styles.distance}>📍 {offre.distance} km</Text>
          )}
        </View>

      </View>
    </TouchableOpacity>
  );
}

// -------------------------------------------------------
// Styles
// -------------------------------------------------------
const styles = StyleSheet.create({
  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    // Ombre iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Ombre Android
    elevation: 4,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.bordure,
  },
  badgeReduction: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  boutonFavori: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 20,
    padding: 6,
  },
  texteBadge: {
    color: COLORS.blanc,
    fontWeight: 'bold',
    fontSize: 13,
  },
  contenu: {
    padding: 14,
  },
  nomPharmacie: {
    color: COLORS.texteClair,
    fontSize: 12,
    marginBottom: 2,
  },
  titre: {
    color: COLORS.texte,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgeCategorie: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  texteCategorie: {
    fontSize: 12,
    fontWeight: '600',
  },
  ligneInfos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  conteneurPrix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prixReduit: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primaire,
  },
  prixOriginal: {
    fontSize: 14,
    color: COLORS.texteClair,
    textDecorationLine: 'line-through',
  },
  badgeStock: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  texteStock: {
    fontSize: 12,
    fontWeight: '600',
  },
  ligneBasCarte: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  heureRetrait: {
    fontSize: 12,
    color: COLORS.texteClair,
  },
  distance: {
    fontSize: 12,
    color: COLORS.primaire,
    fontWeight: '600',
  },
});
