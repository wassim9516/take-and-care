// ============================================================
// src/pages/Login.js — Connexion pharmacien
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onInscription }) {
  const [email, setEmail]         = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur]       = useState('');
  const [chargement, setChargement] = useState(false);
  const { seConnecter } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      await seConnecter(email, motDePasse);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur de connexion.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.carte}>

        {/* Logo */}
        <div style={styles.entete}>
          <span style={styles.logo}>🍀</span>
          <h1 style={styles.titre}>Take & Care</h1>
          <p style={styles.sousTitre}>Espace Pharmacien</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={styles.formulaire}>
          <div style={styles.groupe}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="votre@email.com"
              required
            />
          </div>

          <div style={styles.groupe}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          {erreur && <p style={styles.erreur}>{erreur}</p>}

          <button type="submit" style={styles.bouton} disabled={chargement}>
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Lien inscription */}
        <div style={styles.separateurInscription}>
          <div style={styles.ligneSep} />
          <span style={styles.ouSep}>ou</span>
          <div style={styles.ligneSep} />
        </div>

        <button style={styles.boutonInscription} onClick={onInscription}>
          Créer un espace pharmacien →
        </button>

      </div>
    </div>
  );
}

const VERT = '#2D6A4F';

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FAF7F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carte: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    width: 380,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid #EDE8DF',
  },
  entete: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 48,
  },
  titre: {
    fontSize: 24,
    fontWeight: 800,
    color: VERT,
    margin: '8px 0 4px',
  },
  sousTitre: {
    color: '#6B7C6B',
    fontSize: 14,
    margin: 0,
  },
  formulaire: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  groupe: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: VERT,
  },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #E8EDE8',
    fontSize: 15,
    outline: 'none',
    backgroundColor: '#FAF7F0',
  },
  erreur: {
    color: '#C0392B',
    fontSize: 13,
    margin: 0,
    padding: '10px 14px',
    backgroundColor: '#fdf0ef',
    borderRadius: 8,
  },
  bouton: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
  },
  separateurInscription: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '20px 0 16px',
  },
  ligneSep: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDE8DF',
  },
  ouSep: {
    fontSize: 13,
    color: '#6B7C6B',
    flexShrink: 0,
  },
  boutonInscription: {
    width: '100%',
    backgroundColor: '#fff',
    color: VERT,
    border: `1.5px solid ${VERT}`,
    borderRadius: 10,
    padding: '13px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
