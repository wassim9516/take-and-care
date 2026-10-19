// ============================================================
// utils/images.js — Images uploadées et appartenance
// ============================================================
// Les fichiers sont nommés offre-<pharmacieId>-<timestamp>-<aléa>.<ext>.
// Une pharmacie ne peut référencer (et donc faire supprimer) que
// ses propres fichiers.
// ============================================================

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DOSSIER_UPLOADS = path.join(__dirname, '..', 'uploads');

function nomFichierUpload(pharmacieId, ext) {
  return `offre-${pharmacieId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
}

// Retourne le nom du fichier si l'URL pointe vers une image uploadée
// par cette pharmacie et présente sur le disque, sinon null.
function fichierDeLaPharmacie(url, pharmacieId) {
  if (typeof url !== 'string' || !pharmacieId) return null;
  let chemin;
  try {
    chemin = new URL(url, 'http://local').pathname;
  } catch {
    return null;
  }
  const match = chemin.match(/^\/uploads\/(offre-(\d+)-\d+-[a-f0-9]+\.(?:jpe?g|png|webp))$/);
  if (!match || Number(match[2]) !== Number(pharmacieId)) return null;
  return fs.existsSync(path.join(DOSSIER_UPLOADS, match[1])) ? match[1] : null;
}

// Valide le champ image envoyé par un pharmacien.
// Retourne { ok: true, valeur } ou { ok: false }.
// Accepté : vide (pas d'image), valeur inchangée, ou image de la pharmacie.
function validerImage(nouvelle, ancienne, pharmacieId) {
  if (nouvelle === undefined) return { ok: true, valeur: undefined };
  if (nouvelle === null || nouvelle === '') return { ok: true, valeur: null };
  if (nouvelle === ancienne) return { ok: true, valeur: nouvelle };
  return fichierDeLaPharmacie(nouvelle, pharmacieId)
    ? { ok: true, valeur: nouvelle }
    : { ok: false };
}

// Supprime le fichier seulement s'il appartient à cette pharmacie
function supprimerImage(url, pharmacieId) {
  const nom = fichierDeLaPharmacie(url, pharmacieId);
  if (nom) fs.unlink(path.join(DOSSIER_UPLOADS, nom), () => {});
}

module.exports = { DOSSIER_UPLOADS, nomFichierUpload, validerImage, supprimerImage };
