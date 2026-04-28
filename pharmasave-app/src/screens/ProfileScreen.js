// ============================================================
// src/screens/ProfileScreen.js — Profil utilisateur
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getMesReservations, annulerReservation, modifierMotDePasse, noterReservation } from '../api/client';

const { width: LARGEUR_ECRAN } = Dimensions.get('window');

const STATUTS = {
  confirmee: { label: 'Confirmée', couleur: COLORS.primaire },
  retiree:   { label: 'Retirée',   couleur: COLORS.secondaire },
  annulee:   { label: 'Annulée',   couleur: COLORS.danger },
};

const RAYONS_KM = [ 2, 5, 10, 20, 50];
const CLE_RAYON = 'rayon_carte';

export default function ProfileScreen() {
  const { utilisateur, seDeconnecter, mettreAJourProfil } = useAuth();

  const [reservations, setReservations]         = useState([]);
  const [chargement, setChargement]             = useState(true);
  const [afficherToutes, setAfficherToutes]     = useState(false);
  const [qrVisible, setQrVisible]               = useState(false);
  const [qrReservation, setQrReservation]       = useState(null);

  // Rayon carte
  const [rayonCarte, setRayonCarte] = useState(5);

  // Modal édition
  const [modalVisible, setModalVisible] = useState(false);
  const [ongletModal, setOngletModal]   = useState('infos');
  const [prenom, setPrenom]             = useState('');
  const [nom, setNom]                   = useState('');
  const [telephone, setTelephone]       = useState('');
  const [ancienMdp, setAncienMdp]       = useState('');
  const [nouveauMdp, setNouveauMdp]     = useState('');
  const [sauvegarde, setSauvegarde]     = useState(false);

  // Charger le rayon sauvegardé
  useEffect(() => {
    AsyncStorage.getItem(CLE_RAYON).then(val => {
      if (val) setRayonCarte(parseInt(val));
    });
  }, []);

  const changerRayon = async (km) => {
    setRayonCarte(km);
    await AsyncStorage.setItem(CLE_RAYON, String(km));
  };

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
    }
  };

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
      Alert.alert('Profil mis à jour !');
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
      Alert.alert('Mot de passe modifié !');
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.erreur || 'Ancien mot de passe incorrect.');
    } finally {
      setSauvegarde(false);
    }
  };

  const handleNoter = async (reservationId, note) => {
    try {
      await noterReservation(reservationId, note);
      // Met à jour localement sans recharger toute la liste
      setReservations(prev =>
        prev.map(r => r.id === reservationId ? { ...r, noteClient: note } : r)
      );
      Alert.alert('Merci !', 'Ton avis a bien été enregistré. 🌟');
    } catch (err) {
      Alert.alert('Erreur', err?.response?.data?.erreur || 'Impossible d\'enregistrer la note.');
    }
  };

  const handleAnnuler = (reservation) => {
    Alert.alert(
      'Annuler la réservation ?',
      `${reservation.offre?.titre} — ${reservation.numero}`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler', style: 'destructive',
          onPress: async () => {
            try {
              await annulerReservation(reservation.id);
              chargerReservations();
            } catch {
              Alert.alert('Erreur', "Impossible d'annuler cette réservation.");
            }
          },
        },
      ]
    );
  };

  const initiales = `${utilisateur?.prenom?.[0] || ''}${utilisateur?.nom?.[0] || ''}`.toUpperCase();

  // Affichage partiel des réservations (3 max par défaut)
  const reservationsAffichees = afficherToutes ? reservations : reservations.slice(0, 3);

  // -------------------------------------------------------
  // Rendu
  // -------------------------------------------------------
  return (
    <View style={styles.conteneur}>

      {/* ══════════ MODAL QR CODE PLEIN ÉCRAN ══════════ */}
      <Modal
        visible={qrVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQrVisible(false)}
      >
        <View style={styles.qrOverlay}>
          <View style={styles.qrCarte}>

            {/* En-tête */}
            <View style={styles.qrEnTete}>
              <Text style={styles.qrTitre}>Présente ce QR code</Text>
              <TouchableOpacity onPress={() => setQrVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.texte} />
              </TouchableOpacity>
            </View>

            <Text style={styles.qrSousTitre}>
              {qrReservation?.offre?.titre}
            </Text>
            <Text style={styles.qrPharmacie}>
              {qrReservation?.offre?.pharmacie?.nom}
            </Text>

            {/* QR code centré */}
            <View style={styles.qrConteneur}>
              {qrReservation && (
                <QRCode
                  value={qrReservation.numero}
                  size={LARGEUR_ECRAN * 0.55}
                  color={COLORS.primaireF}
                  backgroundColor="#fff"
                />
              )}
            </View>

            {/* Numéro de réservation */}
            <View style={styles.qrNumeroConteneur}>
              <Text style={styles.qrNumeroLabel}>N° de réservation</Text>
              <Text style={styles.qrNumero}>{qrReservation?.numero}</Text>
            </View>

            {/* Montant */}
            <View style={styles.qrMontantLigne}>
              <Text style={styles.qrMontantLabel}>Montant à régler</Text>
              <Text style={styles.qrMontant}>
                {(qrReservation?.prixPaye ?? 0).toFixed(2)} €
              </Text>
            </View>

            {/* Heure de retrait */}
            {qrReservation?.offre?.heureRetrait && (
              <View style={styles.qrHeureLigne}>
                <Ionicons name="time-outline" size={16} color={COLORS.texteClair} />
                <Text style={styles.qrHeureTexte}>
                  Retrait : {qrReservation.offre.heureRetrait}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.qrBoutonFermer} onPress={() => setQrVisible(false)}>
              <Text style={styles.qrBoutonFermerTexte}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════ MODAL ÉDITION ══════════ */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalEnTete}>
            <Text style={styles.modalTitre}>Mon compte</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.texte} />
            </TouchableOpacity>
          </View>

          <View style={styles.onglets}>
            {['infos', 'mdp'].map(id => (
              <TouchableOpacity
                key={id}
                style={[styles.onglet, ongletModal === id && styles.ongletActif]}
                onPress={() => setOngletModal(id)}
              >
                <Text style={[styles.texteOnglet, ongletModal === id && styles.texteOngletActif]}>
                  {id === 'infos' ? 'Mes informations' : 'Mot de passe'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.modalCorps} keyboardShouldPersistTaps="handled">
            {ongletModal === 'infos' ? (
              <View style={styles.formulaire}>
                <ChampFormulaire label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Prénom" />
                <ChampFormulaire label="Nom" value={nom} onChangeText={setNom} placeholder="Nom" />
                <ChampFormulaire label="Téléphone" value={telephone} onChangeText={setTelephone} placeholder="+33 6 00 00 00 00" keyboardType="phone-pad" />

                <View style={styles.champLecture}>
                  <Text style={styles.labelChamp}>Email</Text>
                  <Text style={styles.valeurLecture}>{utilisateur?.email}</Text>
                  <Text style={styles.noteEmail}>L'email ne peut pas être modifié</Text>
                </View>

                <TouchableOpacity
                  style={styles.boutonSauvegarder}
                  onPress={handleSauvegarderInfos}
                  disabled={sauvegarde}
                >
                  {sauvegarde
                    ? <ActivityIndicator color={COLORS.blanc} />
                    : <Text style={styles.texteBoutonModal}>Sauvegarder les modifications</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formulaire}>
                <ChampFormulaire label="Mot de passe actuel" value={ancienMdp} onChangeText={setAncienMdp} placeholder="••••••" secureTextEntry />
                <ChampFormulaire label="Nouveau mot de passe" value={nouveauMdp} onChangeText={setNouveauMdp} placeholder="6 caractères minimum" secureTextEntry />
                <Text style={styles.noteEmail}>Le nouveau mot de passe doit faire au moins 6 caractères.</Text>
                <TouchableOpacity
                  style={styles.boutonSauvegarder}
                  onPress={handleChangerMdp}
                  disabled={sauvegarde}
                >
                  {sauvegarde
                    ? <ActivityIndicator color={COLORS.blanc} />
                    : <Text style={styles.texteBoutonModal}>Changer le mot de passe</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════ CONTENU PRINCIPAL ══════════ */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── CARTE PROFIL ── */}
        <View style={styles.carteProfil}>
          <View style={styles.avatar}>
            <Text style={styles.initiales}>{initiales || '?'}</Text>
          </View>
          <View style={styles.infoUtilisateur}>
            <Text style={styles.nomUtilisateur}>{utilisateur?.prenom} {utilisateur?.nom}</Text>
            <Text style={styles.emailUtilisateur}>{utilisateur?.email}</Text>
          </View>
          <TouchableOpacity style={styles.boutonEditer} onPress={ouvrirModal}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.primaire} />
            <Text style={styles.texteEditer}>Modifier</Text>
          </TouchableOpacity>
        </View>

        {/* ── SECTION RÉSERVATIONS ── */}
        <TitreSection icone="receipt-outline" label="Mes réservations" />

        {chargement ? (
          <View style={styles.centrer}>
            <ActivityIndicator color={COLORS.primaire} />
          </View>
        ) : reservations.length === 0 ? (
          <View style={styles.vide}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.bordure} />
            <Text style={styles.texteVide}>Aucune réservation</Text>
            <Text style={styles.texteClair}>Tes réservations apparaîtront ici</Text>
          </View>
        ) : (
          <View style={styles.groupeSection}>
            {reservationsAffichees.map(item => (
              <CarteReservation
                key={item.id}
                item={item}
                onAnnuler={handleAnnuler}
                onVoirQR={(resa) => { setQrReservation(resa); setQrVisible(true); }}
                onNoter={handleNoter}
              />
            ))}
            {reservations.length > 3 && (
              <TouchableOpacity
                style={styles.boutonVoirPlus}
                onPress={() => setAfficherToutes(v => !v)}
              >
                <Text style={styles.texteVoirPlus}>
                  {afficherToutes
                    ? 'Voir moins'
                    : `Voir les ${reservations.length - 3} autres réservations`}
                </Text>
                <Ionicons
                  name={afficherToutes ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={COLORS.primaire}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── SECTION PARAMÈTRES CARTE ── */}
        <TitreSection icone="map-outline" label="Paramètres de la carte" />

        <View style={styles.groupeSection}>
          <View style={styles.ligneParametre}>
            <View style={styles.iconeParametre}>
              <Ionicons name="locate-outline" size={18} color={COLORS.primaire} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.labelParametre}>Rayon de recherche</Text>
              <Text style={styles.detailParametre}>Pharmacies visibles sur la carte</Text>
            </View>
          </View>

          {/* Sélecteur de rayon */}
          <View style={styles.selecteurRayon}>
            {RAYONS_KM.map(km => (
              <TouchableOpacity
                key={km}
                style={[styles.optionRayon, rayonCarte === km && styles.optionRayonActif]}
                onPress={() => changerRayon(km)}
              >
                <Text style={[styles.texteRayon, rayonCarte === km && styles.texteRayonActif]}>
                  {km} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── SECTION AIDE & SUPPORT ── */}
        <TitreSection icone="help-circle-outline" label="Aide & Support" />

        <View style={styles.groupeSection}>
          <LigneAction
            icone="mail-outline"
            label="Contacter le support"
            detail="support@takendcare.com"
            onPress={() => Linking.openURL('mailto:support@takendcare.com?subject=Support Take%26Care')}
            chevron
          />
          <View style={styles.separateurLigne} />
          <LigneAction
            icone="chatbubble-ellipses-outline"
            label="Assistant IA"
            detail="Pose-nous toutes tes questions"
            badge=""
            disabled
          />
        </View>

        {/* ── SECTION COMPTE ── */}
        <TitreSection icone="person-outline" label="Compte" />

        <View style={styles.groupeSection}>
          <LigneAction
            icone="pencil-outline"
            label="Modifier mes informations"
            onPress={ouvrirModal}
            chevron
          />
          <View style={styles.separateurLigne} />
          <LigneAction
            icone="lock-closed-outline"
            label="Changer le mot de passe"
            onPress={() => { setOngletModal('mdp'); setModalVisible(true); }}
            chevron
          />
          <View style={styles.separateurLigne} />
          <LigneAction
            icone="log-out-outline"
            label="Se déconnecter"
            couleur={COLORS.danger}
            onPress={() =>
              Alert.alert('Déconnexion', 'Confirmer la déconnexion ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnecter', style: 'destructive', onPress: seDeconnecter },
              ])
            }
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------
// Composants internes
// -------------------------------------------------------

function TitreSection({ icone, label }) {
  return (
    <View style={styles.titreSection}>
      <Ionicons name={icone} size={14} color={COLORS.texteClair} />
      <Text style={styles.texteTitreSection}>{label}</Text>
    </View>
  );
}

function LigneAction({ icone, label, detail, onPress, chevron, badge, couleur, disabled }) {
  const couleurIcone = couleur || COLORS.primaire;
  return (
    <TouchableOpacity
      style={[styles.ligneAction, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconeParametre, { backgroundColor: couleurIcone + '15' }]}>
        <Ionicons name={icone} size={18} color={couleurIcone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.labelParametre, couleur && { color: couleur }]}>{label}</Text>
        {detail ? <Text style={styles.detailParametre}>{detail}</Text> : null}
      </View>
      {badge && (
        <View style={styles.badgeBientot}>
          <Text style={styles.texteBadgeBientot}>{badge}</Text>
        </View>
      )}
      {chevron && <Ionicons name="chevron-forward" size={16} color={COLORS.bordure} />}
    </TouchableOpacity>
  );
}

function CarteReservation({ item, onAnnuler, onVoirQR, onNoter }) {
  const statut = STATUTS[item.statut] || STATUTS.confirmee;
  const estConfirmee = item.statut === 'confirmee';
  const estRetiree   = item.statut === 'retiree';
  const dejaNote     = item.noteClient !== null && item.noteClient !== undefined;

  return (
    <View style={styles.carteReservation}>

      {/* Ligne titre + badge statut */}
      <View style={styles.ligneReservation}>
        <Text style={styles.titreOffre} numberOfLines={1}>{item.offre?.titre}</Text>
        <View style={[styles.badgeStatut, { backgroundColor: statut.couleur + '20' }]}>
          <Text style={[styles.texteStatut, { color: statut.couleur }]}>{statut.label}</Text>
        </View>
      </View>

      <Text style={styles.infoPharmacie}>{item.offre?.pharmacie?.nom}</Text>

      {/* Ligne numéro + prix + QR (si confirmée) */}
      <View style={styles.ligneInfosResa}>
        <View style={{ flex: 1 }}>
          <Text style={styles.numero}>N° {item.numero}</Text>
          <Text style={styles.prix}>{(item.prixPaye ?? 0).toFixed(2)} €</Text>
          {item.offre?.heureRetrait && (
            <Text style={styles.heureRetrait}>⏰ Retrait : {item.offre.heureRetrait}</Text>
          )}
        </View>

        {/* Mini QR code + bouton agrandir (seulement si confirmée) */}
        {estConfirmee && (
          <TouchableOpacity
            style={styles.miniQrConteneur}
            onPress={() => onVoirQR(item)}
            activeOpacity={0.8}
          >
            <QRCode
              value={item.numero}
              size={64}
              color={COLORS.primaireF}
              backgroundColor="#fff"
            />
            <View style={styles.miniQrLabel}>
              <Ionicons name="expand-outline" size={11} color={COLORS.primaire} />
              <Text style={styles.miniQrTexte}>Agrandir</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Bouton annuler + QR (si confirmée) */}
      {estConfirmee && (
        <View style={styles.ligneActions}>
          <TouchableOpacity style={styles.boutonAnnuler} onPress={() => onAnnuler(item)}>
            <Text style={styles.texteAnnuler}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonQrPrincipal} onPress={() => onVoirQR(item)}>
            <Ionicons name="qr-code-outline" size={15} color="#fff" />
            <Text style={styles.texteQrPrincipal}>Afficher le QR code</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notation (si retirée et pas encore notée) */}
      {estRetiree && !dejaNote && (
        <View style={styles.blocNotation}>
          <Text style={styles.labelNotation}>Comment s'est passé ton retrait ?</Text>
          <View style={styles.etoilesConteneur}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => onNoter(item.id, n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Ionicons name="star-outline" size={30} color="#F1C40F" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Note déjà donnée */}
      {estRetiree && dejaNote && (
        <View style={styles.noteDeposee}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Ionicons
                key={n}
                name={n <= item.noteClient ? 'star' : 'star-outline'}
                size={16}
                color="#F1C40F"
              />
            ))}
          </View>
          <Text style={styles.texteNoteDeposee}>Ton avis a été pris en compte</Text>
        </View>
      )}
    </View>
  );
}

function ChampFormulaire({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.labelChamp}>{label}</Text>
      <TextInput
        style={styles.champ}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.texteClair}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={secureTextEntry ? 'none' : 'words'}
      />
    </View>
  );
}

// -------------------------------------------------------
// Styles
// -------------------------------------------------------
const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: '#F0F4F0',
  },
  scroll: {
    paddingBottom: 20,
  },

  // Carte profil
  carteProfil: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blanc,
    marginHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 60 : 20,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaire,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  initiales: {
    color: COLORS.blanc,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoUtilisateur: {
    flex: 1,
  },
  nomUtilisateur: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primaireF,
  },
  emailUtilisateur: {
    fontSize: 13,
    color: COLORS.texteClair,
    marginTop: 2,
  },
  boutonEditer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaire + '15',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  texteEditer: {
    color: COLORS.primaire,
    fontSize: 13,
    fontWeight: '700',
  },

  // Titres de section
  titreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  texteTitreSection: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.texteClair,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Groupe carte blanche
  groupeSection: {
    backgroundColor: COLORS.blanc,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  // Réservations
  carteReservation: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F0',
    gap: 5,
  },
  ligneReservation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titreOffre: {
    fontSize: 15,
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
    fontSize: 11,
    fontWeight: '700',
  },
  infoPharmacie: {
    fontSize: 13,
    color: COLORS.texteClair,
  },
  ligneInfosResa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  numero: {
    fontSize: 11,
    color: COLORS.texteClair,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  prix: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaire,
  },
  heureRetrait: {
    fontSize: 12,
    color: COLORS.texteClair,
  },
  ligneActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  boutonAnnuler: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  texteAnnuler: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  boutonQrPrincipal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primaire,
    borderRadius: 8,
    paddingVertical: 8,
  },
  texteQrPrincipal: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  miniQrConteneur: {
    alignItems: 'center',
    gap: 4,
    marginLeft: 12,
    flexShrink: 0,
  },
  miniQrLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  miniQrTexte: {
    fontSize: 10,
    color: COLORS.primaire,
    fontWeight: '600',
  },

  // Notation
  blocNotation: {
    borderTopWidth: 1,
    borderTopColor: '#F0F4F0',
    marginTop: 10,
    paddingTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  labelNotation: {
    fontSize: 13,
    color: COLORS.texteClair,
    fontWeight: '500',
  },
  etoilesConteneur: {
    flexDirection: 'row',
    gap: 8,
  },
  noteDeposee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F0',
    marginTop: 10,
    paddingTop: 10,
  },
  texteNoteDeposee: {
    fontSize: 12,
    color: COLORS.texteClair,
    fontStyle: 'italic',
  },

  // Modal QR plein écran
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrCarte: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  qrEnTete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  qrTitre: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaireF,
  },
  qrSousTitre: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.texte,
    textAlign: 'center',
    marginBottom: 2,
  },
  qrPharmacie: {
    fontSize: 13,
    color: COLORS.texteClair,
    textAlign: 'center',
    marginBottom: 20,
  },
  qrConteneur: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    marginBottom: 20,
  },
  qrNumeroConteneur: {
    alignItems: 'center',
    marginBottom: 12,
  },
  qrNumeroLabel: {
    fontSize: 11,
    color: COLORS.texteClair,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  qrNumero: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaireF,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  qrMontantLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: COLORS.primaire + '10',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  qrMontantLabel: {
    fontSize: 14,
    color: COLORS.texte,
    fontWeight: '500',
  },
  qrMontant: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaire,
  },
  qrHeureLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  qrHeureTexte: {
    fontSize: 13,
    color: COLORS.texteClair,
  },
  qrBoutonFermer: {
    width: '100%',
    backgroundColor: COLORS.fondClair,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  qrBoutonFermerTexte: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.texte,
  },
  boutonVoirPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F0',
  },
  texteVoirPlus: {
    color: COLORS.primaire,
    fontWeight: '600',
    fontSize: 14,
  },

  // Paramètres
  ligneParametre: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  ligneAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  separateurLigne: {
    height: 1,
    backgroundColor: '#F0F4F0',
    marginLeft: 60,
  },
  iconeParametre: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaire + '15',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  labelParametre: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.texte,
  },
  detailParametre: {
    fontSize: 12,
    color: COLORS.texteClair,
    marginTop: 1,
  },

  // Sélecteur rayon
  selecteurRayon: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  optionRayon: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.bordure,
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
  },
  optionRayonActif: {
    borderColor: COLORS.primaire,
    backgroundColor: COLORS.primaire + '15',
  },
  texteRayon: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.texteClair,
  },
  texteRayonActif: {
    color: COLORS.primaire,
    fontWeight: '800',
  },

  // Badge "Bientôt"
  badgeBientot: {
    backgroundColor: COLORS.attention + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  texteBadgeBientot: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.attention,
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
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.texteClair,
  },
  texteOngletActif: {
    color: COLORS.primaire,
    fontWeight: '700',
  },
  modalCorps: {
    flex: 1,
    backgroundColor: '#F8FAF8',
  },
  formulaire: {
    padding: 20,
    gap: 4,
  },
  labelChamp: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.texte,
    marginTop: 12,
    marginBottom: 6,
  },
  champ: {
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.texte,
  },
  champLecture: {
    marginTop: 16,
    backgroundColor: COLORS.blanc,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  valeurLecture: {
    fontSize: 15,
    color: COLORS.texte,
    marginTop: 4,
  },
  noteEmail: {
    fontSize: 12,
    color: COLORS.texteClair,
    marginTop: 8,
    fontStyle: 'italic',
  },
  boutonSauvegarder: {
    backgroundColor: COLORS.primaire,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  texteBoutonModal: {
    color: COLORS.blanc,
    fontSize: 16,
    fontWeight: '700',
  },

  // États
  centrer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  vide: {
    backgroundColor: COLORS.blanc,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  texteVide: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.texte,
  },
  texteClair: {
    color: COLORS.texteClair,
    fontSize: 13,
  },
});
