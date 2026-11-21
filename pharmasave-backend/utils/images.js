// ============================================================
// utils/images.js — Images uploadées et appartenance
// ============================================================
// Les fichiers sont nommés offre-<pharmacieId>-<timestamp>-<aléa>.<ext>.
// Une pharmacie ne peut référencer (et donc faire supprimer) que
// ses propres fichiers.
//
// En base, une image uploadée est stockée en chemin relatif
// (/uploads/xxx.png) : l'URL complète est reconstruite à la lecture
// avec BACKEND_URL. Changer d'IP ou de domaine ne casse donc plus
// les images existantes.
//
// UPLOADS_DIR permet de pointer vers un volume persistant (Railway
// Volume…) : sans volume, le disque d'un conteneur est effacé à
// chaque redéploiement.
// ============================================================

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DOSSIER_UPLOADS = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });

const RE_CHEMIN_UPLOAD = /^\/uploads\/[A-Za-z0-9._-]+$/;

function nomFichierUpload(pharmacieId, ext) {
  return `offre-${pharmacieId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

function cheminDe(url) {
  try {
    return new URL(url, 'http://local').pathname;
  } catch {
    return null;
  }
}

// Valeur à stocker en base : chemin relatif pour une image uploadée,
// URL inchangée sinon (images externes des données de test)
function versStockage(url) {
  if (typeof url !== 'string' || !url) return url;
  const chemin = cheminDe(url);
  return chemin && RE_CHEMIN_UPLOAD.test(chemin) && (url.startsWith('/') || /^https?:\/\//.test(url))
    ? chemin
    : url;
}

// URL publique à renvoyer aux clients
function versPublic(valeur) {
  if (typeof valeur !== 'string' || !valeur.startsWith('/uploads/')) return valeur;
  const base = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
  return `${base}${valeur}`;
}

// Retourne le nom du fichier si l'URL pointe vers une image uploadée
// par cette pharmacie et présente sur le disque, sinon null.
function fichierDeLaPharmacie(url, pharmacieId) {
  if (typeof url !== 'string' || !pharmacieId) return null;
  const chemin = cheminDe(url);
  if (!chemin) return null;
  const match = chemin.match(/^\/uploads\/(offre-(\d+)-\d+-[a-f0-9]+\.(?:jpe?g|png|webp))$/);
  if (!match || Number(match[2]) !== Number(pharmacieId)) return null;
  return fs.existsSync(path.join(DOSSIER_UPLOADS, match[1])) ? match[1] : null;
}

// Deux URL désignent-elles la même image ? (absolue / relative,
// ancienne IP du serveur…)
function memeImage(a, b) {
  if (!a || !b) return a === b;
  return versStockage(a) === versStockage(b);
}

// Valide le champ image envoyé par un pharmacien.
// Retourne { ok: true, valeur } ou { ok: false }.
// Accepté : vide (pas d'image), valeur inchangée, ou image de la pharmacie.
function validerImage(nouvelle, ancienne, pharmacieId) {
  if (nouvelle === undefined) return { ok: true, valeur: undefined };
  if (nouvelle === null || nouvelle === '') return { ok: true, valeur: null };
  if (typeof nouvelle !== 'string') return { ok: false };
  if (memeImage(nouvelle, ancienne)) return { ok: true, valeur: undefined };
  return fichierDeLaPharmacie(nouvelle, pharmacieId)
    ? { ok: true, valeur: nouvelle }
    : { ok: false };
}

// Supprime le fichier seulement s'il appartient à cette pharmacie
function supprimerImage(url, pharmacieId) {
  const nom = fichierDeLaPharmacie(url, pharmacieId);
  if (nom) fs.unlink(path.join(DOSSIER_UPLOADS, nom), () => {});
}

module.exports = {
  DOSSIER_UPLOADS, nomFichierUpload, validerImage, supprimerImage,
  versStockage, versPublic, memeImage,
};
