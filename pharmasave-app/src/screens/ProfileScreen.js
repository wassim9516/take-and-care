// ============================================================
// src/screens/ProfileScreen.js — Profil + Mes réservations
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, RefreshControl,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getMesReservations, annulerReservation, modifierMotDePasse } from '../api/client';

// Couleur et libellé selon le statut de la réservation
const STATUTS = {
  confirmee: { label: 'Confirmée',  couleur: COLORS.primaire },
  retiree:   { label: 'Retirée',    couleur: COLORS.secondaire },
  annulee:   { label: 'Annulée',    couleur: COLORS.danger },
};

export default function ProfileScreen() {
  const { utilisateur, seDeconnecter, mettreAJourProfil } = useAuth();
  const [reservations, setReservations]         = useState([]);
  const [chargement, setChargement]             = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);

  // Modal édition profil
  const [modalVisible, setModalVisible] = useState(false);
  const [ongletModal, setOngletModal]   = useState('infos'); // 'infos' | 'mdp'
  const [prenom, setPrenom]             = useState('');
  const [nom, setNom]                   = useState('');
  const [telephone, setTelephone]       = useState('');
  const [ancienMdp, setAncienMdp]       = useState('');
  const [nouveauMdp, setNouveauMdp]     = useState('');
  const [sauvegarde, setSauvegarde]     = useState(false);

  const ouvrirModal = () => {
    setPrenom(utilisateur?.prenom || '');
    setNom(utilisateur?.nom || '');
    setTelephone(utilisateur?.telephone || '');
    setAncienMdp('');
    setNouveauMdp('');
    setOngletModal('infos');
    setModalVisible(true);
  };

  const handleSauvegarderInfos = async () => {
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert('Erreur', 'Prénom et nom sont obligatoires.');
      return;
    }
    setSauvegarde(true);
    try {
      await mettreAJourProfil({ prenom: prenom.trim(), nom: nom.trim(), telephone: telephone.trim() });
      setModalVisible(false);
      Alert.alert('✅ Profil mis à jour !');
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil.');
    } finally {
      setSauvegarde(false);
    }
  };

  const handleChangerMdp = async () => {
    if (!ancienMdp || !nouveauMdp) {
      Alert.alert('Erreur', 'Remplis les deux champs.');
      return;
    }
    if (nouveauMdp.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setSauvegarde(true);
    try {
      await modifierMotDePasse(ancienMdp, nouveauMdp);
      setModalVisible(false);
      Alert.alert('✅ Mot de passe modifié !');
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.erreur || 'Ancien mot de passe incorrect.');
    } finally {
      setSauvegarde(false);
    }
  };

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

      {/* ---- MODAL ÉDITION ---- */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalEnTete}>
            <Text style={styles.modalTitre}>Mon compte</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.texte} />
            </TouchableOpacity>
          </View>

          {/* Onglets */}
          <View style={styles.onglets}>
            <TouchableOpacity style={[styles.onglet, ongletModal === 'infos' && styles.ongletActif]} onPress={() => setOngletModal('infos')}>
              <Text style={[styles.texteOnglet, ongletModal === 'infos' && styles.texteOngletActif]}>Mes infos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.onglet, ongletModal === 'mdp' && styles.ongletActif]} onPress={() => setOngletModal('mdp')}>
              <Text style={[styles.texteOnglet, ongletModal === 'mdp' && styles.texteOngletActif]}>Mot de passe</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalCorps} keyboardShouldPersistTaps="handled">
            {ongletModal === 'infos' ? (
              <View style={styles.formulaire}>
                <Text style={styles.labelChamp}>Prénom</Text>
                <TextInput style={styles.champ} value={prenom} onChangeText={setPrenom} placeholder="Prénom" />
                <Text style={styles.labelChamp}>Nom</Text>
                <TextInput style={styles.champ} value={nom} onChangeText={setNom} placeholder="Nom" />
                <Text style={styles.labelChamp}>Téléphone</Text>
                <TextInput style={styles.champ} value={telephone} onChangeText={setTelephone} placeholder="Téléphone" keyboardType="phone-pad" />
                <Text style={styles.emailInfo}>Email : {utilisateur?.email}</Text>
                <TouchableOpacity style={styles.boutonSauvegarder} onPress={handleSauvegarderInfos} disabled={sauvegarde}>
                  {sauvegarde ? <ActivityIndicator color={COLORS.blanc} /> : <Text style={styles.texteBouton}>Sauvegarder</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formulaire}>
                <Text style={styles.labelChamp}>Ancien mot de passe</Text>
                <TextInput style={styles.champ} value={ancienMdp} onChangeText={setAncienMdp} placeholder="••••••" secureTextEntry />
                <Text style={styles.labelChamp}>Nouveau mot de passe</Text>
                <TextInput style={styles.champ} value={nouveauMdp} onChangeText={setNouveauMdp} placeholder="6 caractères minimum" secureTextEntry />
                <TouchableOpacity style={styles.boutonSauvegarder} onPress={handleChangerMdp} disabled={sauvegarde}>
                  {sauvegarde ? <ActivityIndicator color={COLORS.blanc} /> : <Text style={styles.texteBouton}>Changer le mot de passe</Text>}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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
        <TouchableOpacity onPress={ouvrirModal} style={styles.boutonEditer}>
          <Ionicons name="pencil-outline" size={22} color={COLORS.primaire} />
        </TouchableOpacity>
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
  boutonEditer: {
    padding: 8,
  },
  boutonDeconnexion: {
    padding: 8,
  },
  // Modal
  modalEnTete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bordure,
  },
  modalTitre: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.texte,
  },
  onglets: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bordure,
  },
  onglet: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ongletActif: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primaire,
  },
  texteOnglet: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.texteClair,
  },
  texteOngletActif: {
    color: COLORS.primaire,
    fontWeight: '700',
  },
  modalCorps: {
    flex: 1,
  },
  formulaire: {
    padding: 20,
    gap: 6,
  },
  labelChamp: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.texte,
    marginTop: 12,
    marginBottom: 4,
  },
  champ: {
    backgroundColor: COLORS.fondClair,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: COLORS.texte,
  },
  emailInfo: {
    fontSize: 13,
    color: COLORS.texteClair,
    marginTop: 16,
    fontStyle: 'italic',
  },
  boutonSauvegarder: {
    backgroundColor: COLORS.primaire,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  texteBouton: {
    color: COLORS.blanc,
    fontSize: 16,
    fontWeight: '700',
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
