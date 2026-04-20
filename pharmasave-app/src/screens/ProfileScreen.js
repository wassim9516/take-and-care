// ============================================================
// src/screens/ProfileScreen.js — Profil + Mes réservations
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getMesReservations, annulerReservation } from '../api/client';

// Couleur et libellé selon le statut de la réservation
const STATUTS = {
  confirmee: { label: 'Confirmée',  couleur: COLORS.primaire },
  retiree:   { label: 'Retirée',    couleur: COLORS.secondaire },
  annulee:   { label: 'Annulée',    couleur: COLORS.danger },
};

export default function ProfileScreen() {
  const { utilisateur, seDeconnecter } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [chargement, setChargement]     = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);

  // Recharge les réservations à chaque fois que l'onglet devient actif
  useFocusEffect(
    useCallback(() => {
      chargerReservations();
    }, [])
  );

  const chargerReservations = async () => {
    try {
      const data = await getMesReservations();
      setReservations(data);
    } catch {
      // Silencieux si erreur réseau
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  };

  // -------------------------------------------------------
  // Annulation d'une réservation
  // -------------------------------------------------------
  const handleAnnuler = (reservation) => {
    Alert.alert(
      'Annuler la réservation ?',
      `${reservation.offre?.titre} — ${reservation.numero}`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await annulerReservation(reservation.id);
              chargerReservations();
            } catch {
              Alert.alert('Erreur', 'Impossible d\'annuler cette réservation.');
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------
  // Rendu d'une réservation
  // -------------------------------------------------------
  const renderReservation = ({ item }) => {
    const statut = STATUTS[item.statut] || STATUTS.confirmee;
    return (
      <View style={styles.carteReservation}>

        <View style={styles.ligneReservation}>
          <Text style={styles.titreOffre} numberOfLines={1}>{item.offre?.titre}</Text>
          <View style={[styles.badgeStatut, { backgroundColor: statut.couleur + '20' }]}>
            <Text style={[styles.texteStatut, { color: statut.couleur }]}>{statut.label}</Text>
          </View>
        </View>

        <Text style={styles.infoPharmacie}>
          {item.offre?.pharmacie?.nom}
        </Text>

        <View style={styles.ligneInfos}>
          <Text style={styles.numero}>N° {item.numero}</Text>
          <Text style={styles.prix}>{(item.prixPaye ?? 0).toFixed(2)}€</Text>
        </View>

        {item.offre?.heureRetrait && (
          <Text style={styles.heureRetrait}>⏰ Retrait : {item.offre.heureRetrait}</Text>
        )}

        {/* Bouton annuler (seulement si confirmée) */}
        {item.statut === 'confirmee' && (
          <TouchableOpacity
            style={styles.boutonAnnuler}
            onPress={() => handleAnnuler(item)}
          >
            <Text style={styles.texteAnnuler}>Annuler</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.conteneur}>

      {/* En-tête profil */}
      <View style={styles.entete}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={COLORS.blanc} />
        </View>
        <View style={styles.infoUtilisateur}>
          <Text style={styles.nomUtilisateur}>
            {utilisateur?.prenom} {utilisateur?.nom}
          </Text>
          <Text style={styles.emailUtilisateur}>{utilisateur?.email}</Text>
        </View>
        {/* Bouton déconnexion */}
        <TouchableOpacity onPress={seDeconnecter} style={styles.boutonDeconnexion}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Titre section réservations */}
      <Text style={styles.titreSection}>Mes réservations</Text>

      {/* Liste des réservations */}
      {chargement ? (
        <View style={styles.centrer}>
          <ActivityIndicator color={COLORS.primaire} />
        </View>
      ) : reservations.length === 0 ? (
        <View style={styles.centrer}>
          <Ionicons name="receipt-outline" size={48} color={COLORS.bordure} />
          <Text style={styles.texteVide}>Aucune réservation</Text>
          <Text style={styles.texteClair}>Tes réservations apparaîtront ici</Text>
        </View>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderReservation}
          contentContainerStyle={styles.liste}
          refreshControl={
            <RefreshControl
              refreshing={rafraichissement}
              onRefresh={() => { setRafraichissement(true); chargerReservations(); }}
              tintColor={COLORS.primaire}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: COLORS.fondClair,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F0',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bordure,
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaire,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoUtilisateur: {
    flex: 1,
  },
  nomUtilisateur: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaireF,
  },
  emailUtilisateur: {
    fontSize: 13,
    color: COLORS.texteClair,
    marginTop: 2,
  },
  boutonDeconnexion: {
    padding: 8,
  },
  titreSection: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.texteClair,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  liste: {
    padding: 16,
    gap: 12,
  },
  carteReservation: {
    backgroundColor: COLORS.blanc,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    gap: 6,
  },
  ligneReservation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titreOffre: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.texte,
    flex: 1,
  },
  badgeStatut: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  texteStatut: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoPharmacie: {
    fontSize: 13,
    color: COLORS.texteClair,
  },
  ligneInfos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  numero: {
    fontSize: 12,
    color: COLORS.texteClair,
    fontFamily: 'monospace',
  },
  prix: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaire,
  },
  heureRetrait: {
    fontSize: 12,
    color: COLORS.texteClair,
  },
  boutonAnnuler: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  texteAnnuler: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },
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
