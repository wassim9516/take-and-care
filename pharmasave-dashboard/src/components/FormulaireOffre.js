// ============================================================
// src/components/FormulaireOffre.js — Créer / Modifier une offre
// ============================================================

import React, { useState } from 'react';
import { creerOffre, modifierOffre, uploadImage } from '../api/client';

const VERT    = '#2D6A4F';
const BORDURE = '#EDE8DF';

const CATEGORIES = [
  { id: 'soin_visage', label: 'Soin Visage' },
  { id: 'soin_corps',  label: 'Soin Corps' },
  { id: 'complement',  label: 'Compléments' },
  { id: 'bebe',        label: 'Bébé' },
  { id: 'solaire',     label: 'Solaire' },
];

export default function FormulaireOffre({ pharmacieId, offre, onTermine, onAnnuler }) {
  const estModification = !!offre;

  // Pré-remplit les champs si on est en mode modification
  const [titre, setTitre]                   = useState(offre?.titre || '');
  const [description, setDescription]       = useState(offre?.description || '');
  const [produits, setProduits]             = useState(offre?.produits?.join('\n') || '');
  const [prixOriginal, setPrixOriginal]     = useState(offre?.prixOriginal || '');
  const [prixReduit, setPrixReduit]         = useState(offre?.prixReduit || '');
  const [quantite, setQuantite]             = useState(offre?.quantiteDisponible || 1);
  const [datePeremption, setDatePeremption] = useState(offre?.datePeremption || '');
  const [categorie, setCategorie]           = useState(offre?.categorie || 'soin_visage');
  const [heureRetrait, setHeureRetrait]     = useState(offre?.heureRetrait || '');
  const [imageFichier, setImageFichier]     = useState(null);
  const [imagePreview, setImagePreview]     = useState(offre?.image || '');
  const [chargement, setChargement]         = useState(false);
  const [erreur, setErreur]                 = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);

    // Convertit le texte multi-lignes en tableau de produits
    const produitsArray = produits.split('\n').map(p => p.trim()).filter(p => p.length > 0);

    let imageUrl = imagePreview;
    if (imageFichier) {
      try {
        imageUrl = await uploadImage(imageFichier);
      } catch {
        setErreur("Échec de l'upload de l'image. Vérifie le serveur et réessaie.");
        setChargement(false);
        return;
      }
    }

    const data = {
      pharmacieId,
      titre,
      description,
      produits: produitsArray,
      prixOriginal:       parseFloat(prixOriginal),
      prixReduit:         parseFloat(prixReduit),
      quantiteDisponible: parseInt(quantite) || 1,
      datePeremption,
      categorie,
      heureRetrait,
      image: imageUrl,
    };

    try {
      if (estModification) {
        await modifierOffre(offre.id, data);
      } else {
        await creerOffre(data);
      }
      onTermine();
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur lors de la sauvegarde.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div style={styles.conteneur}>
      <div style={styles.entete}>
        <h3 style={styles.titre}>
          {estModification ? 'Modifier l\'offre' : 'Nouvelle offre'}
        </h3>
        <button onClick={onAnnuler} style={styles.boutonFermer}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={styles.formulaire}>

        {/* Ligne 1 : titre + catégorie */}
        <div style={styles.ligne}>
          <div style={styles.groupe}>
            <label style={styles.label}>Titre du panier *</label>
            <input style={styles.input} value={titre} onChange={e => setTitre(e.target.value)} placeholder="ex: Panier Soin Visage" required />
          </div>
          <div style={styles.groupe}>
            <label style={styles.label}>Catégorie *</label>
            <select style={styles.input} value={categorie} onChange={e => setCategorie(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={styles.groupe}>
          <label style={styles.label}>Description</label>
          <textarea style={{ ...styles.input, minHeight: 80, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décris le contenu du panier..." />
        </div>

        {/* Produits */}
        <div style={styles.groupe}>
          <label style={styles.label}>Produits (un par ligne) *</label>
          <textarea
            style={{ ...styles.input, minHeight: 100, resize: 'vertical', fontFamily: 'monospace' }}
            value={produits}
            onChange={e => setProduits(e.target.value)}
            placeholder={'Crème hydratante Vichy 50ml\nSérum anti-âge Avène 30ml'}
            required
          />
        </div>

        {/* Ligne 2 : prix */}
        <div style={styles.ligne}>
          <div style={styles.groupe}>
            <label style={styles.label}>Prix original (€) *</label>
            <input style={styles.input} type="number" step="0.01" min="0" value={prixOriginal} onChange={e => setPrixOriginal(e.target.value)} placeholder="45.00" required />
          </div>
          <div style={styles.groupe}>
            <label style={styles.label}>Prix réduit (€) *</label>
            <input style={styles.input} type="number" step="0.01" min="0" value={prixReduit} onChange={e => setPrixReduit(e.target.value)} placeholder="15.00" required />
          </div>
          <div style={styles.groupe}>
            <label style={styles.label}>Quantité *</label>
            <input style={styles.input} type="number" min="1" value={quantite} onChange={e => setQuantite(e.target.value)} required />
          </div>
        </div>

        {/* Ligne 3 : date + heure */}
        <div style={styles.ligne}>
          <div style={styles.groupe}>
            <label style={styles.label}>Date de péremption</label>
            <input style={styles.input} type="date" value={datePeremption} onChange={e => setDatePeremption(e.target.value)} />
          </div>
          <div style={styles.groupe}>
            <label style={styles.label}>Heure de retrait</label>
            <input style={styles.input} value={heureRetrait} onChange={e => setHeureRetrait(e.target.value)} placeholder="ex: 17h00 - 19h30" />
          </div>
        </div>

        {/* Image */}
        <div style={styles.groupe}>
          <label style={styles.label}>Photo du panier</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={styles.inputFichier}
            onChange={e => {
              const f = e.target.files[0];
              if (f) {
                setImageFichier(f);
                setImagePreview(URL.createObjectURL(f));
              }
            }}
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Aperçu"
              style={styles.apercu}
            />
          )}
        </div>

        {erreur && <p style={styles.erreur}>{erreur}</p>}

        {/* Boutons */}
        <div style={styles.boutons}>
          <button type="button" onClick={onAnnuler} style={styles.boutonAnnuler}>Annuler</button>
          <button type="submit" style={styles.boutonSauvegarder} disabled={chargement}>
            {chargement ? 'Sauvegarde...' : estModification ? 'Modifier' : 'Créer l\'offre'}
          </button>
        </div>

      </form>
    </div>
  );
}

const styles = {
  conteneur: {
    backgroundColor: '#fff',
    borderRadius: 12,
    border: `1px solid ${BORDURE}`,
    marginBottom: 24,
    overflow: 'hidden',
  },
  entete: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: `1px solid ${BORDURE}`,
    backgroundColor: '#FAF7F0',
  },
  titre: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: VERT,
  },
  boutonFermer: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#6B7C6B',
  },
  formulaire: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  ligne: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${BORDURE}`,
    fontSize: 14,
    backgroundColor: '#FAF7F0',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputFichier: {
    padding: '8px 0',
    fontSize: 14,
    color: '#1A2E1A',
  },
  apercu: {
    marginTop: 10,
    width: '100%',
    maxHeight: 200,
    objectFit: 'cover',
    borderRadius: 8,
    border: `1px solid ${BORDURE}`,
  },
  erreur: {
    color: '#C0392B',
    fontSize: 13,
    padding: '10px 14px',
    backgroundColor: '#fdf0ef',
    borderRadius: 8,
    margin: 0,
  },
  boutons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
  },
  boutonAnnuler: {
    background: 'none',
    border: `1px solid ${BORDURE}`,
    borderRadius: 8,
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
    color: '#6B7C6B',
  },
  boutonSauvegarder: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
