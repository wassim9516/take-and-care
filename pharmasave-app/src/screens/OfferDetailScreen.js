// ============================================================
// src/screens/OfferDetailScreen.js — Détail d'une offre
// ============================================================
// Affiche toutes les infos d'un panier + bouton de réservation.
// Reçoit l'ID de l'offre via la navigation (route.params.offerId).
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { COLORS } from '../constants/colors';
import { CONFIG } from '../config';
import { getOffre, creerReservation, creerIntentPaiement } from '../api/client';

export default function OfferDetailScreen({ route, navigation }) {
  const { offerId } = route.params;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [offre, setOffre]             = useState(null);
  const [chargement, setChargement]   = useState(true);
  const [reservation, setReservation] = useState(false);
  const paiementActif = !!CONFIG.STRIPE_PUBLISHABLE_KEY;

  // -------------------------------------------------------
  // Charger l'offre au montage du composant
  // -------------------------------------------------------
  useEffect(() => {
    const charger = async () => {
      try {
        const data = await getOffre(offerId);
        setOffre(data);
        navigation.setOptions({
          title: data.titre,
          headerRight: () => (
            <TouchableOpacity onPress={() => partager(data)} style={{ paddingRight: 4 }}>
              <Ionicons name="share-outline" size={24} color={COLORS.primaireF} />
            </TouchableOpacity>
          ),
        });
      } catch {
        Alert.alert('Erreur', 'Impossible de charger les détails de cette offre.');
        navigation.goBack();
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, [offerId]);

  // -------------------------------------------------------
  // Partage natif (WhatsApp, SMS, email...)
  // -------------------------------------------------------
  const partager = async (data) => {
    const reduction = data.prixOriginal > 0
      ? Math.round(((data.prixOriginal - data.prixReduit) / data.prixOriginal) * 100)
      : 0;
    try {
      await Share.share({
        message:
          `🍀 Take & Care — Bonne affaire !\n\n` +
          `🛍️ ${data.titre}\n` +
          `💊 ${data.pharmacieNom}\n` +
          `💰 ${data.prixReduit.toFixed(2)}€ au lieu de ${data.prixOriginal.toFixed(2)}€ (-${reduction}%)\n` +
          `⏰ Retrait : ${data.heureRetrait}\n\n` +
          `Télécharge Take & Care pour réserver !`,
        title: data.titre,
      });
    } catch {
      // Silencieux si l'utilisateur annule
    }
  };

  // -------------------------------------------------------
  // Gestion de la réservation
  // -------------------------------------------------------
  const handleReserver = async () => {
    setReservation(true);
    try {
      if (paiementActif) {
        // ── Flux avec paiement Stripe ──
        const intent = await creerIntentPaiement(offre.id);

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: intent.clientSecret,
          merchantDisplayName: 'Take & Care',
          style: 'alwaysLight',
        });
        if (initError) throw new Error(initError.message);

        const { error: payError } = await presentPaymentSheet();
        if (payError) {
          if (payError.code !== 'Canceled') {
            Alert.alert('Paiement refusé', payError.message);
          }
          return;
        }

        // Paiement réussi → confirmer la réservation
        const resultat = await creerReservation(offre.id, intent.paymentIntentId);
        Alert.alert(
          '🎉 Réservation confirmée !',
          `Numéro : ${resultat.reservation.numero}\n\nPasse à la pharmacie entre ${resultat.reservation.heureRetrait} avec ton numéro de réservation.`,
          [{ text: 'Super !', onPress: () => navigation.goBack() }]
        );
      } else {
        // ── Flux sans paiement (Stripe non configuré) ──
        Alert.alert(
          'Confirmer la réservation',
          `Tu vas réserver "${offre.titre}" pour ${offre.prixReduit?.toFixed(2) ?? '0.00'}€.\n\nRetrait : ${offre.heureRetrait}`,
          [
            { text: 'Annuler', style: 'cancel', onPress: () => setReservation(false) },
            {
              text: 'Réserver !',
              onPress: async () => {
                try {
                  const resultat = await creerReservation(offre.id);
                  Alert.alert(
                    '🎉 Réservation confirmée !',
                    `Numéro : ${resultat.reservation.numero}\n\nPasse à la pharmacie entre ${resultat.reservation.heureRetrait} avec ton numéro de réservation.`,
                    [{ text: 'Super !', onPress: () => navigation.goBack() }]
                  );
                } catch {
                  Alert.alert('Erreur', 'La réservation a échoué. Réessaie.');
                } finally {
                  setReservation(false);
                }
              },
            },
          ]
        );
        return;
      }
    } catch (erreur) {
      Alert.alert('Erreur', erreur?.response?.data?.erreur || 'La réservation a échoué. Réessaie.');
    } finally {
      setReservation(false);
    }
  };

  // -------------------------------------------------------
  // Rendu
  // -------------------------------------------------------
  if (chargement) {
    return (
      <View style={styles.centrer}>
        <ActivityIndicator size="large" color={COLORS.primaire} />
      </View>
    );
  }

  if (!offre) return null;

  // Pourcentage de réduction
  const reduction = offre.prixOriginal > 0
    ? Math.round(((offre.prixOriginal - offre.prixReduit) / offre.prixOriginal) * 100)
    : 0;

  return (
    <View style={styles.conteneur}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Image principale */}
        <View style={styles.conteneurImage}>
          <Image source={{ uri: offre.image }} style={styles.image} />
          {/* Badge de réduction sur l'image */}
          <View style={styles.badge}>
            <Text style={styles.texteBadge}>-{reduction}%</Text>
          </View>
        </View>

        <View style={styles.corps}>

          {/* Nom pharmacie + titre */}
          <Text style={styles.nomPharmacie}>{offre.pharmacieNom}</Text>
          <Text style={styles.titre}>{offre.titre}</Text>

          {/* Description */}
          <Text style={styles.description}>{offre.description}</Text>

          {/* Séparateur */}
          <View style={styles.separateur} />

          {/* Contenu du panier */}
          <Text style={styles.sousTitre}>Ce que contient le panier :</Text>
          {(offre.produits || []).map((produit, index) => (
            <View key={index} style={styles.ligneProduit}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.primaire} />
              <Text style={styles.texteProduit}>{produit}</Text>
            </View>
          ))}

          <View style={styles.separateur} />

          {/* Infos pratiques */}
          <Text style={styles.sousTitre}>Infos pratiques :</Text>

          <View style={styles.ligneInfo}>
            <Ionicons name="time-outline" size={18} color={COLORS.secondaire} />
            <Text style={styles.texteInfo}>Retrait : {offre.heureRetrait}</Text>
          </View>

          <View style={styles.ligneInfo}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.secondaire} />
            <Text style={styles.texteInfo}>
              Date de péremption : {new Date(offre.datePeremption).toLocaleDateString('fr-FR')}
            </Text>
          </View>

          <View style={styles.ligneInfo}>
            <Ionicons name="basket-outline" size={18} color={COLORS.secondaire} />
            <Text style={styles.texteInfo}>
              {offre.quantiteDisponible} panier{offre.quantiteDisponible > 1 ? 's' : ''} restant{offre.quantiteDisponible > 1 ? 's' : ''}
            </Text>
          </View>

          {/* Espace pour que le bouton ne cache pas le contenu */}
          <View style={{ height: 100 }} />

        </View>
      </ScrollView>

      {/* Bouton de réservation (fixé en bas de l'écran) */}
      <View style={styles.piedPage}>
        <View style={styles.lignePresentation}>
          <View>
            <Text style={styles.labelPrix}>Prix total</Text>
            <Text style={styles.prixOriginal}>{offre.prixOriginal.toFixed(2)}€</Text>
          </View>
          <Text style={styles.prixReduit}>{offre.prixReduit.toFixed(2)}€</Text>
        </View>

        <TouchableOpacity
          style={[styles.boutonReserver, reservation && styles.boutonDesactive]}
          onPress={handleReserver}
          disabled={reservation}
        >
          {reservation ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.texteBouton}>
              {paiementActif ? `Payer ${offre.prixReduit.toFixed(2)} €` : 'Je réserve ce panier'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

// -------------------------------------------------------
// Styles
// -------------------------------------------------------
const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: COLORS.blanc,
  },
  centrer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conteneurImage: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 250,
    backgroundColor: COLORS.bordure,
  },
  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  texteBadge: {
    color: COLORS.blanc,
    fontWeight: 'bold',
    fontSize: 16,
  },
  corps: {
    padding: 20,
  },
  nomPharmacie: {
    color: COLORS.texteClair,
    fontSize: 13,
    marginBottom: 4,
  },
  titre: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.texte,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: COLORS.texteClair,
    lineHeight: 22,
  },
  separateur: {
    height: 1,
    backgroundColor: COLORS.bordure,
    marginVertical: 20,
  },
  sousTitre: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.texte,
    marginBottom: 12,
  },
  ligneProduit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  texteProduit: {
    fontSize: 15,
    color: COLORS.texte,
  },
  ligneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  texteInfo: {
    fontSize: 15,
    color: COLORS.texte,
  },
  piedPage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.blanc,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.bordure,
    // Ombre iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  lignePresentation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  labelPrix: {
    fontSize: 12,
    color: COLORS.texteClair,
  },
  prixOriginal: {
    fontSize: 14,
    color: COLORS.texteClair,
    textDecorationLine: 'line-through',
  },
  prixReduit: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primaire,
  },
  boutonReserver: {
    backgroundColor: COLORS.primaire,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  boutonDesactive: {
    opacity: 0.6,
  },
  texteBouton: {
    color: COLORS.blanc,
    fontSize: 17,
    fontWeight: 'bold',
  },
});
