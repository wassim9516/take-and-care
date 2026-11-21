// ============================================================
// src/pages/Administration.js — Espace équipe Take & Care
// ============================================================
// Visible uniquement pour les comptes administrateurs
// (npm run admin -- <email> dans le backend).
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  Leaf, ShieldCheck, Hourglass, Store, List, Menu, RefreshCw, MapPin, Phone, Mail,
  Clock, Check, Ban, Users, Package, Ticket, Euro, Landmark, ExternalLink, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPharmaciesAdmin, changerValidationPharmacie, getStatsAdmin } from '../api/client';
import { useRetours, Vide, Squelette, formaterEuros, NombreAnime } from '../components/ui';

const ONGLETS = [
  { id: 'attente', label: 'En attente', icone: Hourglass },
  { id: 'validees', label: 'Validées', icone: Store },
  { id: 'toutes', label: 'Toutes', icone: List },
];

const initiales = (prenom, nom) => `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase() || '?';

export default function Administration({ onEspacePharmacie }) {
  const { pharmacien, seDeconnecter } = useAuth();
  const { notifier, confirmer } = useRetours();
  const [onglet, setOnglet]         = useState('attente');
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [pharmacies, setPharmacies] = useState(null);
  const [stats, setStats]           = useState(null);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours]       = useState(null); // id de la pharmacie en cours de mise à jour

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [liste, chiffres] = await Promise.all([getPharmaciesAdmin(onglet), getStatsAdmin()]);
      setPharmacies(liste);
      setStats(chiffres);
    } catch (err) {
      notifier(err.response?.data?.erreur || 'Chargement impossible.', 'erreur');
    } finally {
      setChargement(false);
    }
  }, [onglet, notifier]);

  useEffect(() => { setPharmacies(null); charger(); }, [charger]);

  const changerValidation = async (pharmacie, valide) => {
    const ok = await confirmer(valide ? {
      icone: ShieldCheck, bouton: 'Valider',
      titre: `Valider ${pharmacie.nom} ?`,
      texte: 'Vérifie d\'abord qu\'il s\'agit d\'une vraie officine (n° FINESS, SIRET, appel au numéro de la pharmacie). Elle pourra publier des offres et le pharmacien sera prévenu par email.',
    } : {
      icone: Ban, danger: true, bouton: 'Suspendre',
      titre: `Suspendre ${pharmacie.nom} ?`,
      texte: 'Ses offres disparaissent immédiatement de l\'application et elle ne peut plus en publier. Le pharmacien est prévenu par email.',
    });
    if (!ok) return;
    setEnCours(pharmacie.id);
    try {
      const { message } = await changerValidationPharmacie(pharmacie.id, valide);
      notifier(message);
      charger();
    } catch (err) {
      notifier(err.response?.data?.erreur || 'Mise à jour impossible.', 'erreur');
    } finally {
      setEnCours(null);
    }
  };

  const ongletActif = ONGLETS.find(o => o.id === onglet);

  return (
    <div className={`tc-app ${menuOuvert ? 'menu-ouvert' : ''}`}>
      <div className="tc-sidebar-fond" onClick={() => setMenuOuvert(false)} />
      <aside className="tc-sidebar">
        <div className="tc-logo">
          <div className="tc-logo-icone"><Leaf size={20} strokeWidth={2.25} /></div>
          <div>
            <div className="tc-logo-nom">Take & Care</div>
            <div className="tc-logo-sous">Administration</div>
          </div>
        </div>

        <nav className="tc-nav">
          <div className="tc-nav-titre">Pharmacies</div>
          {ONGLETS.map(({ id, label, icone: Icone }) => (
            <button
              key={id}
              className={`tc-nav-lien ${onglet === id ? 'actif' : ''}`}
              onClick={() => { setOnglet(id); setMenuOuvert(false); }}
              aria-current={onglet === id ? 'page' : undefined}
            >
              <span className="tc-nav-icone"><Icone size={18} strokeWidth={2} /></span>
              {label}
              {id === 'attente' && stats?.pharmaciesEnAttente > 0 && (
                <span className="tc-nav-badge">{stats.pharmaciesEnAttente}</span>
              )}
            </button>
          ))}
          {onEspacePharmacie && (
            <>
              <div className="tc-nav-titre" style={{ marginTop: 14 }}>Mon officine</div>
              <button className="tc-nav-lien" onClick={onEspacePharmacie}>
                <span className="tc-nav-icone"><LayoutDashboard size={18} strokeWidth={2} /></span>
                Espace pharmacie
              </button>
            </>
          )}
        </nav>

        <div className="tc-profil">
          <div className="tc-avatar">{initiales(pharmacien?.prenom, pharmacien?.nom)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="tc-profil-nom">{pharmacien?.prenom} {pharmacien?.nom}</div>
            <div className="tc-profil-actions">
              <button className="tc-lien-discret danger" onClick={seDeconnecter}>Déconnexion</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="tc-main">
        <header className="tc-entete">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="tc-burger" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu"><Menu size={19} /></button>
            <div>
              <h1 className="tc-salutation">Pharmacies · {ongletActif.label.toLowerCase()}</h1>
              <p className="tc-date">Validation et suivi des officines partenaires</p>
            </div>
          </div>
          <div className="tc-entete-actions">
            <button className="tc-btn tc-btn-secondaire tc-btn-icone" onClick={charger} disabled={chargement} aria-label="Rafraîchir" title="Rafraîchir">
              <RefreshCw size={16} className={chargement ? 'tc-tourne' : ''} />
            </button>
          </div>
        </header>

        {/* ── CHIFFRES CLÉS ── */}
        {stats ? (
          <div className="tc-grille-3" style={{ marginBottom: 24 }}>
            <Stat icone={Users} valeur={<NombreAnime valeur={stats.clients} />} label="Clients" />
            <Stat icone={Store} valeur={<NombreAnime valeur={stats.pharmaciesValidees} />} label="Pharmacies validées" detail={`${stats.pharmaciesEnAttente} en attente`} />
            <Stat icone={Package} valeur={<NombreAnime valeur={stats.offresEnLigne} />} label="Offres en ligne" />
            <Stat
              icone={Ticket}
              valeur={<NombreAnime valeur={Object.values(stats.reservations).reduce((a, b) => a + b, 0)} />}
              label="Réservations"
              detail={`${stats.reservations.retiree || 0} retirées · ${stats.reservations.confirmee || 0} à retirer · ${stats.reservations.expiree || 0} expirées`}
            />
            <Stat icone={Euro} valeur={formaterEuros(stats.volume, 0)} label="Volume des paniers" detail="à retirer et retirés" />
            <Stat icone={Landmark} valeur={formaterEuros(stats.commissions)} label="Commissions" detail="paiements en ligne" />
          </div>
        ) : (
          <Squelette hauteur={180} style={{ marginBottom: 24 }} />
        )}

        {/* ── LISTE DES PHARMACIES ── */}
        {pharmacies === null ? (
          <Squelette hauteur={260} />
        ) : pharmacies.length === 0 ? (
          <Vide
            icone={onglet === 'attente' ? ShieldCheck : Store}
            titre={onglet === 'attente' ? 'Aucune pharmacie en attente' : 'Aucune pharmacie'}
            texte={onglet === 'attente' ? 'Les nouvelles inscriptions apparaîtront ici.' : 'Rien à afficher pour ce filtre.'}
          />
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {pharmacies.map(p => (
              <FichePharmacie
                key={p.id}
                pharmacie={p}
                enCours={enCours === p.id}
                onValider={() => changerValidation(p, true)}
                onSuspendre={() => changerValidation(p, false)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ icone: Icone, valeur, label, detail }) {
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

function FichePharmacie({ pharmacie: p, enCours, onValider, onSuspendre }) {
  const carte = `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=18/${p.latitude}/${p.longitude}`;
  // Recherche de l'établissement dans l'annuaire officiel (FINESS / SIRET)
  const annuaire = `https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(`${p.nom} ${p.adresse}`)}`;

  return (
    <article className="tc-carte">
      <div className="tc-carte-entete" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="tc-carte-titre" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {p.nom}
            {p.valide
              ? <span className="tc-pastille retiree"><span className="tc-pastille-point" />Validée</span>
              : <span className="tc-pastille confirmee"><span className="tc-pastille-point" />En attente</span>}
          </h3>
          <p className="tc-carte-sous-titre">
            #{p.id} · inscrite le {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{p.nbOffres} offre{p.nbOffres > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {p.valide ? (
            <button className="tc-btn tc-btn-secondaire" onClick={onSuspendre} disabled={enCours}>
              <Ban size={16} /> Suspendre
            </button>
          ) : (
            <button className="tc-btn tc-btn-primaire" onClick={onValider} disabled={enCours}>
              <Check size={16} /> Valider
            </button>
          )}
        </div>
      </div>

      <div className="tc-grille-2" style={{ gap: 18 }}>
        <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
          <Ligne icone={MapPin}>{p.adresse}</Ligne>
          {p.telephone && <Ligne icone={Phone}><a href={`tel:${p.telephone}`}>{p.telephone}</a></Ligne>}
          {p.horaires && <Ligne icone={Clock}>{p.horaires}</Ligne>}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
            <a href={carte} target="_blank" rel="noreferrer" className="tc-lien-discret"><ExternalLink size={13} /> Voir sur la carte</a>
            <a href={annuaire} target="_blank" rel="noreferrer" className="tc-lien-discret"><ExternalLink size={13} /> Annuaire des entreprises</a>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {(p.pharmaciens || []).length === 0 && <span className="tc-aide">Aucun compte pharmacien actif.</span>}
          {(p.pharmaciens || []).map(u => (
            <div key={u.id} className="tc-client">
              <div className="tc-client-avatar">{initiales(u.prenom, u.nom)}</div>
              <div style={{ minWidth: 0, fontSize: 14 }}>
                <div style={{ fontWeight: 700 }}>{u.prenom} {u.nom}</div>
                <div style={{ color: 'var(--encre-2)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a href={`mailto:${u.email}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Mail size={13} />{u.email}</a>
                  {u.telephone && <a href={`tel:${u.telephone}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Phone size={13} />{u.telephone}</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function Ligne({ icone: Icone, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.45 }}>
      <Icone size={15} style={{ marginTop: 3, flexShrink: 0, color: 'var(--vert-700)' }} />
      <span>{children}</span>
    </div>
  );
}
