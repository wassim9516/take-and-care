// ============================================================
// src/pages/Dashboard.js — Page principale du dashboard
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import {
  getOffresPharmacien, getReservationsPharmacien,
  supprimerOffre, marquerReservationRetiree, modifierOffre,
  getPharmacie, modifierMotDePasse, getStatutStripe, demarrerOnboardingStripe,
} from '../api/client';
import FormulaireOffre   from '../components/FormulaireOffre';
import ProfilPharmacie   from './ProfilPharmacie';

const VERT    = '#2D6A4F';
const VERT_F  = '#1B4332';
const VERT_L  = '#E8F5EE';
const BEIGE   = '#FAF7F0';
const BORDURE = '#EDE8DF';
const BLEU    = '#3498DB';
const ROUGE   = '#C0392B';
const ORANGE  = '#E67E22';

const STATUTS = {
  confirmee: { label: 'Confirmée', couleur: VERT },
  retiree:   { label: 'Retirée',   couleur: BLEU },
  annulee:   { label: 'Annulée',   couleur: ROUGE },
};

const getDerniersjours = (n = 7) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
};

export default function Dashboard() {
  const { pharmacien, seDeconnecter } = useAuth();

  const [onglet, setOnglet]           = useState('offres');
  const [pharmacieData, setPharmacieData] = useState(null);
  const [offres, setOffres]           = useState([]);
  const [reservations, setReservations] = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [derniereMAJ, setDerniereMAJ] = useState(null);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [offreAModifier, setOffreAModifier]         = useState(null);

  // Sélecteur de période pour le graphique stats
  const [periodeGraph, setPeriodeGraph] = useState('7j');

  // Stripe Connect
  const [stripeStatut, setStripeStatut]       = useState(null);
  const [stripeChargement, setStripeChargement] = useState(false);

  // Modal changement de mot de passe
  const [modalMdp, setModalMdp]               = useState(false);
  const [ancienMdp, setAncienMdp]             = useState('');
  const [nouveauMdp, setNouveauMdp]           = useState('');
  const [confirmMdp, setConfirmMdp]           = useState('');
  const [erreurMdp, setErreurMdp]             = useState('');
  const [successMdp, setSuccessMdp]           = useState(false);
  const [chargementMdp, setChargementMdp]     = useState(false);

  // Modal validation rapide par numéro de réservation
  const [modalValidation, setModalValidation]     = useState(false);
  const [numeroRecherche, setNumeroRecherche]     = useState('');
  const [resaTrouvee, setResaTrouvee]             = useState(null);
  const [erreurRecherche, setErreurRecherche]     = useState('');
  const [validationEnCours, setValidationEnCours] = useState(false);
  const [ligneHover, setLigneHover]   = useState(null);

  // Filtres offres
  const [rechercheOffre, setRechercheOffre]       = useState('');
  const [filtreStatutOffre, setFiltreStatutOffre] = useState('tous');

  // Filtres réservations
  const [rechercheResa, setRechercheResa]         = useState('');
  const [filtreStatutResa, setFiltreStatutResa]   = useState('tous');
  const [filtrePeriode, setFiltrePeriode]         = useState('tout');

  const pharmacieId = pharmacien?.pharmacieId;

  const chargerDonnees = useCallback(async () => {
    if (!pharmacieId) return;
    setChargement(true);
    try {
      const [dataOffres, dataResas] = await Promise.all([
        getOffresPharmacien(pharmacieId),
        getReservationsPharmacien(pharmacieId),
      ]);
      setOffres(dataOffres);
      setReservations(dataResas);
      setDerniereMAJ(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  }, [pharmacieId]);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  // Rafraîchissement automatique toutes les 60 secondes
  useEffect(() => {
    const interval = setInterval(chargerDonnees, 60000);
    return () => clearInterval(interval);
  }, [chargerDonnees]);

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  const handleSupprimer = async (id) => {
    if (!window.confirm('Supprimer cette offre définitivement ?')) return;
    try {
      await supprimerOffre(id);
      chargerDonnees();
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  const handleModifier = (offre) => {
    setOffreAModifier(offre);
    setAfficherFormulaire(true);
  };

  const handleToggleActif = async (offre) => {
    try {
      await modifierOffre(offre.id, {
        ...offre,
        produits: Array.isArray(offre.produits) ? offre.produits : [],
        actif: !offre.actif,
      });
      chargerDonnees();
    } catch {
      alert('Erreur lors de la mise à jour du statut.');
    }
  };

  const handleMarquerRetiree = async (id) => {
    if (!window.confirm('Confirmer que le client a retiré ce panier ?')) return;
    try {
      await marquerReservationRetiree(id);
      chargerDonnees();
    } catch {
      alert('Erreur lors de la mise à jour.');
    }
  };

  const rechercherParNumero = () => {
    setErreurRecherche('');
    setResaTrouvee(null);
    const terme = numeroRecherche.trim().toLowerCase();
    if (!terme) { setErreurRecherche('Saisis un numéro de réservation.'); return; }
    const trouve = reservations.find(r => r.numero?.toLowerCase() === terme);
    if (!trouve) { setErreurRecherche('Aucune réservation trouvée avec ce numéro.'); return; }
    if (trouve.statut !== 'confirmee') { setErreurRecherche(`Cette réservation est déjà "${STATUTS[trouve.statut]?.label}".`); return; }
    setResaTrouvee(trouve);
  };

  const validerRetrait = async () => {
    if (!resaTrouvee) return;
    setValidationEnCours(true);
    try {
      await marquerReservationRetiree(resaTrouvee.id);
      setModalValidation(false);
      setNumeroRecherche('');
      setResaTrouvee(null);
      chargerDonnees();
    } catch {
      setErreurRecherche('Erreur lors de la validation.');
    } finally {
      setValidationEnCours(false);
    }
  };

  const fermerModalValidation = () => {
    setModalValidation(false);
    setNumeroRecherche('');
    setResaTrouvee(null);
    setErreurRecherche('');
  };

  const fermerModalMdp = () => {
    setModalMdp(false);
    setAncienMdp(''); setNouveauMdp(''); setConfirmMdp('');
    setErreurMdp(''); setSuccessMdp(false);
  };

  const handleChangerMdp = async () => {
    setErreurMdp('');
    if (!ancienMdp || !nouveauMdp || !confirmMdp) {
      return setErreurMdp('Tous les champs sont obligatoires.');
    }
    if (nouveauMdp.length < 6) {
      return setErreurMdp('Le nouveau mot de passe doit faire au moins 6 caractères.');
    }
    if (nouveauMdp !== confirmMdp) {
      return setErreurMdp('Les deux nouveaux mots de passe ne correspondent pas.');
    }
    setChargementMdp(true);
    try {
      await modifierMotDePasse(ancienMdp, nouveauMdp);
      setSuccessMdp(true);
      setTimeout(fermerModalMdp, 1500);
    } catch (err) {
      setErreurMdp(err?.response?.data?.erreur || 'Ancien mot de passe incorrect.');
    } finally {
      setChargementMdp(false);
    }
  };

  const handleFormulaireTermine = () => {
    setAfficherFormulaire(false);
    setOffreAModifier(null);
    chargerDonnees();
  };

  // -------------------------------------------------------
  // Filtres
  // -------------------------------------------------------
  const offresFiltrees = offres.filter(o => {
    const matchR = o.titre.toLowerCase().includes(rechercheOffre.toLowerCase());
    const matchS = filtreStatutOffre === 'tous' || (filtreStatutOffre === 'active' ? o.actif : !o.actif);
    return matchR && matchS;
  });

  const filtrerParPeriode = (resa) => {
    if (filtrePeriode === 'tout') return true;
    const d   = new Date(resa.createdAt);
    const now = new Date();
    if (filtrePeriode === 'auj')     return d.toDateString() === now.toDateString();
    if (filtrePeriode === 'semaine') { const debut = new Date(now); debut.setDate(now.getDate() - 7); return d >= debut; }
    if (filtrePeriode === 'mois')    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  };

  const resasFiltrees = reservations.filter(r => {
    const client = `${r.utilisateur?.prenom || ''} ${r.utilisateur?.nom || ''}`.toLowerCase();
    const matchR = (r.numero || '').toLowerCase().includes(rechercheResa.toLowerCase())
      || (r.offre?.titre || '').toLowerCase().includes(rechercheResa.toLowerCase())
      || client.includes(rechercheResa.toLowerCase());
    const matchS = filtreStatutResa === 'tous' || r.statut === filtreStatutResa;
    return matchR && matchS && filtrerParPeriode(r);
  });

  // -------------------------------------------------------
  // Statistiques
  // -------------------------------------------------------
  const nbDisponibles  = offres.filter(o => o.actif && o.quantiteDisponible > 0).length;
  const nbReserve      = reservations.filter(r => r.statut === 'confirmee').length;
  const gainTotal      = reservations.filter(r => r.statut !== 'annulee').reduce((s, r) => s + (r.prixPaye || 0), 0);

  const tauxRecuperation = (() => {
    const nonAnnulees = reservations.filter(r => r.statut !== 'annulee').length;
    const retirees    = reservations.filter(r => r.statut === 'retiree').length;
    return nonAnnulees > 0 ? Math.round((retirees / nonAnnulees) * 100) : 0;
  })();

  const topOffres = (() => {
    const counts = {};
    reservations.forEach(r => {
      if (!r.offre) return;
      const id = r.offre.id;
      if (!counts[id]) counts[id] = { titre: r.offre.titre, count: 0, revenu: 0 };
      counts[id].count++;
      if (r.statut !== 'annulee') counts[id].revenu += r.prixPaye || 0;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  })();

  const gainCeMois = reservations
    .filter(r => {
      const d = new Date(r.createdAt); const now = new Date();
      return r.statut !== 'annulee' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, r) => s + (r.prixPaye || 0), 0);

  const gainCetteSemaine = reservations
    .filter(r => {
      const d = new Date(r.createdAt); const debut = new Date(); debut.setDate(debut.getDate() - 7);
      return r.statut !== 'annulee' && d >= debut;
    })
    .reduce((s, r) => s + (r.prixPaye || 0), 0);

  const nbJoursGraph    = periodeGraph === '30j' ? 30 : 7;
  const joursGraph      = getDerniersjours(nbJoursGraph);
  const resasGraph      = joursGraph.map(jour => ({
    jour,
    count: reservations.filter(r => {
      const d = new Date(r.createdAt); d.setHours(0, 0, 0, 0);
      return d.getTime() === jour.getTime();
    }).length,
  }));
  const maxResaGraph    = Math.max(...resasGraph.map(d => d.count), 1);

  const panierMoyen = (() => {
    const valides = reservations.filter(r => r.statut !== 'annulee');
    return valides.length > 0 ? gainTotal / valides.length : 0;
  })();

  const nbOffresPerimees = offres.filter(o => {
    if (!o.datePeremption) return false;
    return new Date(o.datePeremption) < new Date();
  }).length;

  const tauxAnnulation = (() => {
    return reservations.length > 0
      ? Math.round((reservations.filter(r => r.statut === 'annulee').length / reservations.length) * 100)
      : 0;
  })();

  // -------------------------------------------------------
  // Exports
  // -------------------------------------------------------
  const exporterPDF = () => {
    const doc  = new jsPDF();
    const date = new Date().toLocaleDateString('fr-FR');
    doc.setFontSize(18); doc.setTextColor(27, 67, 50);
    doc.text('Take & Care — Réservations', 14, 20);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`Pharmacie : ${pharmacien?.prenom} ${pharmacien?.nom}`, 14, 30);
    doc.text(`Exporté le : ${date}`, 14, 37);
    autoTable(doc, {
      startY: 45,
      head: [['N° Réservation', 'Offre', 'Client', 'Prix payé', 'Date', 'Statut']],
      body: resasFiltrees.map(r => [
        r.numero, r.offre?.titre || '—',
        `${r.utilisateur?.prenom || ''} ${r.utilisateur?.nom || ''}`.trim(),
        `${(r.prixPaye || 0).toFixed(2)} €`,
        new Date(r.createdAt).toLocaleDateString('fr-FR'),
        STATUTS[r.statut]?.label || r.statut,
      ]),
      headStyles: { fillColor: [27, 67, 50], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 247, 240] },
      styles: { fontSize: 10 },
    });
    const total  = resasFiltrees.filter(r => r.statut !== 'annulee').reduce((s, r) => s + (r.prixPaye || 0), 0);
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(11); doc.setTextColor(27, 67, 50);
    doc.text(`Total revenus (hors annulées) : ${total.toFixed(2)} €`, 14, finalY);
    doc.save(`reservations-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exporterCSV = () => {
    const headers = ['N° Réservation', 'Offre', 'Client', 'Prix payé (€)', 'Date', 'Statut'];
    const rows = resasFiltrees.map(r => [
      r.numero, r.offre?.titre || '—',
      `${r.utilisateur?.prenom || ''} ${r.utilisateur?.nom || ''}`.trim(),
      (r.prixPaye || 0).toFixed(2),
      new Date(r.createdAt).toLocaleDateString('fr-FR'),
      STATUTS[r.statut]?.label || r.statut,
    ]);
    const csv  = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------
  // Garde — compte non lié
  // -------------------------------------------------------
  if (!pharmacieId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: BEIGE }}>
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 40, border: `1px solid ${BORDURE}`, textAlign: 'center' }}>
          <p style={{ color: ROUGE, fontWeight: 600, marginBottom: 12 }}>Compte non lié à une pharmacie.</p>
          <p style={{ color: '#6B7C6B', fontSize: 14 }}>Contactez un administrateur pour associer votre compte.</p>
          <button onClick={seDeconnecter} style={{ marginTop: 20, padding: '8px 16px', backgroundColor: VERT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------
  // Rendu
  // -------------------------------------------------------
  return (
    <div style={s.page}>

      {/* ══════════ MODAL VALIDATION PAR NUMÉRO ══════════ */}
      {modalValidation && (
        <div style={s.modalOverlay} onClick={fermerModalValidation}>
          <div style={s.modalCarte} onClick={e => e.stopPropagation()}>

            <div style={s.modalEnTete}>
              <div>
                <h2 style={s.modalTitre}>📷 Valider un retrait</h2>
                <p style={s.modalSousTitre}>Saisis le numéro affiché sur le QR code du client</p>
              </div>
              <button style={s.boutonFermerModal} onClick={fermerModalValidation}>✕</button>
            </div>

            {/* Champ de saisie */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                style={s.inputNumero}
                placeholder="ex : TCP-1234567890-123"
                value={numeroRecherche}
                onChange={e => { setNumeroRecherche(e.target.value); setErreurRecherche(''); setResaTrouvee(null); }}
                onKeyDown={e => e.key === 'Enter' && rechercherParNumero()}
                autoFocus
              />
              <button style={s.boutonChercher} onClick={rechercherParNumero}>
                Rechercher
              </button>
            </div>

            {/* Erreur */}
            {erreurRecherche && (
              <div style={s.alerteErreur}>{erreurRecherche}</div>
            )}

            {/* Résultat trouvé */}
            {resaTrouvee && (
              <div style={s.carteTrouvee}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={s.resaNom}>{resaTrouvee.offre?.titre}</p>
                    <p style={s.resaClient}>
                      Client : {resaTrouvee.utilisateur?.prenom} {resaTrouvee.utilisateur?.nom}
                    </p>
                    <p style={{ ...s.resaClient, fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>
                      {resaTrouvee.numero}
                    </p>
                  </div>
                  <div style={s.resaPrix}>{(resaTrouvee.prixPaye || 0).toFixed(2)} €</div>
                </div>

                <button
                  style={s.boutonValider}
                  onClick={validerRetrait}
                  disabled={validationEnCours}
                >
                  {validationEnCours ? 'Validation...' : '✅ Confirmer le retrait'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ══════════ MODAL MOT DE PASSE ══════════ */}
      {modalMdp && (
        <div style={s.modalOverlay} onClick={fermerModalMdp}>
          <div style={{ ...s.modalCarte, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalEnTete}>
              <div>
                <h2 style={s.modalTitre}>🔑 Changer le mot de passe</h2>
                <p style={s.modalSousTitre}>Saisis ton mot de passe actuel puis le nouveau</p>
              </div>
              <button style={s.boutonFermerModal} onClick={fermerModalMdp}>✕</button>
            </div>

            {successMdp ? (
              <div style={{ ...s.alerteSucces, textAlign: 'center', padding: 24 }}>
                ✅ Mot de passe modifié avec succès !
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={s.labelChamp}>Mot de passe actuel</label>
                  <input
                    type="password"
                    style={s.inputNumero}
                    placeholder="••••••"
                    value={ancienMdp}
                    onChange={e => setAncienMdp(e.target.value)}
                  />
                </div>
                <div>
                  <label style={s.labelChamp}>Nouveau mot de passe</label>
                  <input
                    type="password"
                    style={s.inputNumero}
                    placeholder="6 caractères minimum"
                    value={nouveauMdp}
                    onChange={e => setNouveauMdp(e.target.value)}
                  />
                </div>
                <div>
                  <label style={s.labelChamp}>Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    style={s.inputNumero}
                    placeholder="••••••"
                    value={confirmMdp}
                    onChange={e => setConfirmMdp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChangerMdp()}
                  />
                </div>

                {erreurMdp && <div style={s.alerteErreur}>{erreurMdp}</div>}

                <button
                  style={{ ...s.boutonValider, marginTop: 4 }}
                  onClick={handleChangerMdp}
                  disabled={chargementMdp}
                >
                  {chargementMdp ? 'Modification...' : '🔑 Modifier le mot de passe'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ SIDEBAR ══════════ */}
      <aside style={s.sidebar}>
        <div style={s.logoSidebar}>
          <span style={{ fontSize: 26 }}>🍀</span>
          <span style={s.nomApp}>Take & Care</span>
        </div>

        <nav style={s.nav}>
          {/* Bouton validation rapide QR */}
          <button
            style={s.boutonValidation}
            onClick={() => setModalValidation(true)}
          >
            <span style={{ marginRight: 8 }}>📷</span> Valider un retrait
          </button>

          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />

          {[
            { id: 'offres',        label: 'Mes offres',     icone: '📦' },
            { id: 'reservations',  label: 'Réservations',   icone: '🎫' },
            { id: 'stats',         label: 'Statistiques',   icone: '📊' },
            { id: 'paiements',     label: 'Paiements',      icone: '💳' },
            { id: 'pharmacie',     label: 'Ma pharmacie',   icone: '🏥' },
          ].map(item => (
            <button
              key={item.id}
              style={{ ...s.lienNav, ...(onglet === item.id ? s.lienActif : {}) }}
              onClick={() => {
                setOnglet(item.id);
                if ((item.id === 'pharmacie' || item.id === 'stats') && !pharmacieData && pharmacieId) {
                  getPharmacie(pharmacieId).then(setPharmacieData).catch(() => {});
                }
                if (item.id === 'paiements' && !stripeStatut) {
                  getStatutStripe().then(setStripeStatut).catch(() => {});
                }
              }}
            >
              <span style={{ marginRight: 8 }}>{item.icone}</span>
              {item.label}
              {item.id === 'reservations' && nbReserve > 0 && (
                <span style={s.badge}>{nbReserve}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={s.piedSidebar}>
          {derniereMAJ && (
            <p style={s.derniereMAJ}>
              Mis à jour {derniereMAJ.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <button onClick={chargerDonnees} disabled={chargement} style={s.boutonRefresh}>
            {chargement ? '…' : '↻'} Rafraîchir
          </button>
          <div style={s.separateurSidebar} />
          <div style={s.infoPharmacien}>
            <div style={s.avatarInitiales}>
              {(pharmacien?.prenom?.[0] || '?')}{(pharmacien?.nom?.[0] || '')}
            </div>
            <div>
              <p style={s.nomPharmacien}>{pharmacien?.prenom} {pharmacien?.nom}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setModalMdp(true)} style={s.boutonDeconnexion}>🔑 Mot de passe</button>
                <button onClick={seDeconnecter} style={{ ...s.boutonDeconnexion, color: '#f87171' }}>Déconnexion</button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════ CONTENU PRINCIPAL ══════════ */}
      <main style={s.main}>

        {/* ── KPI CARDS ── */}
        <div style={s.statsRapides}>
          <CarteKPI couleur={VERT_F}   fond={VERT_L}  icone="📦" valeur={offres.length}           label="Offres créées"        />
          <CarteKPI couleur={VERT}     fond={VERT_L}  icone="✅" valeur={nbDisponibles}            label="Disponibles"          />
          <CarteKPI couleur={ORANGE}   fond="#FEF3E7" icone="🎫" valeur={nbReserve}                label="En attente retrait"   />
          <CarteKPI couleur={VERT_F}   fond={VERT_L}  icone="💶" valeur={`${gainTotal.toFixed(0)}€`} label="Revenus générés"   />
        </div>

        {/* ════════════════════════════
            ONGLET OFFRES
        ════════════════════════════ */}
        {onglet === 'offres' && (
          <section>
            <div style={s.ligneEntete}>
              <h2 style={s.titreSection}>Mes offres</h2>
              <button
                style={s.boutonAjouter}
                onClick={() => { setOffreAModifier(null); setAfficherFormulaire(true); }}
              >
                + Nouvelle offre
              </button>
            </div>

            <div style={s.barreFiltre}>
              <input
                style={s.inputRecherche}
                placeholder="Rechercher une offre..."
                value={rechercheOffre}
                onChange={e => setRechercheOffre(e.target.value)}
              />
              <select style={s.selectFiltre} value={filtreStatutOffre} onChange={e => setFiltreStatutOffre(e.target.value)}>
                <option value="tous">Tous les statuts</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {afficherFormulaire && (
              <FormulaireOffre
                pharmacieId={pharmacieId}
                offre={offreAModifier}
                onTermine={handleFormulaireTermine}
                onAnnuler={() => { setAfficherFormulaire(false); setOffreAModifier(null); }}
              />
            )}

            {chargement ? (
              <Chargement />
            ) : offres.length === 0 ? (
              <Vide message="Aucune offre pour le moment." detail='Clique sur "+ Nouvelle offre" pour commencer.' />
            ) : (
              <div style={s.tableauConteneur}>
                {offresFiltrees.length === 0 && (
                  <p style={{ padding: 20, color: '#6B7C6B', textAlign: 'center' }}>Aucune offre ne correspond à ta recherche.</p>
                )}
                <table style={s.tableau}>
                  <thead>
                    <tr style={s.enteteTableau}>
                      <th style={s.th}>Titre</th>
                      <th style={s.th}>Catégorie</th>
                      <th style={s.th}>Prix réduit</th>
                      <th style={s.th}>Stock</th>
                      <th style={s.th}>Statut</th>
                      <th style={s.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offresFiltrees.map((offre) => {
                      const hovered = ligneHover === `o-${offre.id}`;
                      return (
                        <tr
                          key={offre.id}
                          style={{ backgroundColor: hovered ? '#F0F7F4' : '#fff', transition: 'background 0.15s' }}
                          onMouseEnter={() => setLigneHover(`o-${offre.id}`)}
                          onMouseLeave={() => setLigneHover(null)}
                        >
                          <td style={{ ...s.td, fontWeight: 500 }}>{offre.titre}</td>
                          <td style={s.td}><span style={s.tagCategorie}>{offre.categorie}</span></td>
                          <td style={s.td}><strong style={{ color: VERT }}>{offre.prixReduit} €</strong></td>
                          <td style={s.td}>
                            <span style={{ color: offre.quantiteDisponible === 0 ? ROUGE : '#1A2E1A', fontWeight: 600 }}>
                              {offre.quantiteDisponible}
                            </span>
                          </td>
                          <td style={s.td}>
                            {/* Toggle actif/inactif inline */}
                            <button
                              style={{
                                ...s.toggleSwitch,
                                backgroundColor: offre.actif ? VERT : '#bbb',
                              }}
                              onClick={() => handleToggleActif(offre)}
                              title={offre.actif ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                            >
                              <span style={{
                                ...s.toggleKnob,
                                transform: offre.actif ? 'translateX(18px)' : 'translateX(2px)',
                              }} />
                            </button>
                            <span style={{ marginLeft: 8, fontSize: 12, color: offre.actif ? VERT : '#888', fontWeight: 600 }}>
                              {offre.actif ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={s.td}>
                            <button style={s.btnModifier}  onClick={() => handleModifier(offre)}>Modifier</button>
                            <button style={s.btnSupprimer} onClick={() => handleSupprimer(offre.id)}>Supprimer</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════
            ONGLET RÉSERVATIONS
        ════════════════════════════ */}
        {onglet === 'reservations' && (
          <section>
            <div style={{ ...s.ligneEntete, marginBottom: 16 }}>
              <h2 style={s.titreSection}>Réservations reçues</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.boutonExport} onClick={exporterCSV} disabled={resasFiltrees.length === 0}>
                  ⬇ CSV
                </button>
                <button style={s.boutonExport} onClick={exporterPDF} disabled={resasFiltrees.length === 0}>
                  ⬇ PDF
                </button>
              </div>
            </div>

            {/* Filtres */}
            <div style={s.barreFiltre}>
              <input
                style={s.inputRecherche}
                placeholder="Rechercher par N°, offre ou client..."
                value={rechercheResa}
                onChange={e => setRechercheResa(e.target.value)}
              />
              <select style={s.selectFiltre} value={filtreStatutResa} onChange={e => setFiltreStatutResa(e.target.value)}>
                <option value="tous">Tous les statuts</option>
                <option value="confirmee">Confirmée</option>
                <option value="retiree">Retirée</option>
                <option value="annulee">Annulée</option>
              </select>
              <select style={s.selectFiltre} value={filtrePeriode} onChange={e => setFiltrePeriode(e.target.value)}>
                <option value="tout">Toutes les périodes</option>
                <option value="auj">Aujourd'hui</option>
                <option value="semaine">7 derniers jours</option>
                <option value="mois">Ce mois</option>
              </select>
            </div>

            {chargement ? (
              <Chargement />
            ) : reservations.length === 0 ? (
              <Vide message="Aucune réservation pour le moment." />
            ) : (
              <div style={s.tableauConteneur}>
                {resasFiltrees.length === 0 && (
                  <p style={{ padding: 20, color: '#6B7C6B', textAlign: 'center' }}>Aucune réservation ne correspond aux filtres.</p>
                )}
                <table style={s.tableau}>
                  <thead>
                    <tr style={s.enteteTableau}>
                      <th style={s.th}>N° Réservation</th>
                      <th style={s.th}>Offre</th>
                      <th style={s.th}>Client</th>
                      <th style={s.th}>Prix payé</th>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Statut</th>
                      <th style={s.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resasFiltrees.map((resa) => {
                      const statut  = STATUTS[resa.statut] || STATUTS.confirmee;
                      const hovered = ligneHover === `r-${resa.id}`;
                      return (
                        <tr
                          key={resa.id}
                          style={{ backgroundColor: hovered ? '#F0F7F4' : '#fff', transition: 'background 0.15s' }}
                          onMouseEnter={() => setLigneHover(`r-${resa.id}`)}
                          onMouseLeave={() => setLigneHover(null)}
                        >
                          <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, color: '#555' }}>{resa.numero}</td>
                          <td style={{ ...s.td, fontWeight: 500 }}>{resa.offre?.titre || '—'}</td>
                          <td style={s.td}>{resa.utilisateur?.prenom} {resa.utilisateur?.nom}</td>
                          <td style={s.td}><strong style={{ color: VERT }}>{(resa.prixPaye || 0).toFixed(2)} €</strong></td>
                          <td style={{ ...s.td, color: '#6B7C6B', fontSize: 13 }}>
                            {new Date(resa.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td style={s.td}>
                            <span style={{
                              padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              backgroundColor: statut.couleur + '20', color: statut.couleur,
                            }}>
                              {statut.label}
                            </span>
                          </td>
                          <td style={s.td}>
                            {resa.statut === 'confirmee' && (
                              <button style={s.btnRetiree} onClick={() => handleMarquerRetiree(resa.id)}>
                                ✅ Retiré
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Total filtré */}
                {resasFiltrees.length > 0 && (
                  <div style={s.totalFiltree}>
                    <span style={{ color: '#6B7C6B', fontSize: 13 }}>
                      {resasFiltrees.length} réservation{resasFiltrees.length > 1 ? 's' : ''}
                    </span>
                    <span style={{ fontWeight: 700, color: VERT_F }}>
                      Total : {resasFiltrees.filter(r => r.statut !== 'annulee').reduce((s, r) => s + (r.prixPaye || 0), 0).toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════
            ONGLET MA PHARMACIE
        ════════════════════════════ */}
        {onglet === 'pharmacie' && (
          <ProfilPharmacie
            pharmacie={pharmacieData}
            onRetour={() => setOnglet('offres')}
            onMiseAJour={(p) => setPharmacieData(p)}
          />
        )}

        {/* ════════════════════════════
            ONGLET STATISTIQUES
        ════════════════════════════ */}
        {onglet === 'paiements' && (
          <section>
            <div style={s.ligneEntete}>
              <h2 style={s.titreSection}>Paiements & Stripe Connect</h2>
            </div>

            {/* Statut du compte */}
            <div style={{ ...s.carteGraph, marginBottom: 20 }}>
              <h3 style={s.titreCarte}>💳 Ton compte Stripe</h3>

              {!stripeStatut ? (
                <p style={{ color: '#6B7C6B', fontSize: 14 }}>Chargement...</p>
              ) : stripeStatut.connecte ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: VERT }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: VERT_F }}>Compte actif — paiements et virements activés</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#6B7C6B' }}>
                    ID : <code style={{ fontFamily: 'monospace', backgroundColor: '#F0F4F0', padding: '2px 6px', borderRadius: 4 }}>{stripeStatut.stripeAccountId}</code>
                  </p>
                  <p style={{ fontSize: 13, color: '#6B7C6B', marginTop: 8 }}>
                    Les paiements clients sont automatiquement virés sur ton compte bancaire après déduction de la commission plateforme.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: ORANGE }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: ORANGE }}>Compte non configuré</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#6B7C6B', marginBottom: 20, lineHeight: '1.6' }}>
                    Pour recevoir tes revenus automatiquement, tu dois connecter un compte bancaire via Stripe.
                    Cela prend environ <strong>5 minutes</strong>.
                  </p>
                  <button
                    style={{ ...s.boutonValider, display: 'inline-flex', width: 'auto', padding: '12px 24px' }}
                    disabled={stripeChargement}
                    onClick={async () => {
                      setStripeChargement(true);
                      try {
                        const data = await demarrerOnboardingStripe();
                        window.open(data.url, '_blank');
                      } catch {
                        alert('Erreur lors de la connexion Stripe.');
                      } finally {
                        setStripeChargement(false);
                      }
                    }}
                  >
                    {stripeChargement ? 'Chargement...' : '🔗 Connecter mon compte bancaire'}
                  </button>
                </div>
              )}
            </div>

            {/* Récapitulatif des revenus */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>💶</span>
                <div>
                  <p style={s.statAvanceeNombre}>{gainTotal.toFixed(2)} €</p>
                  <p style={s.statAvanceeLabel}>Revenus bruts totaux</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>hors annulations</p>
                </div>
              </div>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>📤</span>
                <div>
                  <p style={s.statAvanceeNombre}>{(gainTotal * 0.9).toFixed(2)} €</p>
                  <p style={s.statAvanceeLabel}>Revenus nets (90%)</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>après commission 10%</p>
                </div>
              </div>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>🏦</span>
                <div>
                  <p style={s.statAvanceeNombre}>{(gainTotal * 0.1).toFixed(2)} €</p>
                  <p style={s.statAvanceeLabel}>Commission plateforme</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>10% par transaction</p>
                </div>
              </div>
            </div>

            {/* Historique des paiements */}
            <div style={s.carteGraph}>
              <h3 style={s.titreCarte}>Historique des transactions</h3>
              {reservations.filter(r => r.statut !== 'annulee').length === 0 ? (
                <p style={{ color: '#6B7C6B', fontSize: 14 }}>Aucune transaction pour l'instant.</p>
              ) : (
                <table style={{ ...s.tableau, marginTop: 0 }}>
                  <thead>
                    <tr style={s.enteteTableau}>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Client</th>
                      <th style={s.th}>Offre</th>
                      <th style={s.th}>Montant brut</th>
                      <th style={s.th}>Commission (10%)</th>
                      <th style={s.th}>Net perçu</th>
                      <th style={s.th}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations
                      .filter(r => r.statut !== 'annulee')
                      .slice(0, 20)
                      .map((r, i) => {
                        const brut       = r.prixPaye || 0;
                        const commission = parseFloat((brut * 0.1).toFixed(2));
                        const net        = parseFloat((brut * 0.9).toFixed(2));
                        return (
                          <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : BEIGE }}>
                            <td style={s.td}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                            <td style={s.td}>{r.utilisateur?.prenom} {r.utilisateur?.nom}</td>
                            <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.offre?.titre}</td>
                            <td style={s.td}><strong>{brut.toFixed(2)} €</strong></td>
                            <td style={{ ...s.td, color: ROUGE }}>-{commission.toFixed(2)} €</td>
                            <td style={{ ...s.td, color: VERT, fontWeight: 700 }}>{net.toFixed(2)} €</td>
                            <td style={s.td}>
                              <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, backgroundColor: STATUTS[r.statut]?.couleur + '20', color: STATUTS[r.statut]?.couleur }}>
                                {STATUTS[r.statut]?.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {onglet === 'stats' && (
          <section>
            <div style={s.ligneEntete}>
              <h2 style={s.titreSection}>Statistiques</h2>
            </div>

            {/* ── Ligne 1 : KPIs principaux ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>📈</span>
                <div>
                  <p style={s.statAvanceeNombre}>{tauxRecuperation}%</p>
                  <p style={s.statAvanceeLabel}>Taux de récupération</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>paniers retirés / non annulés</p>
                </div>
              </div>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>💳</span>
                <div>
                  <p style={s.statAvanceeNombre}>{panierMoyen.toFixed(2)} €</p>
                  <p style={s.statAvanceeLabel}>Panier moyen</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>revenu moyen / réservation</p>
                </div>
              </div>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>⭐</span>
                <div>
                  <p style={s.statAvanceeNombre}>
                    {pharmacieData?.note > 0 ? `${Number(pharmacieData.note).toFixed(1)} / 5` : '—'}
                  </p>
                  <p style={s.statAvanceeLabel}>Note moyenne</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>évaluations clients</p>
                </div>
              </div>
            </div>

            {/* ── Ligne 2 : KPIs revenus ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>📅</span>
                <div>
                  <p style={s.statAvanceeNombre}>{gainCetteSemaine.toFixed(0)} €</p>
                  <p style={s.statAvanceeLabel}>Revenus cette semaine</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>7 derniers jours</p>
                </div>
              </div>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>🗓️</span>
                <div>
                  <p style={s.statAvanceeNombre}>{gainCeMois.toFixed(0)} €</p>
                  <p style={s.statAvanceeLabel}>Revenus ce mois</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>
                    {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div style={s.carteStats}>
                <span style={{ fontSize: 28 }}>🚫</span>
                <div>
                  <p style={{ ...s.statAvanceeNombre, color: tauxAnnulation > 20 ? ROUGE : VERT_F }}>
                    {tauxAnnulation}%
                  </p>
                  <p style={s.statAvanceeLabel}>Taux d'annulation</p>
                  <p style={{ fontSize: 11, color: '#6B7C6B', margin: '4px 0 0' }}>
                    {reservations.filter(r => r.statut === 'annulee').length} annulation{reservations.filter(r => r.statut === 'annulee').length !== 1 ? 's' : ''} sur {reservations.length}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Graphique barres avec sélecteur de période */}
              <div style={s.carteGraph}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ ...s.titreCarte, marginBottom: 0 }}>Réservations</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['7j', '30j'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriodeGraph(p)}
                        style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', border: `1px solid ${periodeGraph === p ? VERT : BORDURE}`,
                          backgroundColor: periodeGraph === p ? VERT : '#fff',
                          color: periodeGraph === p ? '#fff' : '#6B7C6B',
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: nbJoursGraph === 30 ? 4 : 10, height: 130, padding: '8px 0' }}>
                  {resasGraph.map(({ jour, count }, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      {count > 0 && <span style={{ fontSize: 10, color: VERT_F, fontWeight: 700 }}>{count}</span>}
                      <div style={{
                        width: '100%',
                        height: `${Math.max((count / maxResaGraph) * 110, 4)}px`,
                        backgroundColor: count > 0 ? VERT : BORDURE,
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.4s ease',
                      }} />
                      {nbJoursGraph === 7 && (
                        <span style={{ fontSize: 10, color: '#6B7C6B' }}>
                          {jour.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </span>
                      )}
                      {nbJoursGraph === 30 && i % 5 === 0 && (
                        <span style={{ fontSize: 9, color: '#6B7C6B' }}>
                          {jour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Répartition des statuts */}
              <div style={s.carteGraph}>
                <h3 style={s.titreCarte}>Répartition des statuts</h3>
                {reservations.length === 0 ? (
                  <p style={{ color: '#6B7C6B', fontSize: 14 }}>Aucune réservation pour l'instant.</p>
                ) : (
                  [
                    { statut: 'confirmee', label: 'Confirmées',  couleur: VERT },
                    { statut: 'retiree',   label: 'Retirées',    couleur: BLEU },
                    { statut: 'annulee',   label: 'Annulées',    couleur: ROUGE },
                  ].map(({ statut, label, couleur }) => {
                    const count = reservations.filter(r => r.statut === statut).length;
                    const pct   = Math.round((count / reservations.length) * 100);
                    return (
                      <div key={statut} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1A2E1A' }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: couleur }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 8, backgroundColor: BORDURE, borderRadius: 99 }}>
                          <div style={{
                            height: 8, width: `${pct}%`, backgroundColor: couleur,
                            borderRadius: 99, transition: 'width 0.5s ease',
                            minWidth: pct > 0 ? 8 : 0,
                          }} />
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Alertes stock */}
                {nbOffresPerimees > 0 && (
                  <div style={{ marginTop: 20, padding: '10px 14px', backgroundColor: '#FEF3E7', borderRadius: 10, borderLeft: `3px solid ${ORANGE}` }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: ORANGE, margin: 0 }}>
                      ⚠️ {nbOffresPerimees} offre{nbOffresPerimees > 1 ? 's' : ''} périmée{nbOffresPerimees > 1 ? 's' : ''}
                    </p>
                    <p style={{ fontSize: 12, color: '#6B7C6B', margin: '4px 0 0' }}>
                      Pense à les désactiver ou les supprimer
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Top offres */}
            <div style={s.carteGraph}>
              <h3 style={s.titreCarte}>Top offres par réservations</h3>
              {topOffres.length === 0 ? (
                <p style={{ color: '#6B7C6B', fontSize: 14 }}>Aucune donnée disponible.</p>
              ) : (
                <table style={{ ...s.tableau, marginTop: 0 }}>
                  <thead>
                    <tr style={s.enteteTableau}>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Offre</th>
                      <th style={s.th}>Réservations</th>
                      <th style={s.th}>Revenus générés</th>
                      <th style={s.th}>Revenu moyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topOffres.map((offre, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : BEIGE }}>
                        <td style={{ ...s.td, fontWeight: 800, color: i === 0 ? '#F1C40F' : i === 1 ? '#BDC3C7' : i === 2 ? '#CD7F32' : '#6B7C6B' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                        </td>
                        <td style={{ ...s.td, fontWeight: 500 }}>{offre.titre}</td>
                        <td style={s.td}><strong>{offre.count}</strong></td>
                        <td style={s.td}><strong style={{ color: VERT }}>{offre.revenu.toFixed(2)} €</strong></td>
                        <td style={s.td}>{offre.count > 0 ? (offre.revenu / offre.count).toFixed(2) : '—'} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

// -------------------------------------------------------
// Composants utilitaires
// -------------------------------------------------------
function CarteKPI({ icone, valeur, label, couleur, fond }) {
  return (
    <div style={{ backgroundColor: fond || '#fff', borderRadius: 14, padding: '20px 24px', border: `1px solid ${BORDURE}`, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icone}</div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: couleur || VERT_F, margin: 0, lineHeight: 1.1 }}>{valeur}</p>
        <p style={{ fontSize: 12, color: '#6B7C6B', margin: '4px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}

function Chargement() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 0', color: '#6B7C6B' }}>
      <div style={{
        width: 18, height: 18, border: `2px solid ${BORDURE}`, borderTopColor: VERT,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      Chargement...
    </div>
  );
}

function Vide({ message, detail }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, border: `1px solid ${BORDURE}`, padding: 48, textAlign: 'center', color: '#1A2E1A' }}>
      <p style={{ fontWeight: 500, marginBottom: 6 }}>{message}</p>
      {detail && <p style={{ color: '#6B7C6B', fontSize: 14 }}>{detail}</p>}
    </div>
  );
}

// -------------------------------------------------------
// Styles
// -------------------------------------------------------
const s = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: BEIGE,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  sidebar: {
    width: 230,
    backgroundColor: VERT_F,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 14px',
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
  },
  logoSidebar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    paddingLeft: 6,
  },
  nomApp: {
    color: '#fff',
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: '-0.3px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  lienNav: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'left',
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  lienActif: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontWeight: 700,
  },
  badge: {
    marginLeft: 'auto',
    backgroundColor: ORANGE,
    color: '#fff',
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 800,
    minWidth: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
  },
  piedSidebar: {
    marginTop: 16,
  },
  derniereMAJ: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    margin: '0 0 8px',
  },
  boutonValidation: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    border: '1.5px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 0',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'left',
    paddingLeft: 14,
  },
  boutonRefresh: {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    padding: '7px 0',
    cursor: 'pointer',
    fontSize: 13,
    marginBottom: 12,
  },
  // Modal validation
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modalCarte: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalEnTete: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitre: {
    fontSize: 20,
    fontWeight: 800,
    color: VERT_F,
    margin: 0,
  },
  modalSousTitre: {
    fontSize: 13,
    color: '#6B7C6B',
    margin: '4px 0 0',
  },
  boutonFermerModal: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#6B7C6B',
    padding: 4,
  },
  inputNumero: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: 10,
    border: `1.5px solid ${BORDURE}`,
    fontSize: 14,
    fontFamily: 'monospace',
    outline: 'none',
    backgroundColor: BEIGE,
  },
  boutonChercher: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  alerteErreur: {
    backgroundColor: '#fdf0ef',
    color: ROUGE,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 12,
  },
  alerteSucces: {
    backgroundColor: VERT_L,
    color: VERT_F,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    fontWeight: 600,
  },
  labelChamp: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: VERT_F,
    marginBottom: 6,
  },
  carteTrouvee: {
    backgroundColor: VERT_L,
    border: `1.5px solid ${VERT}40`,
    borderRadius: 14,
    padding: 18,
  },
  resaNom: {
    fontSize: 16,
    fontWeight: 700,
    color: VERT_F,
    margin: 0,
  },
  resaClient: {
    fontSize: 13,
    color: '#4A6A4A',
    margin: '4px 0 0',
  },
  resaPrix: {
    fontSize: 20,
    fontWeight: 800,
    color: VERT,
    flexShrink: 0,
  },
  boutonValider: {
    width: '100%',
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  separateurSidebar: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    margin: '4px 0 12px',
  },
  infoPharmacien: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  avatarInitiales: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
  },
  nomPharmacien: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: 500,
    margin: '0 0 4px',
  },
  boutonDeconnexion: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    padding: 0,
    cursor: 'pointer',
    fontSize: 12,
    textDecoration: 'underline',
  },
  main: {
    marginLeft: 230,
    padding: '32px 36px',
    flex: 1,
  },
  statsRapides: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 28,
  },
  ligneEntete: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titreSection: {
    fontSize: 20,
    fontWeight: 700,
    color: VERT_F,
    margin: 0,
  },
  boutonAjouter: {
    backgroundColor: VERT,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableauConteneur: {
    backgroundColor: '#fff',
    borderRadius: 12,
    border: `1px solid ${BORDURE}`,
    overflow: 'hidden',
  },
  tableau: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  enteteTableau: {
    backgroundColor: BEIGE,
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: '#6B7C6B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: `1px solid ${BORDURE}`,
  },
  td: {
    padding: '14px 16px',
    fontSize: 14,
    color: '#1A2E1A',
    borderBottom: `1px solid ${BORDURE}`,
  },
  tagCategorie: {
    backgroundColor: VERT_L,
    color: VERT_F,
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
  },
  toggleSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'background 0.25s',
    verticalAlign: 'middle',
    padding: 0,
  },
  toggleKnob: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    transition: 'transform 0.25s',
  },
  btnModifier: {
    backgroundColor: VERT + '20',
    color: VERT,
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: 6,
  },
  btnSupprimer: {
    backgroundColor: ROUGE + '15',
    color: ROUGE,
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnRetiree: {
    backgroundColor: BLEU + '15',
    color: BLEU,
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  boutonExport: {
    backgroundColor: '#fff',
    color: VERT,
    border: `1px solid ${VERT}`,
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  barreFiltre: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  inputRecherche: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${BORDURE}`,
    fontSize: 14,
    backgroundColor: '#fff',
    outline: 'none',
  },
  selectFiltre: {
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${BORDURE}`,
    fontSize: 14,
    backgroundColor: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  totalFiltree: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: `1px solid ${BORDURE}`,
    backgroundColor: BEIGE,
  },
  carteStats: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: '20px 24px',
    border: `1px solid ${BORDURE}`,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  statAvanceeNombre: {
    fontSize: 24,
    fontWeight: 800,
    color: VERT_F,
    margin: 0,
    lineHeight: 1.1,
  },
  statAvanceeLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1A2E1A',
    margin: '4px 0 0',
  },
  carteGraph: {
    backgroundColor: '#fff',
    borderRadius: 14,
    border: `1px solid ${BORDURE}`,
    padding: 24,
    overflow: 'hidden',
  },
  titreCarte: {
    fontSize: 15,
    fontWeight: 700,
    color: VERT_F,
    margin: '0 0 20px',
  },
};
