// ============================================================
// routes/auth.js — Inscription et connexion
// ============================================================

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const validator = require('validator');
const { randomInt } = require('crypto');
const { Expo } = require('expo-server-sdk');
const sequelize = require('../database/connection');
const { Utilisateur, Pharmacie } = require('../database/models');
const { envoyerSMS, normaliserTelephone } = require('../utils/sms');
const authMiddleware = require('../middleware/auth');
const { limiteAuth } = require('../utils/rateLimits');

const MOT_DE_PASSE_MIN = 6;
const CODE_ESSAIS_MAX  = 5;

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
  if (motDePasse.length > 72) {
    // bcrypt ignore tout ce qui dépasse 72 octets
    return 'Le mot de passe ne peut pas dépasser 72 caractères.';
  }
  return null;
}

function validerTelephone(telephone) {
  if (!telephone || typeof telephone !== 'string') return null;
  const n = normaliserTelephone(telephone);
  return /^\+\d{8,15}$/.test(n) ? n : null;
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
    ...(utilisateur.pharmacieId ? { pharmacieValidee: !!pharmacieValidee } : {}),
  };
}

// Stockage temporaire des codes de vérification en mémoire
// { telephone_normalisé: { code, expireAt, essais, donnees } }
// ⚠️ Perdu au redémarrage du serveur : l'utilisateur doit redemander un code.
const codesVerification = new Map();

// Rate-limit SMS : max 3 demandes par 10 min par numéro
// { telephone_normalisé: { count, resetAt } }
const rateLimitSMS = new Map();

// Nettoyage automatique des codes expirés et des entrées rate-limit toutes les 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [cle, val] of codesVerification.entries()) {
    if (val.expireAt < now) codesVerification.delete(cle);
  }
  for (const [cle, val] of rateLimitSMS.entries()) {
    if (val.resetAt < now) rateLimitSMS.delete(cle);
  }
}, 15 * 60 * 1000).unref();

// -------------------------------------------------------
// POST /api/auth/connexion
// Connecte un utilisateur existant
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
    if (!utilisateur || !(await bcrypt.compare(motDePasse, utilisateur.motDePasse))) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    res.json({
      message: 'Connexion réussie !',
      token: genererToken(utilisateur),
      utilisateur: profilPublic(utilisateur, utilisateur.pharmacie?.valide),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// GET /api/auth/moi
// Retourne les infos de l'utilisateur connecté
// -------------------------------------------------------
router.get('/moi', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    res.json(profilPublic(utilisateur, req.utilisateur.pharmacieValidee));
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// PUT /api/auth/profil
// Modifie les infos du compte (prenom, nom, telephone)
// -------------------------------------------------------
router.put('/profil', authMiddleware, async (req, res) => {
  const { prenom, nom, telephone } = req.body;

  const erreur = validerChampTexte(prenom, 2, 50, 'Prénom')
              || validerChampTexte(nom, 2, 50, 'Nom');
  if (erreur) return res.status(400).json({ erreur });

  let telephoneNormalise;
  if (telephone !== undefined && telephone !== null && telephone !== '') {
    telephoneNormalise = validerTelephone(telephone);
    if (!telephoneNormalise) return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });
  }

  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    await utilisateur.update({
      prenom: prenom.trim(),
      nom:    nom.trim(),
      ...(telephoneNormalise ? { telephone: telephoneNormalise } : {}),
    });
    res.json({ message: 'Profil mis à jour.', utilisateur: profilPublic(utilisateur, req.utilisateur.pharmacieValidee) });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
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
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/deconnexion-partout
// Invalide tous les tokens (autres appareils, navigateurs oubliés…)
// et renvoie un nouveau token pour la session courante.
// -------------------------------------------------------
router.post('/deconnexion-partout', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    await utilisateur.update({ tokenVersion: utilisateur.tokenVersion + 1 });
    res.json({ message: 'Toutes les autres sessions ont été déconnectées.', token: genererToken(utilisateur) });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// PUT /api/auth/push-token
// Sauvegarde le token Expo push de l'utilisateur connecté
// Body : { pushToken }
// -------------------------------------------------------
router.put('/push-token', authMiddleware, async (req, res) => {
  const { pushToken } = req.body;
  if (typeof pushToken !== 'string' || !Expo.isExpoPushToken(pushToken)) {
    return res.status(400).json({ erreur: 'pushToken invalide.' });
  }

  try {
    await Utilisateur.update(
      { pushToken },
      { where: { id: req.utilisateur.id } }
    );
    res.json({ message: 'Token enregistré.' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/demander-verification
// Étape 1 inscription : génère un code SMS et le stocke temporairement
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

  const numeroNormalise = validerTelephone(telephone);
  if (!numeroNormalise) return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });

  try {
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    // Rate-limit : max 3 SMS par 10 minutes pour ce numéro
    const rl = rateLimitSMS.get(numeroNormalise);
    if (rl && rl.resetAt > Date.now()) {
      if (rl.count >= 3) {
        const attente = Math.ceil((rl.resetAt - Date.now()) / 60000);
        return res.status(429).json({ erreur: `Trop de tentatives. Réessaie dans ${attente} minute(s).` });
      }
      rl.count++;
    } else {
      rateLimitSMS.set(numeroNormalise, { count: 1, resetAt: Date.now() + 10 * 60 * 1000 });
    }

    // Code à 6 chiffres cryptographiquement sûr valable 10 minutes.
    // Le mot de passe est haché tout de suite : jamais gardé en clair en mémoire.
    const code = String(randomInt(100000, 1000000));
    codesVerification.set(numeroNormalise, {
      code,
      essais:   0,
      expireAt: Date.now() + 10 * 60 * 1000,
      donnees:  {
        prenom: prenom.trim(),
        nom:    nom.trim(),
        email,
        hash:   await bcrypt.hash(motDePasse, 10),
      },
    });

    await envoyerSMS(
      numeroNormalise,
      `Take & Care — Ton code de vérification : ${code} (valable 10 min)`
    );

    // Retourne un aperçu masqué du numéro (ex: +33 6 ** ** ** 89)
    const apercu = numeroNormalise.slice(0, -2).replace(/\d(?=\d{2})/g, '*') + numeroNormalise.slice(-2);

    res.json({ message: 'Code envoyé !', apercu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Impossible d\'envoyer le SMS. Vérifie le numéro.' });
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

  const numeroNormalise = normaliserTelephone(telephone);
  const entree = codesVerification.get(numeroNormalise);

  if (!entree) {
    return res.status(400).json({ erreur: 'Aucun code en attente pour ce numéro. Recommence l\'inscription.' });
  }
  if (Date.now() > entree.expireAt) {
    codesVerification.delete(numeroNormalise);
    return res.status(400).json({ erreur: 'Code expiré. Recommence l\'inscription.' });
  }
  if (entree.code !== String(code).trim()) {
    // Limite les essais par code pour empêcher de deviner par force brute
    entree.essais++;
    if (entree.essais >= CODE_ESSAIS_MAX) {
      codesVerification.delete(numeroNormalise);
      return res.status(400).json({ erreur: 'Trop d\'essais incorrects. Recommence l\'inscription.' });
    }
    return res.status(400).json({ erreur: `Code incorrect. ${CODE_ESSAIS_MAX - entree.essais} essai(s) restant(s).` });
  }

  // Code valide → crée le compte
  codesVerification.delete(numeroNormalise);
  try {
    const { prenom, nom, email, hash } = entree.donnees;
    const utilisateur = await Utilisateur.create({
      prenom, nom, email, telephone: numeroNormalise,
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
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/inscription-pharmacien
// Crée un compte pharmacien + sa pharmacie en une transaction.
// La pharmacie est créée "en attente" : elle ne peut ni publier
// d'offres ni encaisser tant qu'un admin ne l'a pas validée
// (npm run valider-pharmacie -- <id>).
// Body : { prenom, nom, email, motDePasse,
//          nomPharmacie, adresse, telephone, horaires,
//          latitude, longitude }
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
    return res.status(400).json({ erreur: 'Latitude et longitude valides sont obligatoires pour la pharmacie.' });
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
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
