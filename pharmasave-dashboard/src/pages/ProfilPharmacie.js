// ============================================================
// src/pages/ProfilPharmacie.js — Édition du profil pharmacie
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { modifierPharmacie } from '../api/client';

const VERT    = '#2D6A4F';
const VERT_F  = '#1B4332';
const VERT_L  = '#E8F5EE';
const BEIGE   = '#FAF7F0';
const BORDURE = '#EDE8DF';
const ROUGE   = '#C0392B';

export default function ProfilPharmacie({ pharmacie, onRetour, onMiseAJour }) {
  const { pharmacien } = useAuth();

  const [nom,       setNom]       = useState(pharmacie?.nom       || '');
  const [adresse,   setAdresse]   = useState(pharmacie?.adresse   || '');
  const [telephone, setTelephone] = useState(pharmacie?.telephone || '');
  const [horaires,  setHoraires]  = useState(pharmacie?.horaires  || '');
  const [latitude,  setLatitude]  = useState(pharmacie?.latitude  ? String(pharmacie.latitude)  : '');
  const [longitude, setLongitude] = useState(pharmacie?.longitude ? String(pharmacie.longitude) : '');

  const [chargement,    setChargement]    = useState(false);
  const [geoChargement, setGeoChargement] = useState(false);
  const [erreur,        setErreur]        = useState('');
  const [succes,        setSucces]        = useState('');

  const geoLocaliser = () => {
    if (!navigator.geolocation) { setErreur('Géolocalisation non supportée.'); return; }
    setGeoChargement(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGeoChargement(false);
        setSucces('Position détectée !');
        setTimeout(() => setSucces(''), 2000);
      },
      () => { setErreur('Impossible d\'obtenir la position.'); setGeoChargement(false); }
    );
  };

  const handleSauvegarder = async (e) => {
    e.preventDefault();
    setErreur(''); setSucces('');
    if (!nom.trim() || !adresse.trim()) {
      setErreur('Nom et adresse sont obligatoires.'); return;
    }
    setChargement(true);
    try {
      const result = await modifierPharmacie(pharmacien.pharmacieId, {
        nom: nom.trim(), adresse: adresse.trim(),
        telephone: telephone.trim(), horaires: horaires.trim(),
        latitude, longitude,
      });
      setSucces('Pharmacie mise à jour avec succès !');
      if (onMiseAJour) onMiseAJour(result.pharmacie);
      setTimeout(() => setSucces(''), 3000);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur lors de la mise à jour.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div style={s.page}>

      {/* En-tête */}
      <div style={s.entete}>
        <button style={s.boutonRetour} onClick={onRetour}>← Retour</button>
        <div>
          <h2 style={s.titre}>Ma pharmacie</h2>
          <p style={s.sousTitre}>Modifie les informations visibles par les clients</p>
        </div>
      </div>

      <form onSubmit={handleSauvegarder} style={s.formulaire}>

        {/* Infos principales */}
        <div style={s.section}>
          <h3 style={s.titreSec}>Informations générales</h3>

          <ChampForm label="Nom de la pharmacie *" value={nom} onChange={setNom} placeholder="Pharmacie du Centre" />
          <ChampForm label="Adresse complète *" value={adresse} onChange={setAdresse} placeholder="12 Rue du Commerce, 75015 Paris" />
          <ChampForm label="Téléphone" value={telephone} onChange={setTelephone} placeholder="01 23 45 67 89" type="tel" />
          <ChampForm label="Horaires" value={horaires} onChange={setHoraires} placeholder="Lun-Sam 8h30-20h, Dim 9h-13h" />
        </div>

        {/* Localisation */}
        <div style={s.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...s.titreSec, marginBottom: 0 }}>Localisation GPS</h3>
            <button type="button" style={s.boutonGeo} onClick={geoLocaliser} disabled={geoChargement}>
              {geoChargement ? '⏳ Localisation...' : '🎯 Ma position actuelle'}
            </button>
          </div>
          <div style={s.ligneChamps}>
            <ChampForm label="Latitude" value={latitude} onChange={setLatitude} placeholder="48.856600" type="number" />
            <ChampForm label="Longitude" value={longitude} onChange={setLongitude} placeholder="2.352200" type="number" />
          </div>
          <p style={s.noteGeo}>
            Ces coordonnées déterminent où ta pharmacie apparaît sur la carte de l'app.
          </p>
        </div>

        {/* Aperçu carte */}
        <div style={s.section}>
          <h3 style={s.titreSec}>Aperçu carte client</h3>
          <div style={s.aperçuCarte}>
            <div style={s.marqueurApercu}>💊</div>
            <div>
              <p style={s.nomApercu}>{nom || 'Nom de la pharmacie'}</p>
              <p style={s.adresseApercu}>{adresse || 'Adresse'}</p>
              <p style={s.horaireApercu}>🕐 {horaires || 'Horaires'}</p>
              <p style={s.telApercu}>📞 {telephone || 'Téléphone'}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {erreur && <div style={s.alerteErreur}>{erreur}</div>}
        {succes && <div style={s.alerteSucces}>{succes}</div>}

        {/* Bouton */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" style={s.boutonSauvegarder} disabled={chargement}>
            {chargement ? 'Sauvegarde...' : '💾 Sauvegarder les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChampForm({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
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

const s = {
  page: { maxWidth: 700 },

  entete: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 28,
  },
  boutonRetour: {
    background: 'none',
    border: `1px solid ${BORDURE}`,
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 14,
    color: '#6B7C6B',
    flexShrink: 0,
    marginTop: 2,
  },
  titre: { fontSize: 20, fontWeight: 800, color: VERT_F, margin: 0 },
  sousTitre: { fontSize: 13, color: '#6B7C6B', margin: '4px 0 0' },

  formulaire: { display: 'flex', flexDirection: 'column', gap: 0 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    border: `1px solid ${BORDURE}`,
    padding: 24,
    marginBottom: 20,
  },
  titreSec: {
    fontSize: 15,
    fontWeight: 700,
    color: VERT_F,
    margin: '0 0 16px',
  },
  ligneChamps: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: VERT_F,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1px solid ${BORDURE}`,
    fontSize: 14,
    backgroundColor: BEIGE,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#1A2E1A',
  },
  boutonGeo: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  noteGeo: {
    fontSize: 12,
    color: '#6B7C6B',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Aperçu
  aperçuCarte: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    backgroundColor: BEIGE,
    borderRadius: 12,
    padding: 16,
    border: `1px solid ${BORDURE}`,
  },
  marqueurApercu: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    border: `2px solid ${VERT}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  nomApercu:     { fontSize: 15, fontWeight: 700, color: '#1A2E1A', margin: '0 0 3px' },
  adresseApercu: { fontSize: 13, color: '#6B7C6B', margin: '0 0 3px' },
  horaireApercu: { fontSize: 12, color: '#1A2E1A', margin: '0 0 2px' },
  telApercu:     { fontSize: 12, color: '#1A2E1A', margin: 0 },

  alerteErreur: {
    backgroundColor: '#fdf0ef',
    color: ROUGE,
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    marginBottom: 16,
  },
  alerteSucces: {
    backgroundColor: VERT_L,
    color: VERT,
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  boutonSauvegarder: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 28px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
