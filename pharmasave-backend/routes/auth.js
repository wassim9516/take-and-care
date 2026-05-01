// ============================================================
// routes/auth.js — Inscription et connexion
// ============================================================

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const validator = require('validator');
const sequelize = require('../database/connection');
const { Utilisateur, Pharmacie } = require('../database/models');
const { envoyerSMS, normaliserTelephone } = require('../utils/sms');

function validerChampTexte(valeur, min, max, nom) {
  if (!valeur || typeof valeur !== 'string') return `${nom} est obligatoire.`;
  const v = valeur.trim();
  if (v.length < min) return `${nom} doit faire au moins ${min} caractères.`;
  if (v.length > max) return `${nom} ne peut pas dépasser ${max} caractères.`;
  return null;
}

// Stockage temporaire des codes de vérification en mémoire
// { telephone_normalisé: { code, expireAt, donnees } }
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
}, 15 * 60 * 1000);

// -------------------------------------------------------
// POST /api/auth/inscription
// Crée un nouveau compte utilisateur
// Body : { prenom, nom, email, motDePasse, telephone? }
// -------------------------------------------------------
router.post('/inscription', async (req, res) => {
  const { prenom, nom, email, motDePasse, telephone } = req.body;

  const errPrenom = validerChampTexte(prenom, 2, 50, 'Prénom');
  const errNom    = validerChampTexte(nom, 2, 50, 'Nom');
  if (errPrenom) return res.status(400).json({ erreur: errPrenom });
  if (errNom)    return res.status(400).json({ erreur: errNom });
  if (!email || !validator.isEmail(String(email))) {
    return res.status(400).json({ erreur: 'Email invalide.' });
  }
  if (!motDePasse || motDePasse.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 6 caractères.' });
  }
  if (!telephone) {
    return res.status(400).json({ erreur: 'Téléphone obligatoire.' });
  }

  try {
    // Vérifie si l'email est déjà utilisé
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    // Hashe le mot de passe (jamais stocker en clair)
    // Le "10" est le nombre de rounds de hachage — plus c'est élevé, plus c'est sécurisé
    const hash = await bcrypt.hash(motDePasse, 10);

    // Crée l'utilisateur en base
    const utilisateur = await Utilisateur.create({
      prenom, nom, email, telephone,
      motDePasse: hash,
    });

    // Génère un token JWT valable 7 jours
    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, pharmacieId: utilisateur.pharmacieId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès !',
      token,
      utilisateur: {
        id:          utilisateur.id,
        prenom:      utilisateur.prenom,
        nom:         utilisateur.nom,
        email:       utilisateur.email,
        telephone:   utilisateur.telephone,
        pharmacieId: utilisateur.pharmacieId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/connexion
// Connecte un utilisateur existant
// Body : { email, motDePasse }
// -------------------------------------------------------
router.post('/connexion', async (req, res) => {
  const { email, motDePasse } = req.body;

  if (!email || !motDePasse) {
    return res.status(400).json({ erreur: 'Email et mot de passe requis.' });
  }

  try {
    // Cherche l'utilisateur par email
    const utilisateur = await Utilisateur.findOne({ where: { email } });
    if (!utilisateur) {
      // Message volontairement vague pour ne pas indiquer si l'email existe
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    // Compare le mot de passe avec le hash stocké
    const valide = await bcrypt.compare(motDePasse, utilisateur.motDePasse);
    if (!valide) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect.' });
    }

    // Génère un nouveau token
    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, pharmacieId: utilisateur.pharmacieId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie !',
      token,
      utilisateur: {
        id:          utilisateur.id,
        prenom:      utilisateur.prenom,
        nom:         utilisateur.nom,
        email:       utilisateur.email,
        telephone:   utilisateur.telephone,
        pharmacieId: utilisateur.pharmacieId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// GET /api/auth/moi
// Retourne les infos de l'utilisateur connecté
// Nécessite un token valide dans le header Authorization
// -------------------------------------------------------
const authMiddleware = require('../middleware/auth');

router.get('/moi', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id, {
      attributes: ['id', 'prenom', 'nom', 'email', 'telephone', 'pharmacieId'], // Exclut le mot de passe
    });
    res.json(utilisateur);
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
  if (!prenom || !nom) {
    return res.status(400).json({ erreur: 'Prénom et nom sont obligatoires.' });
  }
  try {
    await Utilisateur.update(
      { prenom, nom, telephone },
      { where: { id: req.utilisateur.id } }
    );
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id, {
      attributes: ['id', 'prenom', 'nom', 'email', 'telephone', 'pharmacieId'],
    });
    res.json({ message: 'Profil mis à jour.', utilisateur });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// PUT /api/auth/mot-de-passe
// Change le mot de passe (vérifie l'ancien)
// -------------------------------------------------------
router.put('/mot-de-passe', authMiddleware, async (req, res) => {
  const { ancienMotDePasse, nouveauMotDePasse } = req.body;
  if (!ancienMotDePasse || !nouveauMotDePasse) {
    return res.status(400).json({ erreur: 'Les deux mots de passe sont requis.' });
  }
  if (nouveauMotDePasse.length < 6) {
    return res.status(400).json({ erreur: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
  }
  try {
    const utilisateur = await Utilisateur.findByPk(req.utilisateur.id);
    const valide = await bcrypt.compare(ancienMotDePasse, utilisateur.motDePasse);
    if (!valide) {
      return res.status(401).json({ erreur: 'Ancien mot de passe incorrect.' });
    }
    const hash = await bcrypt.hash(nouveauMotDePasse, 10);
    await utilisateur.update({ motDePasse: hash });
    res.json({ message: 'Mot de passe modifié avec succès.' });
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
  if (!pushToken) return res.status(400).json({ erreur: 'pushToken requis.' });

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
router.post('/demander-verification', async (req, res) => {
  const { prenom, nom, email, motDePasse, telephone } = req.body;

  const errPrenom = validerChampTexte(prenom, 2, 50, 'Prénom');
  const errNom    = validerChampTexte(nom, 2, 50, 'Nom');
  if (errPrenom) return res.status(400).json({ erreur: errPrenom });
  if (errNom)    return res.status(400).json({ erreur: errNom });
  if (!email || !validator.isEmail(String(email))) {
    return res.status(400).json({ erreur: 'Email invalide.' });
  }
  if (!motDePasse || motDePasse.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 6 caractères.' });
  }
  if (!telephone) {
    return res.status(400).json({ erreur: 'Téléphone obligatoire.' });
  }

  try {
    // Vérifie si l'email est déjà utilisé
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    const numeroNormalise = normaliserTelephone(telephone);

    // Rate-limit : max 3 SMS par 10 minutes pour ce numéro
    const rl = rateLimitSMS.get(numeroNormalise);
    if (rl) {
      if (rl.count >= 3) {
        const attente = Math.ceil((rl.resetAt - Date.now()) / 60000);
        return res.status(429).json({ erreur: `Trop de tentatives. Réessaie dans ${attente} minute(s).` });
      }
      rl.count++;
    } else {
      rateLimitSMS.set(numeroNormalise, { count: 1, resetAt: Date.now() + 10 * 60 * 1000 });
    }

    // Génère un code à 6 chiffres cryptographiquement sûr valable 10 minutes
    const { randomInt } = require('crypto');
    const code = String(randomInt(100000, 999999));
    codesVerification.set(numeroNormalise, {
      code,
      expireAt: Date.now() + 10 * 60 * 1000,
      donnees:  { prenom, nom, email, motDePasse, telephone: numeroNormalise },
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
router.post('/confirmer-inscription', async (req, res) => {
  const { telephone, code } = req.body;

  if (!telephone || !code) {
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
  if (entree.code !== code.trim()) {
    return res.status(400).json({ erreur: 'Code incorrect.' });
  }

  // Code valide → crée le compte
  try {
    const { prenom, nom, email, motDePasse } = entree.donnees;
    const hash = await bcrypt.hash(motDePasse, 10);

    const utilisateur = await Utilisateur.create({
      prenom, nom, email, telephone: numeroNormalise,
      motDePasse: hash,
    });

    // Supprime le code utilisé
    codesVerification.delete(numeroNormalise);

    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, pharmacieId: utilisateur.pharmacieId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès !',
      token,
      utilisateur: {
        id:          utilisateur.id,
        prenom:      utilisateur.prenom,
        nom:         utilisateur.nom,
        email:       utilisateur.email,
        telephone:   utilisateur.telephone,
        pharmacieId: utilisateur.pharmacieId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// -------------------------------------------------------
// POST /api/auth/inscription-pharmacien
// Crée un compte pharmacien + sa pharmacie en une transaction
// Body : { prenom, nom, email, motDePasse,
//          nomPharmacie, adresse, telephone, horaires,
//          latitude?, longitude? }
// -------------------------------------------------------
router.post('/inscription-pharmacien', async (req, res) => {
  const {
    prenom, nom, email, motDePasse,
    nomPharmacie, adresse, telephone, horaires,
    latitude, longitude,
  } = req.body;

  // Validation champs obligatoires
  if (!prenom || !nom || !email || !motDePasse || !nomPharmacie || !adresse) {
    return res.status(400).json({ erreur: 'Tous les champs obligatoires doivent être remplis.' });
  }
  if (motDePasse.length < 6) {
    return res.status(400).json({ erreur: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (!latitude || !longitude || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ erreur: 'Latitude et longitude valides sont obligatoires pour la pharmacie.' });
  }

  try {
    // Vérifie si l'email est déjà utilisé
    const existant = await Utilisateur.findOne({ where: { email } });
    if (existant) {
      return res.status(409).json({ erreur: 'Cet email est déjà utilisé.' });
    }

    let pharmacien;

    await sequelize.transaction(async (t) => {
      // 1. Crée la pharmacie
      const pharmacie = await Pharmacie.create({
        nom:      nomPharmacie,
        adresse,
        telephone: telephone || '',
        horaires:  horaires  || '',
        latitude:  lat,
        longitude: lng,
        note: 0,
      }, { transaction: t });

      // 2. Crée le compte pharmacien lié à cette pharmacie
      const hash = await bcrypt.hash(motDePasse, 10);
      pharmacien = await Utilisateur.create({
        prenom, nom, email,
        motDePasse: hash,
        telephone:  telephone || '',
        pharmacieId: pharmacie.id,
      }, { transaction: t });
    });

    // 3. Génère le token JWT
    const token = jwt.sign(
      { id: pharmacien.id, email: pharmacien.email, pharmacieId: pharmacien.pharmacieId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte pharmacien créé avec succès !',
      token,
      utilisateur: {
        id:          pharmacien.id,
        prenom:      pharmacien.prenom,
        nom:         pharmacien.nom,
        email:       pharmacien.email,
        pharmacieId: pharmacien.pharmacieId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
