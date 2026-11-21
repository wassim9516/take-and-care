// ============================================================
// utils/codes.js — Codes de vérification à 6 chiffres
// ============================================================
// Utilisés pour l'inscription (SMS), le changement de téléphone (SMS)
// et le mot de passe oublié (email). Stockés hachés en base, valables
// 10 minutes, 5 essais par code, 3 envois max par fenêtre de 10 minutes.
// ============================================================

const crypto = require('crypto');
const { Op } = require('sequelize');
const { CodeVerification } = require('../database/models');

const DUREE_CODE_MS    = 10 * 60 * 1000;
const FENETRE_ENVOI_MS = 10 * 60 * 1000;
const ENVOIS_MAX       = 3;
const ESSAIS_MAX       = 5;

function erreurHttp(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function hacher(type, cle, code) {
  return crypto.createHash('sha256').update(`${type}:${cle}:${code}`).digest('hex');
}

function comparer(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Génère et enregistre un nouveau code. Retourne le code en clair (à
// envoyer) ou lance une erreur 429 si trop d'envois récents.
// donnees === undefined → on garde les données déjà enregistrées (renvoi).
async function creerCode({ type, cle, donnees }) {
  const maintenant = Date.now();
  const code = String(crypto.randomInt(100000, 1000000));
  const existant = await CodeVerification.findOne({ where: { type, cle } });

  let envois = 1;
  let fenetreDebut = new Date(maintenant);
  if (existant && existant.fenetreDebut.getTime() + FENETRE_ENVOI_MS > maintenant) {
    if (existant.envois >= ENVOIS_MAX) {
      const attente = Math.ceil((existant.fenetreDebut.getTime() + FENETRE_ENVOI_MS - maintenant) / 60000);
      throw erreurHttp(429, `Trop de demandes de code. Réessaie dans ${attente} minute(s).`);
    }
    envois = existant.envois + 1;
    fenetreDebut = existant.fenetreDebut;
  }

  const valeurs = {
    codeHash: hacher(type, cle, code),
    essais:   0,
    expireAt: new Date(maintenant + DUREE_CODE_MS),
    envois,
    fenetreDebut,
    ...(donnees !== undefined ? { donnees } : {}),
  };

  if (existant) await existant.update(valeurs);
  else await CodeVerification.create({ type, cle, donnees: donnees ?? null, ...valeurs });
  return code;
}

// Données enregistrées pour un code en attente (ou null)
async function donneesEnAttente({ type, cle }) {
  const entree = await CodeVerification.findOne({ where: { type, cle } });
  if (!entree || entree.expireAt.getTime() < Date.now()) return null;
  return entree.donnees;
}

// Vérifie un code. Retourne les données associées et consomme le code ;
// lance une erreur 400 sinon.
async function verifierCode({ type, cle, code }) {
  const entree = await CodeVerification.findOne({ where: { type, cle } });
  if (!entree || !entree.codeHash) {
    throw erreurHttp(400, 'Aucun code en attente. Demande un nouveau code.');
  }
  if (entree.expireAt.getTime() < Date.now()) {
    await entree.update({ codeHash: '' });
    throw erreurHttp(400, 'Code expiré. Demande un nouveau code.');
  }
  if (!comparer(entree.codeHash, hacher(type, cle, String(code ?? '').trim()))) {
    const essais = entree.essais + 1;
    if (essais >= ESSAIS_MAX) {
      // Le code est invalidé ; la limite d'envois reste en place
      await entree.update({ essais, codeHash: '' });
      throw erreurHttp(400, 'Trop d\'essais incorrects. Demande un nouveau code.');
    }
    await entree.update({ essais });
    throw erreurHttp(400, `Code incorrect. ${ESSAIS_MAX - essais} essai(s) restant(s).`);
  }

  const donnees = entree.donnees;
  await entree.destroy();
  return donnees;
}

// Nettoyage des codes expirés dont la fenêtre d'envoi est terminée
async function nettoyerCodes() {
  const limite = new Date(Date.now() - FENETRE_ENVOI_MS);
  await CodeVerification.destroy({
    where: { expireAt: { [Op.lt]: new Date() }, fenetreDebut: { [Op.lt]: limite } },
  });
}

module.exports = { creerCode, verifierCode, donneesEnAttente, nettoyerCodes, erreurHttp };
