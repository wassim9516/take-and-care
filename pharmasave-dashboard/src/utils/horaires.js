// ============================================================
// src/utils/horaires.js — Horaires d'ouverture structurés
// ============================================================
// Le backend stocke les horaires sous forme de texte (affiché tel quel
// dans l'app). L'éditeur des réglages travaille sur une semaine
// structurée et la convertit en texte lisible, par ex. :
//   "Lun–Ven 9h00–12h30, 14h00–19h30 · Sam 9h00–13h00 · Dim fermé"
// lireHoraires() relit ce format ; un texte libre ancien renvoie null.
// ============================================================

export const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const JOURS_LONGS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Un jour = { ouvert, plages: [[debut, fin], ...] } avec des heures "HH:MM"
export const semaineParDefaut = () => JOURS.map((_, i) => (
  i < 5 ? { ouvert: true, plages: [['09:00', '19:30']] }
  : i === 5 ? { ouvert: true, plages: [['09:00', '13:00']] }
  : { ouvert: false, plages: [['09:00', '13:00']] }
));

const versTexte = (hhmm) => {
  const [h, m] = hhmm.split(':');
  return `${parseInt(h, 10)}h${m}`;
};
const versHHMM = (texte) => {
  const [h, m] = texte.split('h');
  return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
};

const cleJour = (j) => (j.ouvert ? j.plages.map(p => p.join('-')).join(',') : 'ferme');

export function ecrireHoraires(semaine) {
  const groupes = [];
  semaine.forEach((jour, i) => {
    const dernier = groupes[groupes.length - 1];
    if (dernier && cleJour(dernier.jour) === cleJour(jour)) dernier.fin = i;
    else groupes.push({ debut: i, fin: i, jour });
  });
  return groupes.map(({ debut, fin, jour }) => {
    const jours = debut === fin ? JOURS[debut] : `${JOURS[debut]}–${JOURS[fin]}`;
    const heures = jour.ouvert
      ? jour.plages.map(([a, b]) => `${versTexte(a)}–${versTexte(b)}`).join(', ')
      : 'fermé';
    return `${jours} ${heures}`;
  }).join(' · ');
}

export function lireHoraires(texte) {
  if (!texte || typeof texte !== 'string') return null;
  const semaine = new Array(7).fill(null);
  const plage = '(\\d{1,2}h\\d{2})–(\\d{1,2}h\\d{2})';
  const reGroupe = new RegExp(`^(${JOURS.join('|')})(?:–(${JOURS.join('|')}))? (fermé|${plage}(?:, ${plage})?)$`);

  for (const morceau of texte.split(' · ')) {
    const m = morceau.trim().match(reGroupe);
    if (!m) return null;
    const debut = JOURS.indexOf(m[1]);
    const fin = m[2] ? JOURS.indexOf(m[2]) : debut;
    if (fin < debut) return null;
    const jour = m[3] === 'fermé'
      ? { ouvert: false, plages: [['09:00', '13:00']] }
      : { ouvert: true, plages: [[versHHMM(m[4]), versHHMM(m[5])], ...(m[6] ? [[versHHMM(m[6]), versHHMM(m[7])]] : [])] };
    for (let i = debut; i <= fin; i++) semaine[i] = JSON.parse(JSON.stringify(jour));
  }
  return semaine.every(Boolean) ? semaine : null;
}

// Vérifie que chaque plage a un début avant sa fin, sans chevauchement
export function erreurHoraires(semaine) {
  for (let i = 0; i < 7; i++) {
    const j = semaine[i];
    if (!j.ouvert) continue;
    for (const [a, b] of j.plages) {
      if (!a || !b || a >= b) return `${JOURS_LONGS[i]} : l'heure de fin doit être après l'heure de début.`;
    }
    if (j.plages.length === 2 && j.plages[1][0] < j.plages[0][1]) {
      return `${JOURS_LONGS[i]} : la 2e plage doit commencer après la fin de la 1re.`;
    }
  }
  return null;
}
