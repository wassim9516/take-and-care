// ============================================================
// src/utils/geocodage.js — Adresse → coordonnées GPS
// ============================================================
// Utilise la Base Adresse Nationale (api-adresse.data.gouv.fr),
// service public gratuit, sans clé, limité aux adresses françaises.
// ============================================================

export async function geocoderAdresse(adresse) {
  const q = (adresse || '').trim();
  if (q.length < 5) return null;
  const reponse = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`);
  if (!reponse.ok) throw new Error('Service de géocodage indisponible.');
  const donnees = await reponse.json();
  const resultat = donnees.features?.[0];
  // Score trop faible = adresse probablement mal reconnue
  if (!resultat || resultat.properties.score < 0.4) return null;
  const [longitude, latitude] = resultat.geometry.coordinates;
  return {
    latitude:  latitude.toFixed(6),
    longitude: longitude.toFixed(6),
    libelle:   resultat.properties.label,
  };
}
