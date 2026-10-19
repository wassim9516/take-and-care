// ============================================================
// src/pages/Dashboard.js — Page principale du dashboard
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Leaf, ShoppingBag, Package, Ticket, BarChart3, CreditCard, Settings, Menu, RefreshCw,
  Plus, Euro, Hourglass, CalendarDays, Search, LayoutGrid, List, Pencil, Trash2, Clock,
  CalendarClock, Check, AlertTriangle, Download, Star, Ban, Calendar, Wallet, Landmark,
  Link as LienIcone, Sun, Baby, Pill, Bath, Droplet, ShoppingBasket, TrendingUp,
  Loader2, Receipt, X,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import {
  getOffresPharmacien, getReservationsPharmacien,
  supprimerOffre, marquerReservationRetiree, modifierOffre,
  getPharmacie, getStatutStripe, demarrerOnboardingStripe,
} from '../api/client';
import FormulaireOffre   from '../components/FormulaireOffre';
import Reglages          from './Reglages';
import { usePreferences } from '../utils/preferences';
import {
  STATUTS, NombreAnime, Sparkline, GraphiqueAire, RepartitionStatuts,
  BarresHorizontales, Pastille, Vide, Squelette, useRetours, formaterEuros,
} from '../components/ui';

const CATEGORIES = {
  soin_visage: { label: 'Soin visage', icone: Droplet },
  soin_corps:  { label: 'Soin corps',  icone: Bath },
  complement:  { label: 'Compléments', icone: Pill },
  bebe:        { label: 'Bébé',        icone: Baby },
  solaire:     { label: 'Solaire',     icone: Sun },
};

const ONGLETS = [
  { id: 'offres',        label: 'Mes offres',     icone: Package },
  { id: 'reservations',  label: 'Réservations',   icone: Ticket },
  { id: 'stats',         label: 'Statistiques',   icone: BarChart3 },
  { id: 'paiements',     label: 'Paiements',      icone: CreditCard },
];
const ONGLET_REGLAGES = { id: 'reglages', label: 'Réglages', icone: Settings };

function IconeCategorie({ categorie, size = 13 }) {
  const Icone = CATEGORIES[categorie]?.icone || ShoppingBasket;
  return <Icone size={size} strokeWidth={2} aria-hidden="true" />;
}

const COMMISSION = 0.1;

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

const memeJour = (date, jour) => {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return d.getTime() === jour.getTime();
};

const initiales = (prenom, nom) => `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase() || '?';

// Jours restants avant la date de péremption (null si pas de date)
const joursAvant = (date) => {
  if (!date) return null;
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  return Math.round((new Date(date) - auj) / 86400000);
};

export default function Dashboard() {
  const { pharmacien, seDeconnecter } = useAuth();
  const { notifier, confirmer } = useRetours();
  const [preferences] = usePreferences();

  const [onglet, setOnglet]           = useState(preferences.ongletDemarrage);
  const [sectionReglages, setSectionReglages] = useState('profil');
  const [menuOuvert, setMenuOuvert]   = useState(false);
  const [pharmacieData, setPharmacieData] = useState(null);
  const [offres, setOffres]           = useState([]);
  const [reservations, setReservations] = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [premierChargement, setPremierChargement] = useState(true);
  const [derniereMAJ, setDerniereMAJ] = useState(null);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [offreAModifier, setOffreAModifier]         = useState(null);
  const [vueOffres, setVueOffres]     = useState(preferences.vueOffres);
  useEffect(() => { setVueOffres(preferences.vueOffres); }, [preferences.vueOffres]);

  // Sélecteur de période pour le graphique stats
  const [periodeGraph, setPeriodeGraph] = useState('7j');
  const [vueTableauGraph, setVueTableauGraph] = useState(false);

  // Stripe Connect
  const [stripeStatut, setStripeStatut]       = useState(null);
  const [stripeChargement, setStripeChargement] = useState(false);

  // Modal validation rapide par numéro de réservation
  const [modalValidation, setModalValidation]     = useState(false);
  const [numeroRecherche, setNumeroRecherche]     = useState('');
  const [resaTrouvee, setResaTrouvee]             = useState(null);
  const [erreurRecherche, setErreurRecherche]     = useState('');
  const [validationEnCours, setValidationEnCours] = useState(false);

  // Filtres offres
  const [rechercheOffre, setRechercheOffre]       = useState('');
  const [filtreStatutOffre, setFiltreStatutOffre] = useState('tous');

  // Filtres réservations
  const [rechercheResa, setRechercheResa]         = useState('');
  const [filtreStatutResa, setFiltreStatutResa]   = useState('tous');
  const [filtrePeriode, setFiltrePeriode]         = useState('tout');

  const pharmacieId = pharmacien?.pharmacieId;

  // Réservations déjà connues → détecte les nouvelles à chaque actualisation
  const idsConnus = useRef(null);
  const alerteActive = useRef(preferences.alerteNouvelleResa);
  alerteActive.current = preferences.alerteNouvelleResa;

  const chargerDonnees = useCallback(async () => {
    if (!pharmacieId) return;
    setChargement(true);
    try {
      const [dataOffres, dataResas] = await Promise.all([
        getOffresPharmacien(pharmacieId),
        getReservationsPharmacien(pharmacieId),
      ]);
      if (idsConnus.current && alerteActive.current) {
        dataResas
          .filter(r => !idsConnus.current.has(r.id))
          .forEach(r => notifier(`Nouvelle réservation : ${r.utilisateur?.prenom || 'un client'} — ${r.offre?.titre || 'panier'}`));
      }
      idsConnus.current = new Set(dataResas.map(r => r.id));
      setOffres(dataOffres);
      setReservations(dataResas);
      setDerniereMAJ(new Date());
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setChargement(false);
      setPremierChargement(false);
    }
  }, [pharmacieId, notifier]);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  // Rafraîchissement automatique (fréquence réglable dans Réglages → Préférences)
  useEffect(() => {
    if (!preferences.rafraichissement) return;
    const interval = setInterval(chargerDonnees, preferences.rafraichissement * 1000);
    return () => clearInterval(interval);
  }, [chargerDonnees, preferences.rafraichissement]);

  // La note moyenne (onglet stats) vient de la fiche pharmacie
  useEffect(() => {
    if ((onglet === 'reglages' || onglet === 'stats') && !pharmacieData && pharmacieId) {
      getPharmacie().then(setPharmacieData).catch(() => {});
    }
    if (onglet === 'paiements' && !stripeStatut) {
      getStatutStripe().then(setStripeStatut).catch(() => setStripeStatut({ connecte: false }));
    }
  }, [onglet, pharmacieData, pharmacieId, stripeStatut]);

  const changerOnglet = (id) => { setOnglet(id); setMenuOuvert(false); };
  const ouvrirReglages = (section) => { setSectionReglages(section); changerOnglet('reglages'); };

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  const handleSupprimer = async (offre) => {
    const ok = await confirmer({
      icone: Trash2, danger: true, bouton: 'Supprimer',
      titre: 'Supprimer cette offre ?',
      texte: `« ${offre.titre} » sera supprimée définitivement.`,
    });
    if (!ok) return;
    try {
      await supprimerOffre(offre.id);
      notifier('Offre supprimée.');
      chargerDonnees();
    } catch (err) {
      notifier(err.response?.data?.erreur || 'Erreur lors de la suppression.', 'erreur');
    }
  };

  const handleModifier = (offre) => {
    setOffreAModifier(offre);
    setAfficherFormulaire(true);
  };

  const handleToggleActif = async (offre) => {
    // Mise à jour optimiste : l'interrupteur bascule tout de suite
    setOffres(liste => liste.map(o => o.id === offre.id ? { ...o, actif: !o.actif } : o));
    try {
      await modifierOffre(offre.id, {
        ...offre,
        produits: Array.isArray(offre.produits) ? offre.produits : [],
        actif: !offre.actif,
      });
      notifier(offre.actif ? 'Offre masquée aux clients.' : 'Offre visible par les clients.');
    } catch (err) {
      setOffres(liste => liste.map(o => o.id === offre.id ? { ...o, actif: offre.actif } : o));
      notifier(err.response?.data?.erreur || 'Erreur lors de la mise à jour du statut.', 'erreur');
    }
  };

  const handleMarquerRetiree = async (resa) => {
    const ok = await confirmer({
      icone: ShoppingBag, bouton: 'Confirmer le retrait',
      titre: 'Le client a retiré son panier ?',
      texte: `${resa.utilisateur?.prenom || ''} ${resa.utilisateur?.nom || ''} — ${resa.offre?.titre || ''}`,
    });
    if (!ok) return;
    try {
      await marquerReservationRetiree(resa.id);
      notifier('Retrait validé.');
      chargerDonnees();
    } catch {
      notifier('Erreur lors de la mise à jour.', 'erreur');
    }
  };

  const rechercherParNumero = () => {
    setErreurRecherche('');
    setResaTrouvee(null);
    const terme = numeroRecherche.trim().toLowerCase();
    if (!terme) { setErreurRecherche('Saisis un numéro de réservation.'); return; }
    const trouve = reservations.find(r => r.numero?.toLowerCase() === terme);
    if (!trouve) { setErreurRecherche('Aucune réservation trouvée avec ce numéro.'); return; }
    if (trouve.statut !== 'confirmee') { setErreurRecherche(`Cette réservation est déjà « ${STATUTS[trouve.statut]?.label} ».`); return; }
    setResaTrouvee(trouve);
  };

  const validerRetrait = async () => {
    if (!resaTrouvee) return;
    setValidationEnCours(true);
    try {
      await marquerReservationRetiree(resaTrouvee.id);
      fermerModalValidation();
      notifier(`Retrait validé pour ${resaTrouvee.utilisateur?.prenom || 'le client'}.`);
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

  const handleFormulaireTermine = () => {
    notifier(offreAModifier ? 'Offre mise à jour.' : 'Offre publiée ! Les clients sont notifiés.');
    setAfficherFormulaire(false);
    setOffreAModifier(null);
    chargerDonnees();
  };

  // Fermeture de la fenêtre de retrait avec Échap
  useEffect(() => {
    if (!modalValidation) return;
    const surTouche = (e) => {
      if (e.key !== 'Escape') return;
      setModalValidation(false); setNumeroRecherche(''); setResaTrouvee(null); setErreurRecherche('');
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [modalValidation]);

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
  const valides        = reservations.filter(r => r.statut !== 'annulee');
  const nbDisponibles  = offres.filter(o => o.actif && o.quantiteDisponible > 0).length;
  const nbReserve      = reservations.filter(r => r.statut === 'confirmee').length;
  const gainTotal      = valides.reduce((s, r) => s + (r.prixPaye || 0), 0);

  const comptesStatuts = {
    confirmee: reservations.filter(r => r.statut === 'confirmee').length,
    retiree:   reservations.filter(r => r.statut === 'retiree').length,
    annulee:   reservations.filter(r => r.statut === 'annulee').length,
  };

  const tauxRecuperation = valides.length > 0 ? Math.round((comptesStatuts.retiree / valides.length) * 100) : 0;

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

  // Paniers réservés (non annulés) par offre → jauge de stock
  const reservesParOffre = {};
  valides.forEach(r => { reservesParOffre[r.offreId] = (reservesParOffre[r.offreId] || 0) + 1; });

  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
  const gainCeMois = valides.filter(r => new Date(r.createdAt) >= debutMois).reduce((s, r) => s + (r.prixPaye || 0), 0);

  const ilYa = (jours) => { const d = new Date(); d.setDate(d.getDate() - jours); return d; };
  const gainCetteSemaine = valides.filter(r => new Date(r.createdAt) >= ilYa(7)).reduce((s, r) => s + (r.prixPaye || 0), 0);
  const resas7j     = reservations.filter(r => new Date(r.createdAt) >= ilYa(7)).length;
  const resas7jAvant = reservations.filter(r => { const d = new Date(r.createdAt); return d >= ilYa(14) && d < ilYa(7); }).length;
  const ecart7j = resas7j - resas7jAvant;

  // Séries par jour (14 jours) pour les sparklines des cartes KPI
  const jours14 = getDerniersjours(14);
  const serieRevenus14 = jours14.map(j => valides.filter(r => memeJour(r.createdAt, j)).reduce((s, r) => s + (r.prixPaye || 0), 0));
  const serieResas14   = jours14.map(j => reservations.filter(r => memeJour(r.createdAt, j)).length);

  const nbJoursGraph = periodeGraph === '30j' ? 30 : 7;
  const pointsGraph  = getDerniersjours(nbJoursGraph).map(jour => ({
    label: jour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    labelCourt: nbJoursGraph === 7
      ? jour.toLocaleDateString('fr-FR', { weekday: 'short' })
      : jour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    valeur: reservations.filter(r => memeJour(r.createdAt, jour)).length,
  }));
  const totalPeriodeGraph = pointsGraph.reduce((s, p) => s + p.valeur, 0);

  const panierMoyen = valides.length > 0 ? gainTotal / valides.length : 0;

  const nbOffresPerimees = offres.filter(o => o.actif && joursAvant(o.datePeremption) !== null && joursAvant(o.datePeremption) < 0).length;

  const tauxAnnulation = reservations.length > 0
    ? Math.round((comptesStatuts.annulee / reservations.length) * 100)
    : 0;

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
    notifier('Export PDF téléchargé.');
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
    notifier('Export CSV téléchargé.');
  };

  // -------------------------------------------------------
  // Garde — compte non lié
  // -------------------------------------------------------
  if (!pharmacieId) {
    return (
      <div className="tc-login-formulaire" style={{ minHeight: '100vh' }}>
        <div className="tc-modale" style={{ textAlign: 'center' }}>
          <div className="tc-modale-icone danger" style={{ margin: '0 auto 12px' }}><LienIcone size={22} /></div>
          <h2 className="tc-modale-titre">Compte non lié à une pharmacie</h2>
          <p className="tc-modale-texte">Contactez un administrateur pour associer votre compte.</p>
          <button onClick={seDeconnecter} className="tc-btn tc-btn-primaire" style={{ marginTop: 20 }}>Se déconnecter</button>
        </div>
      </div>
    );
  }

  const heure = new Date().getHours();
  const salutation = heure < 5 || heure >= 18 ? 'Bonsoir' : 'Bonjour';
  const titreOnglet = [...ONGLETS, ONGLET_REGLAGES].find(o => o.id === onglet)?.label;

  // -------------------------------------------------------
  // Rendu
  // -------------------------------------------------------
  return (
    <div className={`tc-app ${menuOuvert ? 'menu-ouvert' : ''}`}>

      {/* ══════════ MODAL VALIDATION PAR NUMÉRO ══════════ */}
      {modalValidation && (
        <div className="tc-overlay" onClick={fermerModalValidation}>
          <div className="tc-modale" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="tc-modale-entete">
              <div>
                <div className="tc-modale-icone"><ShoppingBag size={22} /></div>
                <h2 className="tc-modale-titre">Valider un retrait</h2>
                <p className="tc-modale-texte">Saisis le numéro affiché sous le QR code du client.</p>
              </div>
              <button className="tc-fermer" onClick={fermerModalValidation} aria-label="Fermer"><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input
                className="tc-champ mono"
                placeholder="TCP-1234567890-ABC123"
                value={numeroRecherche}
                onChange={e => { setNumeroRecherche(e.target.value); setErreurRecherche(''); setResaTrouvee(null); }}
                onKeyDown={e => e.key === 'Enter' && rechercherParNumero()}
                autoFocus
              />
              <button className="tc-btn tc-btn-primaire" onClick={rechercherParNumero}>Rechercher</button>
            </div>

            {erreurRecherche && <div className="tc-alerte erreur"><AlertTriangle size={16} /> {erreurRecherche}</div>}

            {resaTrouvee && (
              <div className="tc-resa-trouvee">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div className="tc-client">
                    <div className="tc-client-avatar" style={{ width: 42, height: 42, fontSize: 14 }}>
                      {initiales(resaTrouvee.utilisateur?.prenom, resaTrouvee.utilisateur?.nom)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{resaTrouvee.utilisateur?.prenom} {resaTrouvee.utilisateur?.nom}</div>
                      <div style={{ fontSize: 13, color: 'var(--encre-2)' }}>{resaTrouvee.offre?.titre}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--vert-700)' }}>{formaterEuros(resaTrouvee.prixPaye)}</div>
                </div>
                <button className="tc-btn tc-btn-primaire tc-btn-large" onClick={validerRetrait} disabled={validationEnCours}>
                  {validationEnCours ? <Loader2 size={17} className="tc-tourne" /> : <Check size={17} />} Confirmer le retrait
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ FORMULAIRE OFFRE (panneau latéral) ══════════ */}
      {afficherFormulaire && (
        <FormulaireOffre
          pharmacieId={pharmacieId}
          offre={offreAModifier}
          onTermine={handleFormulaireTermine}
          onAnnuler={() => { setAfficherFormulaire(false); setOffreAModifier(null); }}
        />
      )}

      {/* ══════════ SIDEBAR ══════════ */}
      <div className="tc-sidebar-fond" onClick={() => setMenuOuvert(false)} />
      <aside className="tc-sidebar">
        <div className="tc-logo">
          <div className="tc-logo-icone"><Leaf size={20} strokeWidth={2.25} /></div>
          <div>
            <div className="tc-logo-nom">Take & Care</div>
            <div className="tc-logo-sous">Espace pharmacie</div>
          </div>
        </div>

        <button className="tc-bouton-retrait" onClick={() => { setModalValidation(true); setMenuOuvert(false); }}>
          <ShoppingBag size={17} /> Valider un retrait
        </button>

        <nav className="tc-nav">
          <div className="tc-nav-titre">Gestion</div>
          {ONGLETS.map(item => (
            <LienNav key={item.id} item={item} actif={onglet === item.id} onClick={() => changerOnglet(item.id)}>
              {item.id === 'reservations' && nbReserve > 0 && (
                <span className="tc-nav-badge" title={`${nbReserve} panier(s) à retirer`}>{nbReserve}</span>
              )}
            </LienNav>
          ))}
          <div className="tc-nav-titre" style={{ marginTop: 14 }}>Compte</div>
          <LienNav item={ONGLET_REGLAGES} actif={onglet === 'reglages'} onClick={() => ouvrirReglages('profil')} />
        </nav>

        <div className="tc-profil">
          <div className="tc-avatar">{initiales(pharmacien?.prenom, pharmacien?.nom)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="tc-profil-nom">{pharmacien?.prenom} {pharmacien?.nom}</div>
            <div className="tc-profil-actions">
              <button className="tc-lien-discret" onClick={() => ouvrirReglages('profil')}>Mon profil</button>
              <button className="tc-lien-discret danger" onClick={seDeconnecter}>Déconnexion</button>
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════ CONTENU PRINCIPAL ══════════ */}
      <main className="tc-main">

        <header className="tc-entete">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="tc-burger" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu"><Menu size={19} /></button>
            <div>
              <h1 className="tc-salutation">
                {onglet === 'offres' ? `${salutation} ${pharmacien?.prenom || ''}` : titreOnglet}
              </h1>
              <p className="tc-date">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {nbReserve > 0 && ` · ${nbReserve} panier${nbReserve > 1 ? 's' : ''} à retirer aujourd'hui`}
              </p>
            </div>
          </div>
          <div className="tc-entete-actions">
            {derniereMAJ && (
              <span className="tc-maj">Mis à jour à {derniereMAJ.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            <button className="tc-btn tc-btn-secondaire tc-btn-icone" onClick={chargerDonnees} disabled={chargement} aria-label="Rafraîchir" title="Rafraîchir">
              <RefreshCw size={16} className={chargement ? 'tc-tourne' : ''} />
            </button>
            <button className="tc-btn tc-btn-primaire" onClick={() => { setOffreAModifier(null); setAfficherFormulaire(true); }}>
              <Plus size={17} strokeWidth={2.5} /> Nouvelle offre
            </button>
          </div>
        </header>

        {/* ── PHARMACIE EN ATTENTE DE VALIDATION ── */}
        {pharmacien?.pharmacieValidee === false && (
          <div className="tc-alerte attention tc-apparait" style={{ marginBottom: 20 }}>
            <Hourglass size={17} />
            <span>
              <strong>Pharmacie en attente de validation.</strong> Notre équipe vérifie ton officine :
              tu pourras publier des offres et recevoir des paiements dès qu'elle sera validée.
            </span>
          </div>
        )}

        {/* ── KPI ── */}
        {onglet !== 'reglages' && (
          premierChargement ? (
            <div className="tc-kpis">{[0, 1, 2, 3].map(i => <Squelette key={i} hauteur={138} />)}</div>
          ) : (
            <div className="tc-kpis">
              <div className="tc-kpi vedette tc-apparait">
                <div className="tc-kpi-haut">
                  <span className="tc-kpi-label">Revenus générés</span>
                  <span className="tc-kpi-icone"><Euro size={17} /></span>
                </div>
                <div className="tc-kpi-valeur"><NombreAnime valeur={gainTotal} format={v => formaterEuros(v, 0)} /></div>
                <div className="tc-kpi-detail">{formaterEuros(gainCeMois, 0)} ce mois-ci</div>
                <Sparkline valeurs={serieRevenus14} clair />
              </div>

              <div className="tc-kpi tc-apparait" style={{ animationDelay: '60ms' }}>
                <div className="tc-kpi-haut">
                  <span className="tc-kpi-label">À retirer</span>
                  <span className="tc-kpi-icone" style={{ background: 'var(--statut-attente-fond)', color: 'var(--texte-attente)' }}><Hourglass size={17} /></span>
                </div>
                <div className="tc-kpi-valeur"><NombreAnime valeur={nbReserve} /></div>
                <div className="tc-kpi-detail">{nbReserve > 0 ? 'paniers attendus en officine' : 'aucun panier en attente'}</div>
                <button className="tc-btn tc-btn-fantome tc-btn-petit" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => { setFiltreStatutResa('confirmee'); changerOnglet('reservations'); }}>
                  Voir la liste →
                </button>
              </div>

              <div className="tc-kpi tc-apparait" style={{ animationDelay: '120ms' }}>
                <div className="tc-kpi-haut">
                  <span className="tc-kpi-label">Offres en ligne</span>
                  <span className="tc-kpi-icone"><Package size={17} /></span>
                </div>
                <div className="tc-kpi-valeur">
                  <NombreAnime valeur={nbDisponibles} />
                  <span style={{ fontSize: 16, color: 'var(--encre-3)', fontWeight: 600 }}> / {offres.length}</span>
                </div>
                <div className="tc-kpi-detail">disponibles à la réservation</div>
                <div className="tc-jauge" style={{ marginTop: 14 }}>
                  <div style={{ width: `${offres.length ? (nbDisponibles / offres.length) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="tc-kpi tc-apparait" style={{ animationDelay: '180ms' }}>
                <div className="tc-kpi-haut">
                  <span className="tc-kpi-label">Réservations · 7 jours</span>
                  <span className="tc-kpi-icone"><Ticket size={17} /></span>
                </div>
                <div className="tc-kpi-valeur"><NombreAnime valeur={resas7j} /></div>
                <div className="tc-kpi-detail">
                  {ecart7j === 0 ? 'stable' : `${ecart7j > 0 ? '▲ +' : '▼ '}${ecart7j}`} vs 7 jours précédents
                </div>
                <Sparkline valeurs={serieResas14} />
              </div>
            </div>
          )
        )}

        {/* ════════════════════════════
            ONGLET OFFRES
        ════════════════════════════ */}
        {onglet === 'offres' && (
          <section className="tc-apparait">
            <div className="tc-section-entete">
              <div>
                <h2 className="tc-titre-section">Mes offres</h2>
                <p className="tc-sous-titre-section">{offres.length} panier{offres.length > 1 ? 's' : ''} · {nbDisponibles} en ligne</p>
              </div>
            </div>

            <div className="tc-outils">
              <div className="tc-recherche">
                <Search size={16} />
                <input placeholder="Rechercher une offre…" value={rechercheOffre} onChange={e => setRechercheOffre(e.target.value)} />
              </div>
              <div className="tc-segments" role="group" aria-label="Filtrer par statut">
                {[['tous', 'Toutes'], ['active', 'Actives'], ['inactive', 'Masquées']].map(([v, l]) => (
                  <button key={v} className={`tc-segment ${filtreStatutOffre === v ? 'actif' : ''}`} onClick={() => setFiltreStatutOffre(v)}>{l}</button>
                ))}
              </div>
              <div className="tc-segments" role="group" aria-label="Affichage">
                <button className={`tc-segment ${vueOffres === 'grille' ? 'actif' : ''}`} onClick={() => setVueOffres('grille')} title="Cartes" aria-label="Cartes"><LayoutGrid size={15} /></button>
                <button className={`tc-segment ${vueOffres === 'liste' ? 'actif' : ''}`} onClick={() => setVueOffres('liste')} title="Liste" aria-label="Liste"><List size={15} /></button>
              </div>
            </div>

            {premierChargement ? (
              <div className="tc-offres-grille">{[0, 1, 2, 3].map(i => <Squelette key={i} hauteur={330} />)}</div>
            ) : offres.length === 0 ? (
              <Vide
                icone={ShoppingBasket}
                titre="Aucune offre pour le moment"
                texte="Publie ton premier panier : les clients à proximité seront notifiés."
                action={<button className="tc-btn tc-btn-primaire" onClick={() => setAfficherFormulaire(true)}><Plus size={16} /> Créer une offre</button>}
              />
            ) : offresFiltrees.length === 0 ? (
              <Vide icone={Search} titre="Aucun résultat" texte="Aucune offre ne correspond à ta recherche." />
            ) : vueOffres === 'grille' ? (
              <div className="tc-offres-grille">
                {offresFiltrees.map((offre, i) => (
                  <CarteOffre
                    key={offre.id}
                    offre={offre}
                    reserves={reservesParOffre[offre.id] || 0}
                    delai={i * 40}
                    onToggle={() => handleToggleActif(offre)}
                    onModifier={() => handleModifier(offre)}
                    onSupprimer={() => handleSupprimer(offre)}
                  />
                ))}
              </div>
            ) : (
              <div className="tc-tableau-conteneur">
                <table className="tc-tableau">
                  <thead>
                    <tr>
                      <th>Offre</th>
                      <th>Catégorie</th>
                      <th className="nombre">Prix</th>
                      <th className="nombre">Stock</th>
                      <th>Visibilité</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offresFiltrees.map(offre => (
                      <tr key={offre.id}>
                        <td style={{ fontWeight: 600 }}>{offre.titre}</td>
                        <td><span className="tc-tag"><IconeCategorie categorie={offre.categorie} /> {CATEGORIES[offre.categorie]?.label || offre.categorie}</span></td>
                        <td className="nombre"><strong style={{ color: 'var(--vert-700)' }}>{formaterEuros(offre.prixReduit)}</strong></td>
                        <td className="nombre" style={{ fontWeight: 700, color: offre.quantiteDisponible === 0 ? 'var(--texte-annule)' : undefined }}>{offre.quantiteDisponible}</td>
                        <td><Interrupteur actif={offre.actif} onClick={() => handleToggleActif(offre)} /></td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="tc-btn tc-btn-fantome tc-btn-petit" onClick={() => handleModifier(offre)}><Pencil size={14} /> Modifier</button>
                          <button className="tc-btn tc-btn-fantome tc-btn-petit" onClick={() => handleSupprimer(offre)} aria-label="Supprimer"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
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
          <section className="tc-apparait">
            <div className="tc-section-entete">
              <div>
                <h2 className="tc-titre-section">Réservations reçues</h2>
                <p className="tc-sous-titre-section">{reservations.length} au total · {nbReserve} à retirer</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="tc-btn tc-btn-secondaire" onClick={exporterCSV} disabled={resasFiltrees.length === 0}><Download size={15} /> CSV</button>
                <button className="tc-btn tc-btn-secondaire" onClick={exporterPDF} disabled={resasFiltrees.length === 0}><Download size={15} /> PDF</button>
              </div>
            </div>

            <div className="tc-outils">
              <div className="tc-recherche">
                <Search size={16} />
                <input placeholder="N°, offre ou client…" value={rechercheResa} onChange={e => setRechercheResa(e.target.value)} />
              </div>
              <div className="tc-segments" role="group" aria-label="Filtrer par statut">
                {[['tous', 'Toutes'], ['confirmee', 'À retirer'], ['retiree', 'Retirées'], ['annulee', 'Annulées']].map(([v, l]) => (
                  <button key={v} className={`tc-segment ${filtreStatutResa === v ? 'actif' : ''}`} onClick={() => setFiltreStatutResa(v)}>
                    {l}{v !== 'tous' && <span style={{ opacity: 0.6 }}> {comptesStatuts[v]}</span>}
                  </button>
                ))}
              </div>
              <div className="tc-segments" role="group" aria-label="Période">
                {[['tout', 'Tout'], ['auj', "Aujourd'hui"], ['semaine', '7 j'], ['mois', 'Ce mois']].map(([v, l]) => (
                  <button key={v} className={`tc-segment ${filtrePeriode === v ? 'actif' : ''}`} onClick={() => setFiltrePeriode(v)}>{l}</button>
                ))}
              </div>
            </div>

            {premierChargement ? (
              <Squelette hauteur={320} />
            ) : reservations.length === 0 ? (
              <Vide icone={Ticket} titre="Aucune réservation pour le moment" texte="Elles apparaîtront ici dès qu'un client réservera un panier." />
            ) : resasFiltrees.length === 0 ? (
              <Vide icone={Search} titre="Aucun résultat" texte="Aucune réservation ne correspond aux filtres." />
            ) : (
              <div className="tc-tableau-conteneur">
                <table className="tc-tableau">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Offre</th>
                      <th>N° réservation</th>
                      <th>Date</th>
                      <th className="nombre">Prix payé</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resasFiltrees.map(resa => (
                      <tr key={resa.id}>
                        <td>
                          <div className="tc-client">
                            <div className="tc-client-avatar">{initiales(resa.utilisateur?.prenom, resa.utilisateur?.nom)}</div>
                            <span style={{ fontWeight: 600 }}>{resa.utilisateur?.prenom} {resa.utilisateur?.nom}</span>
                          </div>
                        </td>
                        <td>{resa.offre?.titre || '—'}</td>
                        <td className="tc-mono">{resa.numero}</td>
                        <td style={{ color: 'var(--encre-3)', whiteSpace: 'nowrap' }}>
                          {new Date(resa.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {' · '}
                          {new Date(resa.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="nombre"><strong>{formaterEuros(resa.prixPaye)}</strong></td>
                        <td><Pastille statut={resa.statut} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {resa.statut === 'confirmee' && (
                            <button className="tc-btn tc-btn-secondaire tc-btn-petit" onClick={() => handleMarquerRetiree(resa)}><Check size={14} /> Retiré</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="tc-tableau-pied">
                  <span>{resasFiltrees.length} réservation{resasFiltrees.length > 1 ? 's' : ''}</span>
                  <span>Total (hors annulées) : <strong>{formaterEuros(resasFiltrees.filter(r => r.statut !== 'annulee').reduce((s, r) => s + (r.prixPaye || 0), 0))}</strong></span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ════════════════════════════
            ONGLET MA PHARMACIE
        ════════════════════════════ */}
        {onglet === 'reglages' && (
          <Reglages
            section={sectionReglages}
            onSection={setSectionReglages}
            pharmacie={pharmacieData}
            onPharmacieMiseAJour={(p) => setPharmacieData(p)}
          />
        )}

        {/* ════════════════════════════
            ONGLET PAIEMENTS
        ════════════════════════════ */}
        {onglet === 'paiements' && (
          <section className="tc-apparait">
            <div className="tc-carte" style={{ marginBottom: 18 }}>
              <div className="tc-carte-entete" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div className="tc-stat-icone"><CreditCard size={20} /></div>
                  <div>
                    <h3 className="tc-carte-titre">Compte de paiement Stripe</h3>
                    {!stripeStatut ? (
                      <p className="tc-carte-sous-titre">Vérification…</p>
                    ) : stripeStatut.connecte ? (
                      <p className="tc-carte-sous-titre">
                        <span className="tc-pastille retiree" style={{ marginRight: 8 }}><span className="tc-pastille-point" />Actif</span>
                        Paiements et virements activés · <span className="tc-mono">{stripeStatut.stripeAccountId}</span>
                      </p>
                    ) : (
                      <p className="tc-carte-sous-titre">
                        <span className="tc-pastille confirmee" style={{ marginRight: 8 }}><span className="tc-pastille-point" />À configurer</span>
                        Connecte un compte bancaire pour recevoir tes revenus (≈ 5 minutes).
                      </p>
                    )}
                  </div>
                </div>
                {stripeStatut && !stripeStatut.connecte && (
                  <button
                    className="tc-btn tc-btn-primaire"
                    disabled={stripeChargement}
                    onClick={async () => {
                      setStripeChargement(true);
                      try {
                        const data = await demarrerOnboardingStripe();
                        window.open(data.url, '_blank');
                      } catch (err) {
                        notifier(err.response?.data?.erreur || 'Erreur lors de la connexion Stripe.', 'erreur');
                      } finally {
                        setStripeChargement(false);
                      }
                    }}
                  >
                    {stripeChargement ? <Loader2 size={16} className="tc-tourne" /> : <LienIcone size={16} />} Connecter mon compte
                  </button>
                )}
              </div>
            </div>

            <div className="tc-grille-3">
              <CarteStat icone={Wallet} valeur={formaterEuros(gainTotal)} label="Revenus bruts" detail="hors annulations" />
              <CarteStat icone={Receipt} valeur={formaterEuros(gainTotal * (1 - COMMISSION))} label="Revenus nets" detail={`après commission ${COMMISSION * 100} %`} />
              <CarteStat icone={Landmark} valeur={formaterEuros(gainTotal * COMMISSION)} label="Commission plateforme" detail={`${COMMISSION * 100} % par transaction`} />
            </div>

            <div className="tc-carte" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="tc-carte-entete" style={{ padding: '20px 22px 0' }}>
                <div>
                  <h3 className="tc-carte-titre">Historique des transactions</h3>
                  <p className="tc-carte-sous-titre">20 dernières, hors annulations</p>
                </div>
              </div>
              {valides.length === 0 ? (
                <div style={{ padding: '0 22px 22px', color: 'var(--encre-3)', fontSize: 14 }}>Aucune transaction pour l'instant.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tc-tableau">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Offre</th>
                        <th className="nombre">Brut</th>
                        <th className="nombre">Commission</th>
                        <th className="nombre">Net perçu</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valides.slice(0, 20).map(r => {
                        const brut = r.prixPaye || 0;
                        return (
                          <tr key={r.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                            <td>{r.utilisateur?.prenom} {r.utilisateur?.nom}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.offre?.titre}</td>
                            <td className="nombre">{formaterEuros(brut)}</td>
                            <td className="nombre" style={{ color: 'var(--encre-3)' }}>−{formaterEuros(brut * COMMISSION)}</td>
                            <td className="nombre" style={{ fontWeight: 800 }}>{formaterEuros(brut * (1 - COMMISSION))}</td>
                            <td><Pastille statut={r.statut} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ════════════════════════════
            ONGLET STATISTIQUES
        ════════════════════════════ */}
        {onglet === 'stats' && (
          <section className="tc-apparait">
            <div className="tc-grille-3">
              <CarteStat icone={TrendingUp} valeur={`${tauxRecuperation} %`} label="Taux de récupération" detail="paniers retirés / non annulés" />
              <CarteStat icone={ShoppingBasket} valeur={formaterEuros(panierMoyen)} label="Panier moyen" detail="revenu moyen par réservation" />
              <CarteStat
                icone={Star}
                valeur={pharmacieData?.note > 0 ? `${Number(pharmacieData.note).toFixed(1)} / 5` : '—'}
                label="Note moyenne"
                detail={pharmacieData?.note > 0
                  ? <Etoiles note={pharmacieData.note} />
                  : 'pas encore d\'avis'}
              />
              <CarteStat icone={CalendarDays} valeur={formaterEuros(gainCetteSemaine, 0)} label="Revenus · 7 jours" detail="7 derniers jours" />
              <CarteStat icone={Calendar} valeur={formaterEuros(gainCeMois, 0)} label="Revenus · ce mois" detail={new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} />
              <CarteStat
                icone={Ban}
                valeur={`${tauxAnnulation} %`}
                label="Taux d'annulation"
                detail={`${comptesStatuts.annulee} sur ${reservations.length} réservation${reservations.length > 1 ? 's' : ''}`}
              />
            </div>

            <div className="tc-grille-2">
              <div className="tc-carte">
                <div className="tc-carte-entete">
                  <div>
                    <h3 className="tc-carte-titre">Réservations par jour</h3>
                    <p className="tc-carte-sous-titre">{totalPeriodeGraph} sur les {nbJoursGraph} derniers jours</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="tc-segments" role="group" aria-label="Période du graphique">
                      {['7j', '30j'].map(p => (
                        <button key={p} className={`tc-segment ${periodeGraph === p ? 'actif' : ''}`} onClick={() => setPeriodeGraph(p)}>
                          {p === '7j' ? '7 jours' : '30 jours'}
                        </button>
                      ))}
                    </div>
                    <button className="tc-btn tc-btn-secondaire tc-btn-petit" onClick={() => setVueTableauGraph(v => !v)} title="Basculer graphique / tableau">
                      {vueTableauGraph ? <TrendingUp size={15} /> : <List size={15} />}
                    </button>
                  </div>
                </div>
                {vueTableauGraph ? (
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    <table className="tc-tableau">
                      <thead><tr><th>Jour</th><th className="nombre">Réservations</th></tr></thead>
                      <tbody>
                        {[...pointsGraph].reverse().map(p => (
                          <tr key={p.label}><td style={{ textTransform: 'capitalize' }}>{p.label}</td><td className="nombre">{p.valeur}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <GraphiqueAire points={pointsGraph} enRecharge={chargement && !premierChargement} />
                )}
              </div>

              <div className="tc-carte">
                <div className="tc-carte-entete">
                  <div>
                    <h3 className="tc-carte-titre">Répartition des statuts</h3>
                    <p className="tc-carte-sous-titre">{reservations.length} réservation{reservations.length > 1 ? 's' : ''} au total</p>
                  </div>
                </div>
                {reservations.length === 0 ? (
                  <p style={{ color: 'var(--encre-3)', fontSize: 14 }}>Aucune réservation pour l'instant.</p>
                ) : (
                  <RepartitionStatuts comptes={comptesStatuts} />
                )}
                {nbOffresPerimees > 0 && (
                  <div className="tc-alerte attention" style={{ marginTop: 18 }}>
                    <AlertTriangle size={16} />
                    <span>
                      <strong>{nbOffresPerimees} offre{nbOffresPerimees > 1 ? 's' : ''} périmée{nbOffresPerimees > 1 ? 's' : ''} encore active{nbOffresPerimees > 1 ? 's' : ''}.</strong>{' '}
                      <button className="tc-lien-discret" style={{ color: 'inherit', textDecoration: 'underline' }} onClick={() => changerOnglet('offres')}>Les gérer</button>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="tc-carte">
              <div className="tc-carte-entete">
                <div>
                  <h3 className="tc-carte-titre">Top offres</h3>
                  <p className="tc-carte-sous-titre">Classées par nombre de réservations</p>
                </div>
              </div>
              {topOffres.length === 0 ? (
                <p style={{ color: 'var(--encre-3)', fontSize: 14 }}>Aucune donnée disponible.</p>
              ) : (
                <BarresHorizontales
                  lignes={topOffres.map(o => ({ titre: o.titre, valeur: o.count, detail: `${formaterEuros(o.revenu)} générés` }))}
                  formatValeur={v => `${v} résa${v > 1 ? 's' : ''}`}
                />
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

// -------------------------------------------------------
// Composants de la page
// -------------------------------------------------------
function Interrupteur({ actif, onClick }) {
  return (
    <button
      className={`tc-switch ${actif ? 'on' : ''}`}
      onClick={onClick}
      role="switch"
      aria-checked={actif}
      title={actif ? 'Visible par les clients — cliquer pour masquer' : 'Masquée — cliquer pour publier'}
    >
      <span className="tc-switch-piste" />
      {actif ? 'En ligne' : 'Masquée'}
    </button>
  );
}

function LienNav({ item, actif, onClick, children }) {
  const Icone = item.icone;
  return (
    <button className={`tc-nav-lien ${actif ? 'actif' : ''}`} onClick={onClick} aria-current={actif ? 'page' : undefined}>
      <span className="tc-nav-icone"><Icone size={18} strokeWidth={2} /></span>
      {item.label}
      {children}
    </button>
  );
}

function Etoiles({ note }) {
  const pleines = Math.round(note);
  return (
    <span className="tc-etoiles" aria-label={`${note} sur 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={13} strokeWidth={2} fill={n <= pleines ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

function CarteStat({ icone: Icone, valeur, label, detail }) {
  return (
    <div className="tc-stat">
      <div className="tc-stat-icone"><Icone size={20} strokeWidth={2} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="tc-stat-valeur">{valeur}</div>
        <div className="tc-stat-label">{label}</div>
        {detail && <div className="tc-stat-detail">{detail}</div>}
      </div>
    </div>
  );
}

function CarteOffre({ offre, reserves, delai, onToggle, onModifier, onSupprimer }) {
  const [imageCassee, setImageCassee] = useState(false);
  const categorie = CATEGORIES[offre.categorie];
  const remise = offre.prixOriginal > 0 ? Math.round((1 - offre.prixReduit / offre.prixOriginal) * 100) : 0;

  // Stock initial estimé = restant + paniers déjà réservés
  const total = offre.quantiteDisponible + reserves;
  const pctRestant = total > 0 ? (offre.quantiteDisponible / total) * 100 : 0;
  const classeJauge = offre.quantiteDisponible === 0 ? 'vide' : offre.quantiteDisponible <= 1 ? 'bas' : '';

  const jours = joursAvant(offre.datePeremption);
  const peremption = jours === null ? null
    : jours < 0  ? { classe: 'depassee', texte: 'Date dépassée' }
    : jours === 0 ? { classe: 'proche', texte: 'Périme aujourd\'hui' }
    : jours <= 30 ? { classe: 'proche', texte: `Périme dans ${jours} j` }
    : { classe: '', texte: `Périme le ${new Date(offre.datePeremption).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` };

  return (
    <article className={`tc-offre tc-apparait ${offre.actif ? '' : 'inactive'}`} style={{ animationDelay: `${Math.min(delai, 400)}ms` }}>
      <div className="tc-offre-image">
        {offre.image && !imageCassee
          ? <img src={offre.image} alt="" loading="lazy" onError={() => setImageCassee(true)} />
          : <IconeCategorie categorie={offre.categorie} size={40} />}
        {remise > 0 && <span className="tc-offre-remise">−{remise} %</span>}
        {categorie && <span className="tc-offre-categorie"><IconeCategorie categorie={offre.categorie} size={12} /> {categorie.label}</span>}
      </div>

      <div className="tc-offre-corps">
        <h3 className="tc-offre-titre">{offre.titre}</h3>
        <div className="tc-offre-prix">
          <strong>{formaterEuros(offre.prixReduit)}</strong>
          {offre.prixOriginal > offre.prixReduit && <s>{formaterEuros(offre.prixOriginal)}</s>}
        </div>

        <div className="tc-stock">
          <div className="tc-stock-ligne">
            <span><strong>{offre.quantiteDisponible}</strong> restant{offre.quantiteDisponible > 1 ? 's' : ''}</span>
            <span>{reserves} réservé{reserves > 1 ? 's' : ''}</span>
          </div>
          <div className={`tc-jauge ${classeJauge}`}><div style={{ width: `${pctRestant}%` }} /></div>
        </div>

        {(peremption || offre.heureRetrait) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {peremption && <span className={`tc-peremption ${peremption.classe}`}><CalendarClock size={13} /> {peremption.texte}</span>}
            {offre.heureRetrait && <span className="tc-peremption"><Clock size={13} /> Retrait {offre.heureRetrait}</span>}
          </div>
        )}
      </div>

      <div className="tc-offre-pied">
        <Interrupteur actif={offre.actif} onClick={onToggle} />
        <div className="tc-offre-actions">
          <button className="tc-btn tc-btn-fantome tc-btn-icone" onClick={onModifier} aria-label="Modifier" title="Modifier"><Pencil size={16} /></button>
          <button className="tc-btn tc-btn-fantome tc-btn-icone" onClick={onSupprimer} aria-label="Supprimer" title="Supprimer"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  );
}
