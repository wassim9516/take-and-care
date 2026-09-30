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
import { COLORS } from '../constants/colors';
import { CONFIG } from '../config';
import { getOffre, creerReservation, creerIntentPaiement } from '../api/client';

const paiementActif = !!CONFIG.STRIPE_PUBLISHABLE_KEY;

// Import conditionnel Stripe — uniquement si la clé est configurée
let useStripeHook = null;
if (paiementActif) {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    useStripeHook = stripeModule.useStripe;
  } catch {
    // Stripe non disponible (Expo Go)
  }
}

export default function OfferDetailScreen({ route, navigation }) {
  const { offerId, offreData } = route.params || {};

  // Si les données sont déjà disponibles (passées depuis l'écran précédent),
  // on les utilise directement sans appel réseau
  const [offre, setOffre]           = useState(offreData || null);
  const [chargement, setChargement] = useState(!offreData && !!offerId);

  const appliquerOptions = (data) => {
    navigation.setOptions({
      title: data.titre,
      headerRight: () => (
        <TouchableOpacity onPress={() => partager(data)} style={{ paddingRight: 4 }}>
          <Ionicons name="share-outline" size={24} color={COLORS.primaireF} />
        </TouchableOpacity>
      ),
    });
  };

  // -------------------------------------------------------
  // Charger l'offre si on n'a pas les données (navigation directe)
  // -------------------------------------------------------
  useEffect(() => {
    if (offreData) {
      appliquerOptions(offreData);
      return;
    }
    const charger = async () => {
      try {
        const data = await getOffre(offerId);
        setOffre(data);
        appliquerOptions(data);
      } catch (err) {
        const msg = err?.response?.data?.erreur
          || (err?.code === 'ECONNABORTED' ? 'Délai dépassé — vérifie que le serveur est lancé et que l\'IP dans config.js est correcte.' : null)
          || err?.message
          || 'Impossible de charger les détails de cette offre.';
        Alert.alert('Erreur réseau', msg);
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

          {offre.datePeremption && (
            <View style={styles.ligneInfo}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.secondaire} />
              <Text style={styles.texteInfo}>
                Date de péremption : {new Date(offre.datePeremption).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          )}

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

      {/* Pied de page : affiché par un sous-composant selon Stripe actif ou non */}
      {paiementActif
        ? <PiedPageStripe offre={offre} navigation={navigation} />
        : <PiedPageSimple offre={offre} navigation={navigation} />
      }

    </View>
  );
}

// -------------------------------------------------------
// PiedPageStripe — utilise useStripe(), monté uniquement si Stripe est actif
// Ce composant ne doit JAMAIS être rendu hors d'un StripeProvider
// -------------------------------------------------------
function PiedPageStripe({ offre, navigation }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripeHook();
  const [enCours, setEnCours] = useState(false);

  const handlePayer = async () => {
    setEnCours(true);
    try {
      const intent = await creerIntentPaiement(offre.id);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intent.clientSecret,
        merchantDisplayName: 'Take & Care',
        style: 'alwaysLight',
      });
      if (initError) throw new Error(initError.message);

      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') Alert.alert('Paiement refusé', payError.message);
        return;
      }

      const resultat = await creerReservation(offre.id, intent.paymentIntentId);
      Alert.alert(
        '🎉 Réservation confirmée !',
        `Numéro : ${resultat.reservation.numero}\n\nPasse à la pharmacie entre ${resultat.reservation.heureRetrait} avec ton numéro de réservation.`,
        [{ text: 'Super !', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.erreur || 'La réservation a échoué. Réessaie.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View style={styles.piedPage}>
      <LignePrix offre={offre} />
      <TouchableOpacity
        style={[styles.boutonReserver, enCours && styles.boutonDesactive]}
        onPress={handlePayer}
        disabled={enCours}
      >
        {enCours
          ? <ActivityIndicator color={COLORS.blanc} />
          : <Text style={styles.texteBouton}>Payer {offre.prixReduit.toFixed(2)} €</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// -------------------------------------------------------
// PiedPageSimple — aucune dépendance Stripe, fonctionne dans Expo Go
// -------------------------------------------------------
function PiedPageSimple({ offre, navigation }) {
  const [enCours, setEnCours] = useState(false);

  const handleReserver = () => {
    Alert.alert(
      'Confirmer la réservation',
      `Tu vas réserver "${offre.titre}" pour ${offre.prixReduit?.toFixed(2) ?? '0.00'}€.\n\nRetrait : ${offre.heureRetrait}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réserver !',
          onPress: async () => {
            setEnCours(true);
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
              setEnCours(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.piedPage}>
      <LignePrix offre={offre} />
      <TouchableOpacity
        style={[styles.boutonReserver, enCours && styles.boutonDesactive]}
        onPress={handleReserver}
        disabled={enCours}
      >
        {enCours
          ? <ActivityIndicator color={COLORS.blanc} />
          : <Text style={styles.texteBouton}>Je réserve ce panier</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

function LignePrix({ offre }) {
  return (
    <View style={styles.lignePresentation}>
      <View>
        <Text style={styles.labelPrix}>Prix total</Text>
        <Text style={styles.prixOriginal}>{offre.prixOriginal.toFixed(2)}€</Text>
      </View>
      <Text style={styles.prixReduit}>{offre.prixReduit.toFixed(2)}€</Text>
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
