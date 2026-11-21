// ============================================================
// routes/auth.js — Comptes : inscription, connexion, profil,
// mot de passe oublié, suppression de compte
// ============================================================

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const validator = require('validator');
const { Expo } = require('expo-server-sdk');
const sequelize = require('../database/connection');
const { Utilisateur, Pharmacie, Offre, Reservation, Favori } = require('../database/models');
const { envoyerSMS, normaliserTelephone, estMobileFrancais } = require('../utils/sms');
const { envoyerEmail } = require('../utils/email');
const { creerCode, verifierCode, donneesEnAttente } = require('../utils/codes');
const { annulerReservation } = require('../utils/reservations');
const authMiddleware = require('../middleware/auth');
const { limiteAuth } = require('../utils/rateLimits');

const MOT_DE_PASSE_MIN = 8;

function validerChampTexte(valeur, min, max, nom) {
  if (!valeur || typeof valeur !== 'string') return `${nom} est obligatoire.`;
  const v = valeur.trim();
  if (v.length < min) return `${nom} doit faire au moins ${min} caractères.`;
  if (v.length > max) return `${nom} ne peut pas dépasser ${max} caractères.`;
  return null;
}

function validerChampOptionnel(valeur, max, nom) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  if (typeof valeur !== 'string') return `${nom} est invalide.`;
  if (valeur.trim().length > max) return `${nom} ne peut pas dépasser ${max} caractères.`;
  return null;
}

// Retourne l'email normalisé, ou null s'il est invalide
function normaliserEmail(email) {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  return validator.isEmail(e) ? e : null;
}

function validerMotDePasse(motDePasse) {
  if (typeof motDePasse !== 'string' || motDePasse.length < MOT_DE_PASSE_MIN) {
    return `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`;
  }
  if (Buffer.byteLength(motDePasse) > 72) {
    // bcrypt ignore tout ce qui dépasse 72 octets
    return 'Le mot de passe ne peut pas dépasser 72 caractères.';
  }
  if (!/[A-Za-z]/.test(motDePasse) || !/\d/.test(motDePasse)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return null;
}

function validerTelephone(telephone) {
  if (!telephone || typeof telephone !== 'string') return null;
  const n = normaliserTelephone(telephone);
  return /^\+\d{8,15}$/.test(n) ? n : null;
}

// Aperçu masqué d'un numéro (ex: +336******89)
function apercuTelephone(numero) {
  return numero.slice(0, 4) + '*'.repeat(Math.max(numero.length - 6, 0)) + numero.slice(-2);
}

// Token JWT valable 7 jours. "v" = tokenVersion : changer de mot de passe
// incrémente la version et invalide tous les anciens tokens.
function genererToken(utilisateur) {
  return jwt.sign(
    { id: utilisateur.id, v: utilisateur.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function profilPublic(utilisateur, pharmacieValidee) {
  return {
    id:          utilisateur.id,
    prenom:      utilisateur.prenom,
    nom:         utilisateur.nom,
    email:       utilisateur.email,
    telephone:   utilisateur.telephone,
    pharmacieId: utilisateur.pharmacieId,
    notifOffres: utilisateur.notifOffres,
    ...(utilisateur.estAdmin ? { estAdmin: true } : {}),
    ...(utilisateur.pharmacieId ? { pharmacieValidee: !!pharmacieValidee } : {}),
  };
}

function repondreErreur(res, err) {
  if (err.status) return res.status(err.status).json({ erreur: err.message });
  console.error(err);
  return res.status(500).json({ erreur: 'Erreur serveur.' });
}

// -------------------------------------------------------
// POST /api/auth/connexion
// Body : { email, motDePasse }
// -------------------------------------------------------
router.post('/connexion', limiteAuth, async (req, res) => {
  const { motDePasse } = req.body;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : null;

  if (!email || typeof motDePasse !== 'string' || !motDePasse) {
    return res.status(400).json({ erreur: 'Email et mot de passe requis.' });
  }

  try {
    const utilisateur = await Utilisateur.findOne({
      where: { email },
      include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['valide'] }],
    });
    // Message volontairement vague pour ne pas indiquer si l'email existe
    if (!utilisateur || utilisateur.supprimeLe || !(await bcrypt.compare(motDePasse, utilisateur.motDePasse))) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    res.json({
      message: 'Connexion réussie !',
      token: genererToken(utilisateur),
      utilisateur: profilPublic(utilisateur, utilisateur.pharmacie?.valide),
    });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// GET /api/auth/moi
// -------------------------------------------------------
router.get('/moi', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    res.json(profilPublic(utilisateur, req.utilisateur.pharmacieValidee));
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// PUT /api/auth/profil
// Modifie prénom et nom. Le téléphone d'un client est vérifié par SMS
// (voir /telephone/demander) ; un pharmacien peut le modifier ici.
// -------------------------------------------------------
router.put('/profil', authMiddleware, async (req, res) => {
  const { prenom, nom, telephone } = req.body;

  const erreur = validerChampTexte(prenom, 2, 50, 'Prénom')
              || validerChampTexte(nom, 2, 50, 'Nom');
  if (erreur) return res.status(400).json({ erreur });

  const changements = { prenom: prenom.trim(), nom: nom.trim() };

  if (req.utilisateur.pharmacieId && telephone !== undefined) {
    if (telephone === null || telephone === '') {
      changements.telephone = null;
    } else {
      const telephoneNormalise = validerTelephone(telephone);
      if (!telephoneNormalise) return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });
      changements.telephone = telephoneNormalise;
    }
  }

  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    await utilisateur.update(changements);
    res.json({ message: 'Profil mis à jour.', utilisateur: profilPublic(utilisateur, req.utilisateur.pharmacieValidee) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/telephone/demander — Étape 1 du changement de
// téléphone : envoie un code au nouveau numéro. Body : { telephone }
// -------------------------------------------------------
router.post('/telephone/demander', limiteAuth, authMiddleware, async (req, res) => {
  const numero = validerTelephone(req.body.telephone);
  if (!numero || !estMobileFrancais(numero)) {
    return res.status(400).json({ erreur: 'Saisis un numéro de mobile français valide (06 ou 07).' });
  }

  try {
    const code = await creerCode({ type: 'telephone', cle: numero, donnees: { utilisateurId: req.utilisateur.id } });
    await envoyerSMS(numero, `Take & Care — Code de confirmation de ton nouveau numéro : ${code} (valable 10 min)`);
    res.json({ message: 'Code envoyé !', apercu: apercuTelephone(numero) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/telephone/confirmer — Body : { telephone, code }
// -------------------------------------------------------
router.post('/telephone/confirmer', limiteAuth, authMiddleware, async (req, res) => {
  const numero = validerTelephone(req.body.telephone);
  if (!numero) return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });

  try {
    const donnees = await donneesEnAttente({ type: 'telephone', cle: numero });
    if (!donnees || donnees.utilisateurId !== req.utilisateur.id) {
      return res.status(400).json({ erreur: 'Aucun code en attente pour ce numéro.' });
    }
    await verifierCode({ type: 'telephone', cle: numero, code: req.body.code });

    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    await utilisateur.update({ telephone: numero });
    res.json({ message: 'Numéro mis à jour.', utilisateur: profilPublic(utilisateur, req.utilisateur.pharmacieValidee) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// PUT /api/auth/mot-de-passe
// Change le mot de passe (vérifie l'ancien) et déconnecte les autres
// sessions. Renvoie un nouveau token pour la session courante.
// -------------------------------------------------------
router.put('/mot-de-passe', limiteAuth, authMiddleware, async (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body;
  if (typeof ancienMotDePasse !== 'string' || !ancienMotDePasse || !nouveauMotDePasse) {
    return res.status(400).json({ erreur: 'Les deux mots de passe sont requis.' });
  }
  const erreurMdp = validerMotDePasse(nouveauMotDePasse);
  if (erreurMdp) return res.status(400).json({ erreur: erreurMdp });

  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    const valide = await bcrypt.compare(ancienMotDePasse, utilisateur.motDePasse);
    if (!valide) {
      return res.status(401).json({ erreur: 'Ancien mot de passe incorrect.' });
    }
    const hash = await bcrypt.hash(nouveauMotDePasse, 10);
    await utilisateur.update({ motDePasse: hash, tokenVersion: utilisateur.tokenVersion + 1 });
    res.json({ message: 'Mot de passe modifié avec succès.', token: genererToken(utilisateur) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/mot-de-passe-oublie — Body : { email }
// Envoie un code par email. Réponse identique que le compte existe
// ou non (on ne révèle pas quels emails sont inscrits).
// -------------------------------------------------------
router.post('/mot-de-passe-oublie', limiteAuth, async (req, res) => {
  const email = normaliserEmail(req.body.email);
  if (!email) return res.status(400).json({ erreur: 'Email invalide.' });

  const reponse = { message: 'Si un compte existe avec cet email, un code vient de t\'être envoyé.' };

  try {
    const utilisateur = await Utilisateur.findOne({ where: { email } });
    if (!utilisateur || utilisateur.supprimeLe) return res.json(reponse);

    let code;
    try {
      code = await creerCode({ type: 'reinitialisation', cle: email, donnees: { utilisateurId: utilisateur.id } });
    } catch (err) {
      // Trop de demandes : on ne le signale pas (même réponse)
      if (err.status === 429) return res.json(reponse);
      throw err;
    }

    await envoyerEmail(
      email,
      'Take & Care — Réinitialisation de ton mot de passe',
      `Bonjour ${utilisateur.prenom},\n\n` +
      `Ton code pour choisir un nouveau mot de passe : ${code}\n` +
      `Il est valable 10 minutes.\n\n` +
      `Si tu n'es pas à l'origine de cette demande, ignore cet email : ton mot de passe ne change pas.`
    );
    res.json(reponse);
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/reinitialiser-mot-de-passe
// Body : { email, code, nouveauMotDePasse }
// -------------------------------------------------------
router.post('/reinitialiser-mot-de-passe', limiteAuth, async (req, res) => {
  const email = normaliserEmail(req.body.email);
  if (!email) return res.status(400).json({ erreur: 'Email invalide.' });
  const erreurMdp = validerMotDePasse(req.body.nouveauMotDePasse);
  if (erreurMdp) return res.status(400).json({ erreur: erreurMdp });

  try {
    const donnees = await verifierCode({ type: 'reinitialisation', cle: email, code: req.body.code });
    const utilisateur = await Utilisateur.findByPk(donnees?.utilisateurId);
    if (!utilisateur || utilisateur.supprimeLe || utilisateur.email !== email) {
      return res.status(400).json({ erreur: 'Compte introuvable.' });
    }
    const hash = await bcrypt.hash(req.body.nouveauMotDePasse, 10);
    // tokenVersion + 1 : toutes les sessions ouvertes sont déconnectées
    await utilisateur.update({ motDePasse: hash, tokenVersion: utilisateur.tokenVersion + 1 });
    res.json({ message: 'Mot de passe modifié. Tu peux te connecter.' });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/deconnexion-partout
// -------------------------------------------------------
router.post('/deconnexion-partout', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    await utilisateur.update({ tokenVersion: utilisateur.tokenVersion + 1 });
    res.json({ message: 'Toutes les autres sessions ont été déconnectées.', token: genererToken(utilisateur) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// PUT /api/auth/push-token
// Body : { pushToken, latitude?, longitude? }
// La position (facultative) est arrondie à ~1 km et sert uniquement
// à envoyer les nouvelles offres des pharmacies proches.
// -------------------------------------------------------
router.put('/push-token', authMiddleware, async (req, res) => {
  const { pushToken } = req.body;
  if (typeof pushToken !== 'string' || !Expo.isExpoPushToken(pushToken)) {
    return res.status(400).json({ erreur: 'pushToken invalide.' });
  }

  const lat = parseFloat(req.body.latitude);
  const lng = parseFloat(req.body.longitude);
  const position = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { notifLat: Math.round(lat * 100) / 100, notifLng: Math.round(lng * 100) / 100 }
    : {};

  try {
    // Un appareil = un compte : retire ce token des autres comptes
    await Utilisateur.update({ pushToken: null }, { where: { pushToken } });
    await Utilisateur.update({ pushToken, ...position }, { where: { id: req.utilisateur.id } });
    res.json({ message: 'Token enregistré.' });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// DELETE /api/auth/push-token — appelé à la déconnexion
router.delete('/push-token', authMiddleware, async (req, res) => {
  try {
    await Utilisateur.update({ pushToken: null }, { where: { id: req.utilisateur.id } });
    res.json({ message: 'Notifications désactivées sur cet appareil.' });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// PUT /api/auth/notifications — Body : { notifOffres: boolean }
router.put('/notifications', authMiddleware, async (req, res) => {
  if (typeof req.body.notifOffres !== 'boolean') {
    return res.status(400).json({ erreur: 'notifOffres doit être vrai ou faux.' });
  }
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    await utilisateur.update({ notifOffres: req.body.notifOffres });
    res.json({ message: 'Préférence enregistrée.', utilisateur: profilPublic(utilisateur, req.utilisateur.pharmacieValidee) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/demander-verification
// Étape 1 inscription : envoie un code SMS
// Body : { prenom, nom, email, motDePasse, telephone }
// -------------------------------------------------------
router.post('/demander-verification', limiteAuth, async (req, res) => {
  const { prenom, nom, motDePasse, telephone } = req.body;

  const erreur = validerChampTexte(prenom, 2, 50, 'Prénom')
              || validerChampTexte(nom, 2, 50, 'Nom');
  if (erreur) return res.status(400).json({ erreur });

  const email = normaliserEmail(req.body.email);
  if (!email) return res.status(400).json({ erreur: 'Email invalide.' });

  const erreurMdp = validerMotDePasse(motDePasse);
  if (erreurMdp) return res.status(400).json({ erreur: erreurMdp });

  const numero = validerTelephone(telephone);
  if (!numero || !estMobileFrancais(numero)) {
    return res.status(400).json({ erreur: 'Saisis un numéro de mobile français valide (06 ou 07).' });
  }

  try {
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    // Le mot de passe est haché tout de suite : jamais gardé en clair
    const code = await creerCode({
      type: 'inscription',
      cle:  numero,
      donnees: { prenom: prenom.trim(), nom: nom.trim(), email, hash: await bcrypt.hash(motDePasse, 10) },
    });

    await envoyerSMS(numero, `Take & Care — Ton code de vérification : ${code} (valable 10 min)`);
    res.json({ message: 'Code envoyé !', apercu: apercuTelephone(numero) });
  } catch (err) {
    if (err.status) return repondreErreur(res, err);
    console.error(err);
    res.status(500).json({ erreur: 'Impossible d\'envoyer le SMS. Vérifie le numéro.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/renvoyer-code — Body : { telephone }
// Renvoie un code d'inscription avec les données déjà saisies
// -------------------------------------------------------
router.post('/renvoyer-code', limiteAuth, async (req, res) => {
  const numero = validerTelephone(req.body.telephone);
  if (!numero) return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });

  try {
    const donnees = await donneesEnAttente({ type: 'inscription', cle: numero });
    if (!donnees) return res.status(400).json({ erreur: 'Inscription expirée. Recommence l\'inscription.' });
    const code = await creerCode({ type: 'inscription', cle: numero });
    await envoyerSMS(numero, `Take & Care — Ton code de vérification : ${code} (valable 10 min)`);
    res.json({ message: 'Code renvoyé !', apercu: apercuTelephone(numero) });
  } catch (err) {
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/confirmer-inscription
// Étape 2 inscription : vérifie le code et crée le compte
// Body : { telephone, code }
// -------------------------------------------------------
router.post('/confirmer-inscription', limiteAuth, async (req, res) => {
  const { telephone, code } = req.body;

  if (typeof telephone !== 'string' || !telephone || (typeof code !== 'string' && typeof code !== 'number')) {
    return res.status(400).json({ erreur: 'Téléphone et code sont requis.' });
  }

  const numero = normaliserTelephone(telephone);
  try {
    const { prenom, nom, email, hash } = await verifierCode({ type: 'inscription', cle: numero, code });
    const utilisateur = await Utilisateur.create({
      prenom, nom, email, telephone: numero,
      motDePasse: hash,
    });

    res.status(201).json({
      message: 'Compte créé avec succès !',
      token: genererToken(utilisateur),
      utilisateur: profilPublic(utilisateur),
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// POST /api/auth/inscription-pharmacien
// Crée un compte pharmacien + sa pharmacie en une transaction.
// La pharmacie est créée "en attente" : elle ne peut ni publier
// d'offres ni encaisser tant qu'un admin ne l'a pas validée
// (npm run valider-pharmacie -- <id>).
// -------------------------------------------------------
router.post('/inscription-pharmacien', limiteAuth, async (req, res) => {
  const {
    prenom, nom, motDePasse,
    nomPharmacie, adresse, telephone, horaires,
    latitude, longitude,
  } = req.body;

  const erreur = validerChampTexte(prenom, 2, 50, 'Prénom')
              || validerChampTexte(nom, 2, 50, 'Nom')
              || validerChampTexte(nomPharmacie, 2, 100, 'Le nom de la pharmacie')
              || validerChampTexte(adresse, 5, 200, 'L\'adresse')
              || validerChampOptionnel(horaires, 200, 'Les horaires');
  if (erreur) return res.status(400).json({ erreur });

  const email = normaliserEmail(req.body.email);
  if (!email) return res.status(400).json({ erreur: 'Email invalide.' });

  const erreurMdp = validerMotDePasse(motDePasse);
  if (erreurMdp) return res.status(400).json({ erreur: erreurMdp });

  let telephoneNormalise = '';
  if (telephone) {
    telephoneNormalise = validerTelephone(telephone);
    if (!telephoneNormalise) return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ erreur: 'Adresse introuvable : utilise « Localiser l\'adresse » ou ta position actuelle.' });
  }

  try {
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    const hash = await bcrypt.hash(motDePasse, 10);
    let pharmacien;

    await sequelize.transaction(async (t) => {
      const pharmacie = await Pharmacie.create({
        nom:       nomPharmacie.trim(),
        adresse:   adresse.trim(),
        telephone: telephoneNormalise,
        horaires:  (horaires || '').trim(),
        latitude:  lat,
        longitude: lng,
        note:      0,
        valide:    false,
      }, { transaction: t });

      pharmacien = await Utilisateur.create({
        prenom: prenom.trim(),
        nom:    nom.trim(),
        email,
        motDePasse:  hash,
        telephone:   telephoneNormalise,
        pharmacieId: pharmacie.id,
      }, { transaction: t });
    });

    console.log(`🆕 Pharmacie #${pharmacien.pharmacieId} inscrite, en attente de validation : npm run valider-pharmacie -- ${pharmacien.pharmacieId}`);

    res.status(201).json({
      message: 'Compte pharmacien créé ! Ta pharmacie sera visible après validation par notre équipe.',
      token: genererToken(pharmacien),
      utilisateur: profilPublic(pharmacien, false),
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }
    repondreErreur(res, err);
  }
});

// -------------------------------------------------------
// DELETE /api/auth/compte — Body : { motDePasse }
// Suppression du compte (exigée par l'App Store et le RGPD).
// Les données personnelles sont anonymisées ; les réservations passées
// restent (anonymes) pour la comptabilité des pharmacies.
// - Client : ses réservations en cours sont annulées et remboursées.
// - Pharmacien : refusé s'il reste des paniers à retirer ; sinon ses
//   offres sont masquées et la pharmacie n'est plus visible.
// -------------------------------------------------------
router.delete('/compte', limiteAuth, authMiddleware, async (req, res) => {
  const { motDePasse } = req.body;
  if (typeof motDePasse !== 'string' || !motDePasse) {
    return res.status(400).json({ erreur: 'Confirme avec ton mot de passe.' });
  }

  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    if (!(await bcrypt.compare(motDePasse, utilisateur.motDePasse))) {
      return res.status(401).json({ erreur: 'Mot de passe incorrect.' });
    }

    const pharmacieId = utilisateur.pharmacieId;
    if (pharmacieId) {
      const enCours = await Reservation.count({
        where: { statut: 'confirmee' },
        include: [{ model: Offre, as: 'offre', where: { pharmacieId }, required: true }],
      });
      if (enCours > 0) {
        return res.status(409).json({
          erreur: `Il reste ${enCours} panier(s) à retirer. Valide ou laisse expirer ces réservations avant de supprimer ton compte.`,
        });
      }
    } else {
      // Annule (et rembourse) les réservations en cours, une par une
      const enCours = await Reservation.findAll({
        where: { utilisateurId: utilisateur.id, statut: 'confirmee' },
        attributes: ['id'],
      });
      for (const { id } of enCours) {
        await annulerReservation({ reservationId: id, utilisateurId: utilisateur.id });
      }
    }

    await sequelize.transaction(async (t) => {
      if (pharmacieId) {
        await Offre.update({ actif: false }, { where: { pharmacieId }, transaction: t });
        await Pharmacie.update({ valide: false }, { where: { id: pharmacieId }, transaction: t });
      }
      await Favori.destroy({ where: { utilisateurId: utilisateur.id }, transaction: t });
      await utilisateur.update({
        prenom:      'Compte',
        nom:         'supprimé',
        email:       `supprime-${utilisateur.id}-${crypto.randomBytes(4).toString('hex')}@supprime.invalid`,
        motDePasse:  await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        telephone:   null,
        pushToken:   null,
        notifLat:    null,
        notifLng:    null,
        notifOffres: false,
        pharmacieId: null,
        tokenVersion: utilisateur.tokenVersion + 1,
        supprimeLe:  new Date(),
      }, { transaction: t });
    });

    res.json({ message: 'Ton compte a été supprimé.' });
  } catch (err) {
    repondreErreur(res, err);
  }
});

module.exports = router;
