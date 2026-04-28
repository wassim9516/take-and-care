// ============================================================
// src/screens/MapScreen.js — Carte des pharmacies
// ============================================================
// Affiche les pharmacies sur une carte MapView.
// Utilise expo-location pour obtenir la position de l'utilisateur.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { getPharmaciesProches } from '../api/client';

export default function MapScreen({ navigation }) {
  // --- État local ---
  const [position, setPosition]         = useState(null);
  const [pharmacies, setPharmacies]     = useState([]);
  const [chargement, setChargement]     = useState(true);
  const [pharmacieSelectionnee, setPharmacieSelectionnee] = useState(null);
  const [rayonKm, setRayonKm]           = useState(5);

  // -------------------------------------------------------
  // Lire le rayon depuis les préférences utilisateur
  // -------------------------------------------------------
  useEffect(() => {
    AsyncStorage.getItem('rayon_carte').then(val => {
      if (val) setRayonKm(parseInt(val));
    });
  }, []);

  // -------------------------------------------------------
  // Demander la permission GPS et charger la position
  // -------------------------------------------------------
  useEffect(() => {
    const initialiser = async () => {
      // Demande la permission de localisation
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'PharmaSave a besoin de ta position pour trouver les pharmacies proches.',
          [{ text: 'OK' }]
        );
        setChargement(false);
        return;
      }

      try {
        // Obtenir la position actuelle
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!loc?.coords) throw new Error('Position indisponible.');
        const { latitude, longitude } = loc.coords;
        setPosition({ latitude, longitude });

        // Charger les pharmacies proches
        const data = await getPharmaciesProches(latitude, longitude);
        setPharmacies(data);
      } catch (erreur) {
        Alert.alert('Erreur', 'Impossible d\'obtenir ta position.');
        console.error(erreur);
      } finally {
        setChargement(false);
      }
    };

    initialiser();
  }, []);

  // -------------------------------------------------------
  // Rendu : chargement
  // -------------------------------------------------------
  if (chargement) {
    return (
      <View style={styles.centrer}>
        <ActivityIndicator size="large" color={COLORS.primaire} />
        <Text style={styles.texteChargement}>Localisation en cours...</Text>
      </View>
    );
  }

  // -------------------------------------------------------
  // Rendu : pas de permission GPS
  // -------------------------------------------------------
  if (!position) {
    return (
      <View style={styles.centrer}>
        <Ionicons name="location-off-outline" size={60} color={COLORS.texteClair} />
        <Text style={styles.texteErreur}>Position non disponible</Text>
        <Text style={styles.texteClair}>Active la localisation dans les réglages</Text>
      </View>
    );
  }

  // -------------------------------------------------------
  // Rendu principal : carte
  // -------------------------------------------------------
  return (
    <View style={styles.conteneur}>

      <MapView
        style={styles.carte}
        // La carte se centre sur la position de l'utilisateur
        initialRegion={{
          latitude: position.latitude,
          longitude: position.longitude,
          latitudeDelta: 0.05,   // Zoom : plus petit = plus zoomé
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}    // Point bleu pour l'utilisateur
        showsMyLocationButton={true}
      >
        {/* Cercle de rayon de recherche (selon préférence utilisateur) */}
        <Circle
          center={position}
          radius={rayonKm * 1000}
          fillColor={COLORS.primaire + '15'}
          strokeColor={COLORS.primaire + '60'}
          strokeWidth={1}
        />

        {/* Marqueurs filtrés selon le rayon choisi */}
        {pharmacies.filter(p => p.distance == null || p.distance <= rayonKm).map((pharmacie) => (
          <Marker
            key={pharmacie.id}
            coordinate={{
              latitude: pharmacie.latitude,
              longitude: pharmacie.longitude,
            }}
            title={pharmacie.nom}
            description={pharmacie.adresse}
            // Sélectionne la pharmacie au clic sur le marqueur
            onPress={() => setPharmacieSelectionnee(pharmacie)}
          >
            {/* Marqueur personnalisé (icône pharmacie) */}
            <View style={styles.marqueur}>
              <Text style={styles.texteMarqueur}>💊</Text>
            </View>
          </Marker>
        ))}

      </MapView>

      {/* Panneau inférieur : liste des pharmacies ou détail de la sélectionnée */}
      {pharmacieSelectionnee ? (
        // Détail de la pharmacie sélectionnée
        <View style={styles.panneau}>
          <View style={styles.ligneEntete}>
            <Text style={styles.nomPharmacie} numberOfLines={1}>
              {pharmacieSelectionnee.nom}
            </Text>
            {/* Bouton fermer */}
            <TouchableOpacity onPress={() => setPharmacieSelectionnee(null)}>
              <Ionicons name="close" size={22} color={COLORS.texteClair} />
            </TouchableOpacity>
          </View>

          <Text style={styles.adresse}>{pharmacieSelectionnee.adresse}</Text>
          <Text style={styles.infos}>
            📞 {pharmacieSelectionnee.telephone}  •  ⭐ {pharmacieSelectionnee.note}/5
          </Text>
          <Text style={styles.infos}>🕐 {pharmacieSelectionnee.horaires}</Text>
          {pharmacieSelectionnee.distance && (
            <Text style={styles.distance}>📍 {pharmacieSelectionnee.distance} km de toi</Text>
          )}

          {/* Deux boutons : fiche complète ou offres filtrées */}
          <View style={styles.ligneBoutons}>
            <TouchableOpacity
              style={[styles.bouton, styles.boutonSecondaire]}
              onPress={() => {
                setPharmacieSelectionnee(null);
                navigation.navigate('Offres', {
                  screen: 'Accueil',
                  params: { pharmacieNom: pharmacieSelectionnee.nom },
                });
              }}
            >
              <Text style={styles.texteBoutonSecondaire}>Voir les offres</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bouton, { flex: 1.4 }]}
              onPress={() => {
                const pharmacie = pharmacieSelectionnee;
                setPharmacieSelectionnee(null);
                navigation.navigate('PharmacieDetail', { pharmacie });
              }}
            >
              <Text style={styles.texteBouton}>Voir la fiche →</Text>
            </TouchableOpacity>
          </View>
        </View>

      ) : (
        // Liste rapide des pharmacies proches
        <View style={styles.panneau}>
          <Text style={styles.titrePanneau}>
            {(() => { const n = pharmacies.filter(p => p.distance == null || p.distance <= rayonKm).length; return `${n} pharmacie${n > 1 ? 's' : ''} dans un rayon de ${rayonKm} km`; })()}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.listeHorizontale}>
            {pharmacies.filter(p => p.distance == null || p.distance <= rayonKm).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.cartePharmacieMin}
                onPress={() => setPharmacieSelectionnee(p)}
              >
                <Text style={styles.nomPharmacieMin} numberOfLines={1}>{p.nom}</Text>
                {p.distance && (
                  <Text style={styles.distanceMin}>{p.distance} km</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
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
  },
  carte: {
    flex: 1,
  },
  centrer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.fondClair,
  },
  texteChargement: {
    marginTop: 12,
    color: COLORS.texteClair,
    fontSize: 15,
  },
  texteErreur: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.texte,
    marginTop: 16,
  },
  texteClair: {
    color: COLORS.texteClair,
    marginTop: 8,
  },
  marqueur: {
    backgroundColor: COLORS.blanc,
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: COLORS.primaire,
    // Ombre
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  texteMarqueur: {
    fontSize: 20,
  },
  panneau: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    // Ombre vers le haut
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  titrePanneau: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.texte,
    marginBottom: 12,
  },
  listeHorizontale: {
    flexDirection: 'row',
  },
  cartePharmacieMin: {
    backgroundColor: COLORS.fondClair,
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    minWidth: 130,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  nomPharmacieMin: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.texte,
  },
  distanceMin: {
    fontSize: 12,
    color: COLORS.primaire,
    marginTop: 4,
  },
  ligneEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nomPharmacie: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.texte,
    flex: 1,
  },
  adresse: {
    fontSize: 14,
    color: COLORS.texteClair,
    marginBottom: 6,
  },
  infos: {
    fontSize: 13,
    color: COLORS.texte,
    marginBottom: 4,
  },
  distance: {
    fontSize: 13,
    color: COLORS.primaire,
    fontWeight: '600',
    marginBottom: 12,
  },
  ligneBoutons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  bouton: {
    flex: 1,
    backgroundColor: COLORS.primaire,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  boutonSecondaire: {
    backgroundColor: COLORS.blanc,
    borderWidth: 1.5,
    borderColor: COLORS.primaire,
  },
  texteBouton: {
    color: COLORS.blanc,
    fontWeight: '700',
    fontSize: 14,
  },
  texteBoutonSecondaire: {
    color: COLORS.primaire,
    fontWeight: '700',
    fontSize: 14,
  },
});
