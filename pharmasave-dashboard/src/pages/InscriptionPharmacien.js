// ============================================================
// src/pages/InscriptionPharmacien.js — Inscription pharmacien
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const VERT    = '#2D6A4F';
const VERT_F  = '#1B4332';
const BEIGE   = '#FAF7F0';
const BORDURE = '#EDE8DF';
const ROUGE   = '#C0392B';

export default function InscriptionPharmacien({ onRetourConnexion }) {
  const { sInscrirePharmacien } = useAuth();

  const [etape, setEtape]           = useState(1); // 1 = compte, 2 = pharmacie
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur]         = useState('');
  const [geoChargement, setGeoChargement] = useState(false);

  // Étape 1 — infos compte
  const [prenom, setPrenom]         = useState('');
  const [nom, setNom]               = useState('');
  const [email, setEmail]           = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmer, setConfirmer]   = useState('');

  // Étape 2 — infos pharmacie
  const [nomPharmacie, setNomPharmacie] = useState('');
  const [adresse, setAdresse]           = useState('');
  const [telephone, setTelephone]       = useState('');
  const [horaires, setHoraires]         = useState('');
  const [latitude, setLatitude]         = useState('');
  const [longitude, setLongitude]       = useState('');

  // -------------------------------------------------------
  // Validation étape 1
  // -------------------------------------------------------
  const validerEtape1 = () => {
    setErreur('');
    if (!prenom.trim() || !nom.trim() || !email.trim() || !motDePasse) {
      setErreur('Tous les champs sont obligatoires.');
      return;
    }
    if (motDePasse.length < 6) {
      setErreur('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (motDePasse !== confirmer) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    setEtape(2);
  };

  // -------------------------------------------------------
  // Géolocalisation automatique depuis le navigateur
  // -------------------------------------------------------
  const geoLocaliser = () => {
    if (!navigator.geolocation) {
      setErreur('La géolocalisation n\'est pas supportée par ce navigateur.');
      return;
    }
    setGeoChargement(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGeoChargement(false);
      },
      () => {
        setErreur('Impossible d\'obtenir la position. Saisis les coordonnées manuellement.');
        setGeoChargement(false);
      }
    );
  };

  // -------------------------------------------------------
  // Soumission finale
  // -------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');

    if (!nomPharmacie.trim() || !adresse.trim()) {
      setErreur('Le nom et l\'adresse de la pharmacie sont obligatoires.');
      return;
    }

    setChargement(true);
    try {
      await sInscrirePharmacien({
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim(),
        motDePasse,
        nomPharmacie: nomPharmacie.trim(),
        adresse: adresse.trim(),
        telephone: telephone.trim(),
        horaires: horaires.trim(),
        latitude:  latitude  || undefined,
        longitude: longitude || undefined,
      });
      // AuthContext met à jour le state → redirige automatiquement vers Dashboard
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur lors de l\'inscription.');
    } finally {
      setChargement(false);
    }
  };

  // -------------------------------------------------------
  // Rendu
  // -------------------------------------------------------
  return (
    <div style={s.page}>
      <div style={s.carte}>

        {/* En-tête */}
        <div style={s.entete}>
          <span style={s.logo}>🍀</span>
          <h1 style={s.titre}>Rejoindre Take & Care</h1>
          <p style={s.sousTitre}>Créez votre espace pharmacien</p>
        </div>

        {/* Indicateur d'étapes */}
        <div style={s.etapes}>
          {[1, 2].map(n => (
            <div key={n} style={s.etapeConteneur}>
              <div style={{ ...s.etapeCercle, ...(etape >= n ? s.etapeActive : {}) }}>
                {etape > n ? '✓' : n}
              </div>
              <span style={{ ...s.etapeLabel, ...(etape >= n ? { color: VERT } : {}) }}>
                {n === 1 ? 'Mon compte' : 'Ma pharmacie'}
              </span>
              {n < 2 && <div style={{ ...s.etapeLigne, ...(etape > n ? s.ligneActive : {}) }} />}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Infos compte ── */}
        {etape === 1 && (
          <div style={s.formulaire}>
            <div style={s.ligneChamps}>
              <ChampTexte label="Prénom *" value={prenom} onChange={setPrenom} placeholder="Marie" />
              <ChampTexte label="Nom *" value={nom} onChange={setNom} placeholder="Dupont" />
            </div>
            <ChampTexte label="Email professionnel *" value={email} onChange={setEmail} placeholder="marie@pharmacie.fr" type="email" />
            <ChampTexte label="Mot de passe *" value={motDePasse} onChange={setMotDePasse} placeholder="6 caractères minimum" type="password" />
            <ChampTexte label="Confirmer le mot de passe *" value={confirmer} onChange={setConfirmer} placeholder="••••••••" type="password" />

            {erreur && <div style={s.erreur}>{erreur}</div>}

            <button style={s.boutonPrimaire} onClick={validerEtape1}>
              Continuer →
            </button>
          </div>
        )}

        {/* ── ÉTAPE 2 : Infos pharmacie ── */}
        {etape === 2 && (
          <form onSubmit={handleSubmit} style={s.formulaire}>
            <ChampTexte label="Nom de la pharmacie *" value={nomPharmacie} onChange={setNomPharmacie} placeholder="Pharmacie du Centre" />
            <ChampTexte label="Adresse complète *" value={adresse} onChange={setAdresse} placeholder="12 Rue du Commerce, 75015 Paris" />
            <ChampTexte label="Téléphone" value={telephone} onChange={setTelephone} placeholder="01 23 45 67 89" type="tel" />
            <ChampTexte label="Horaires" value={horaires} onChange={setHoraires} placeholder="Lun-Sam 8h30-20h, Dim 9h-13h" />

            {/* Géolocalisation */}
            <div style={s.blocGeo}>
              <div style={s.ligneGeo}>
                <span style={s.labelGeo}>📍 Coordonnées GPS</span>
                <button type="button" style={s.boutonGeo} onClick={geoLocaliser} disabled={geoChargement}>
                  {geoChargement ? 'Localisation...' : '🎯 Ma position actuelle'}
                </button>
              </div>
              <div style={s.ligneChamps}>
                <ChampTexte label="Latitude" value={latitude} onChange={setLatitude} placeholder="48.856600" type="number" />
                <ChampTexte label="Longitude" value={longitude} onChange={setLongitude} placeholder="2.352200" type="number" />
              </div>
              <p style={s.noteGeo}>
                Utilisez "Ma position actuelle" si vous êtes à la pharmacie, ou saisissez les coordonnées manuellement. Elles peuvent être modifiées plus tard.
              </p>
            </div>

            {erreur && <div style={s.erreur}>{erreur}</div>}

            <div style={s.ligneBoutons}>
              <button type="button" style={s.boutonSecondaire} onClick={() => { setEtape(1); setErreur(''); }}>
                ← Retour
              </button>
              <button type="submit" style={s.boutonPrimaire} disabled={chargement}>
                {chargement ? 'Création du compte...' : '✅ Créer mon espace'}
              </button>
            </div>
          </form>
        )}

        {/* Lien retour connexion */}
        <p style={s.lienConnexion}>
          Déjà un compte ?{' '}
          <button style={s.lienBouton} onClick={onRetourConnexion}>
            Se connecter
          </button>
        </p>

      </div>
    </div>
  );
}

// -------------------------------------------------------
// Composant champ texte réutilisable
// -------------------------------------------------------
function ChampTexte({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={s.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={s.input}
        step={type === 'number' ? 'any' : undefined}
      />
    </div>
  );
}

// -------------------------------------------------------
// Styles
// -------------------------------------------------------
const s = {
  page: {
    minHeight: '100vh',
    backgroundColor: BEIGE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  carte: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
    border: `1px solid ${BORDURE}`,
  },
  entete: {
    textAlign: 'center',
    marginBottom: 28,
  },
  logo: { fontSize: 44 },
  titre: {
    fontSize: 22,
    fontWeight: 800,
    color: VERT_F,
    margin: '8px 0 4px',
  },
  sousTitre: {
    color: '#6B7C6B',
    fontSize: 14,
    margin: 0,
  },
  // Indicateur étapes
  etapes: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 28,
  },
  etapeConteneur: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  etapeCercle: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: BORDURE,
    color: '#6B7C6B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  etapeActive: {
    backgroundColor: VERT,
    color: '#fff',
  },
  etapeLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#6B7C6B',
    whiteSpace: 'nowrap',
  },
  etapeLigne: {
    width: 40,
    height: 2,
    backgroundColor: BORDURE,
    margin: '0 8px',
  },
  ligneActive: {
    backgroundColor: VERT,
  },
  // Formulaire
  formulaire: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  ligneChamps: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: VERT_F,
  },
  input: {
    padding: '11px 14px',
    borderRadius: 10,
    border: `1px solid ${BORDURE}`,
    fontSize: 14,
    backgroundColor: BEIGE,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    color: '#1A2E1A',
  },
  // Bloc géolocalisation
  blocGeo: {
    backgroundColor: '#F0F7F4',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    border: `1px solid ${VERT}20`,
  },
  ligneGeo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGeo: {
    fontSize: 13,
    fontWeight: 600,
    color: VERT_F,
  },
  boutonGeo: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  noteGeo: {
    fontSize: 11,
    color: '#6B7C6B',
    margin: 0,
    lineHeight: 1.5,
  },
  // Boutons
  ligneBoutons: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  boutonPrimaire: {
    flex: 1,
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  boutonSecondaire: {
    backgroundColor: '#fff',
    color: '#6B7C6B',
    border: `1px solid ${BORDURE}`,
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  erreur: {
    backgroundColor: '#fdf0ef',
    color: ROUGE,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 500,
  },
  lienConnexion: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
    color: '#6B7C6B',
  },
  lienBouton: {
    background: 'none',
    border: 'none',
    color: VERT,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    textDecoration: 'underline',
  },
};
