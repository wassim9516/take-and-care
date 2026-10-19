// ============================================================
// src/components/FormulaireOffre.js — Créer / Modifier une offre
// ============================================================
// S'affiche dans un panneau latéral, avec aperçu de la remise
// et dépôt de photo par glisser-déposer.
// ============================================================

import React, { useEffect, useState } from 'react';
import { creerOffre, modifierOffre, uploadImage } from '../api/client';
import { Camera, ImagePlus, X, AlertTriangle, Loader2 } from 'lucide-react';
import { formaterEuros } from './ui';

const CATEGORIES = [
  { id: 'soin_visage', label: 'Soin visage' },
  { id: 'soin_corps',  label: 'Soin corps' },
  { id: 'complement',  label: 'Compléments' },
  { id: 'bebe',        label: 'Bébé' },
  { id: 'solaire',     label: 'Solaire' },
];

const FORMATS_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];

export default function FormulaireOffre({ pharmacieId, offre, onTermine, onAnnuler }) {
  const estModification = !!offre;

  // Pré-remplit les champs si on est en mode modification
  const [titre, setTitre]                   = useState(offre?.titre || '');
  const [description, setDescription]       = useState(offre?.description || '');
  const [produits, setProduits]             = useState(offre?.produits?.join('\n') || '');
  const [prixOriginal, setPrixOriginal]     = useState(offre?.prixOriginal ?? '');
  const [prixReduit, setPrixReduit]         = useState(offre?.prixReduit ?? '');
  const [quantite, setQuantite]             = useState(offre?.quantiteDisponible ?? 1);
  const [datePeremption, setDatePeremption] = useState(offre?.datePeremption || '');
  const [categorie, setCategorie]           = useState(offre?.categorie || 'soin_visage');
  const [heureRetrait, setHeureRetrait]     = useState(offre?.heureRetrait || '');
  const [imageFichier, setImageFichier]     = useState(null);
  const [imagePreview, setImagePreview]     = useState(offre?.image || '');
  const [survolDepot, setSurvolDepot]       = useState(false);
  const [chargement, setChargement]         = useState(false);
  const [erreur, setErreur]                 = useState('');

  // Échap ferme le panneau
  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape' && !chargement) onAnnuler(); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [chargement, onAnnuler]);

  const choisirImage = (fichier) => {
    if (!fichier) return;
    if (!FORMATS_IMAGE.includes(fichier.type)) {
      setErreur('Format non supporté : utilise une image JPG, PNG ou WEBP.');
      return;
    }
    if (fichier.size > 5 * 1024 * 1024) {
      setErreur('Image trop lourde (5 Mo maximum).');
      return;
    }
    setErreur('');
    setImageFichier(fichier);
    setImagePreview(URL.createObjectURL(fichier));
  };

  const pOrig = parseFloat(prixOriginal);
  const pRed  = parseFloat(prixReduit);
  const prixValides = pOrig > 0 && pRed > 0;
  const remise = prixValides ? Math.round((1 - pRed / pOrig) * 100) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');

    if (prixValides && pRed > pOrig) {
      setErreur('Le prix réduit ne peut pas être supérieur au prix original.');
      return;
    }

    setChargement(true);

    // Convertit le texte multi-lignes en tableau de produits
    const produitsArray = produits.split('\n').map(p => p.trim()).filter(p => p.length > 0);

    let imageUrl = imagePreview;
    if (imageFichier) {
      try {
        imageUrl = await uploadImage(imageFichier);
      } catch (err) {
        setErreur(err.response?.data?.erreur || "Échec de l'envoi de l'image. Vérifie le serveur et réessaie.");
        setChargement(false);
        return;
      }
    }

    const q = parseInt(quantite, 10);
    const data = {
      pharmacieId,
      titre,
      description,
      produits: produitsArray,
      prixOriginal:       pOrig,
      prixReduit:         pRed,
      quantiteDisponible: Number.isNaN(q) ? 1 : q,
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
    <>
      <div className="tc-panneau-overlay" onClick={() => !chargement && onAnnuler()} />
      <aside className="tc-panneau" role="dialog" aria-modal="true" aria-label={estModification ? 'Modifier l\'offre' : 'Nouvelle offre'}>
        <div className="tc-panneau-entete">
          <div>
            <h2 className="tc-modale-titre">{estModification ? 'Modifier l\'offre' : 'Nouvelle offre'}</h2>
            <p className="tc-carte-sous-titre">
              {estModification ? 'Les changements sont visibles immédiatement dans l\'app.' : 'Les clients à proximité seront notifiés.'}
            </p>
          </div>
          <button className="tc-fermer" onClick={onAnnuler} disabled={chargement} aria-label="Fermer"><X size={16} /></button>
        </div>

        <form id="formulaire-offre" onSubmit={handleSubmit} className="tc-panneau-corps tc-formulaire">

          {/* Photo */}
          <label
            className={`tc-depot ${survolDepot ? 'survol' : ''}`}
            onDragOver={e => { e.preventDefault(); setSurvolDepot(true); }}
            onDragLeave={() => setSurvolDepot(false)}
            onDrop={e => { e.preventDefault(); setSurvolDepot(false); choisirImage(e.dataTransfer.files[0]); }}
          >
            <input type="file" accept={FORMATS_IMAGE.join(',')} onChange={e => choisirImage(e.target.files[0])} />
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Aperçu du panier" />
                <span className="tc-depot-changer"><Camera size={13} /> Changer la photo</span>
              </>
            ) : (
              <>
                <ImagePlus size={30} strokeWidth={1.6} style={{ color: 'var(--vert-700)' }} />
                <strong style={{ color: 'var(--encre)' }}>Ajoute une photo du panier</strong>
                <span>Glisse une image ici ou clique · JPG, PNG, WEBP · 5 Mo max</span>
              </>
            )}
          </label>

          <div className="tc-groupe">
            <label className="tc-label" htmlFor="o-titre">Titre du panier *</label>
            <input id="o-titre" className="tc-champ" value={titre} onChange={e => setTitre(e.target.value)} placeholder="ex : Panier Soin Visage" maxLength={100} required />
          </div>

          <div className="tc-groupe">
            <label className="tc-label" htmlFor="o-cat">Catégorie *</label>
            <select id="o-cat" className="tc-champ" value={categorie} onChange={e => setCategorie(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div className="tc-groupe">
            <label className="tc-label" htmlFor="o-desc">Description</label>
            <textarea id="o-desc" className="tc-champ" value={description} onChange={e => setDescription(e.target.value)} placeholder="Décris le contenu du panier…" maxLength={2000} />
          </div>

          <div className="tc-groupe">
            <label className="tc-label" htmlFor="o-prod">Produits * <span className="aide">· un par ligne</span></label>
            <textarea
              id="o-prod"
              className="tc-champ"
              value={produits}
              onChange={e => setProduits(e.target.value)}
              placeholder={'Crème hydratante Vichy 50 ml\nSérum anti-âge Avène 30 ml'}
              required
            />
          </div>

          <div className="tc-ligne">
            <div className="tc-groupe">
              <label className="tc-label" htmlFor="o-po">Prix original (€) *</label>
              <input id="o-po" className="tc-champ" type="number" step="0.01" min="0.5" value={prixOriginal} onChange={e => setPrixOriginal(e.target.value)} placeholder="45,00" required />
            </div>
            <div className="tc-groupe">
              <label className="tc-label" htmlFor="o-pr">Prix réduit (€) *</label>
              <input id="o-pr" className="tc-champ" type="number" step="0.01" min="0.5" value={prixReduit} onChange={e => setPrixReduit(e.target.value)} placeholder="15,00" required />
            </div>
            <div className="tc-groupe">
              <label className="tc-label" htmlFor="o-q">Quantité *</label>
              <input id="o-q" className="tc-champ" type="number" min={estModification ? 0 : 1} max="1000" value={quantite} onChange={e => setQuantite(e.target.value)} required />
            </div>
          </div>

          {prixValides && (
            <div className="tc-apercu-prix tc-apparait">
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--encre-2)' }}>Le client paie</div>
                <div className="gros">
                  {formaterEuros(pRed)}
                  {pOrig > pRed && <s style={{ fontSize: 14, fontWeight: 500, color: 'var(--encre-3)', marginLeft: 8 }}>{formaterEuros(pOrig)}</s>}
                </div>
              </div>
              {remise > 0
                ? <span className="badge">−{remise} %</span>
                : remise < 0 && <span style={{ color: 'var(--texte-annule)', fontSize: 13, fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={15} /> Prix réduit supérieur au prix original</span>}
            </div>
          )}

          <div className="tc-ligne">
            <div className="tc-groupe">
              <label className="tc-label" htmlFor="o-date">Date de péremption</label>
              <input id="o-date" className="tc-champ" type="date" value={datePeremption || ''} onChange={e => setDatePeremption(e.target.value)} />
            </div>
            <div className="tc-groupe">
              <label className="tc-label" htmlFor="o-heure">Créneau de retrait</label>
              <input id="o-heure" className="tc-champ" value={heureRetrait} onChange={e => setHeureRetrait(e.target.value)} placeholder="ex : 17h00 - 19h30" maxLength={100} />
            </div>
          </div>

          {erreur && <div className="tc-alerte erreur"><AlertTriangle size={16} /> {erreur}</div>}
        </form>

        <div className="tc-panneau-pied">
          <button type="button" onClick={onAnnuler} className="tc-btn tc-btn-secondaire" disabled={chargement}>Annuler</button>
          <button type="submit" form="formulaire-offre" className="tc-btn tc-btn-primaire" disabled={chargement}>
            {chargement ? <><Loader2 size={16} className="tc-tourne" /> Enregistrement…</> : estModification ? 'Enregistrer' : 'Publier l\'offre'}
          </button>
        </div>
      </aside>
    </>
  );
}
