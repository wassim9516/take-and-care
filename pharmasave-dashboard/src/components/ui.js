// ============================================================
// src/components/ui.js — Composants d'interface réutilisables
// ============================================================
// Nombres animés, graphiques SVG (aire, sparkline, barres),
// pastilles de statut, notifications (toasts) et confirmations.
// Les styles sont dans src/styles/theme.css (classes "tc-").
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, Hourglass, X, CheckCircle2, AlertTriangle, HelpCircle, Leaf } from 'lucide-react';

export const COULEUR_SERIE = '#1F8A5B';

// Statuts de réservation : couleur + icône + libellé (jamais la couleur seule)
export const STATUTS = {
  retiree:   { label: 'Retirée',    icone: Check,     couleur: '#0CA30C' },
  confirmee: { label: 'À retirer',  icone: Hourglass, couleur: '#FAB219' },
  annulee:   { label: 'Annulée',    icone: X,         couleur: '#D03B3B' },
};
// Ordre d'affichage : vert et rouge jamais côte à côte (daltonisme)
export const ORDRE_STATUTS = ['retiree', 'confirmee', 'annulee'];

export const formaterEuros = (v, decimales = 2) =>
  `${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} €`;

const reduireAnimations = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// -------------------------------------------------------
// Nombre qui défile jusqu'à sa valeur
// -------------------------------------------------------
export function NombreAnime({ valeur, format = (v) => Math.round(v).toLocaleString('fr-FR'), duree = 700 }) {
  const [affiche, setAffiche] = useState(valeur);
  const precedent = useRef(valeur);

  useEffect(() => {
    const depart = precedent.current;
    precedent.current = valeur;
    if (reduireAnimations() || depart === valeur) { setAffiche(valeur); return; }
    let frame;
    const debut = performance.now();
    const pas = (t) => {
      const p = Math.min((t - debut) / duree, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setAffiche(depart + (valeur - depart) * ease);
      if (p < 1) frame = requestAnimationFrame(pas);
    };
    frame = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(frame);
  }, [valeur, duree]);

  return <>{format(affiche)}</>;
}

// Largeur disponible d'un conteneur (pour des graphiques responsives)
function useLargeur() {
  const ref = useRef(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entree]) => setLargeur(entree.contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, largeur];
}

// Graduation "propre" pour l'axe Y : 0, 2, 4… ou 0, 5, 10…
// entiers = true pour des comptes (pas de « 0,5 réservation »)
function graduations(max, nb = 4, entiers = true) {
  if (max <= 0) return [0, 1];
  const brut = max / nb;
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  let pas = [1, 2, 5, 10].map(m => m * puissance).find(p => p >= brut) || brut;
  if (entiers) pas = Math.max(1, Math.round(pas));
  const haut = Math.ceil(max / pas) * pas;
  const ticks = [];
  for (let v = 0; v <= haut + 1e-9; v += pas) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// -------------------------------------------------------
// Sparkline (tendance dans les cartes KPI)
// -------------------------------------------------------
export function Sparkline({ valeurs, couleur = COULEUR_SERIE, hauteur = 34, clair = false }) {
  const [ref, largeur] = useLargeur();
  const max = Math.max(...valeurs, 1);
  const n = valeurs.length;
  const pts = valeurs.map((v, i) => [
    n > 1 ? (i / (n - 1)) * (largeur - 6) + 3 : largeur / 2,
    hauteur - 3 - (v / max) * (hauteur - 8),
  ]);
  const ligne = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const aire = `${ligne} L${pts[n - 1]?.[0] ?? 0},${hauteur} L${pts[0]?.[0] ?? 0},${hauteur} Z`;
  const trait = clair ? 'rgba(255,255,255,0.9)' : couleur;
  const fin = pts[n - 1];

  return (
    <div ref={ref} className="tc-kpi-sparkline" aria-hidden="true">
      {largeur > 0 && n > 0 && (
        <svg width={largeur} height={hauteur}>
          <path d={aire} fill={trait} opacity={clair ? 0.15 : 0.1} />
          <path d={ligne} fill="none" stroke={trait} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {fin && <circle cx={fin[0]} cy={fin[1]} r="4" fill={trait} stroke={clair ? '#1B4332' : '#fff'} strokeWidth="2" />}
        </svg>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Graphique en aire avec réticule + infobulle
// points : [{ label, labelCourt, valeur }]
// -------------------------------------------------------
export function GraphiqueAire({ points, unite = 'réservation', hauteur = 220, enRecharge = false }) {
  const [ref, largeur] = useLargeur();
  const [survol, setSurvol] = useState(null);

  const marge = { haut: 12, droite: 12, bas: 28, gauche: 34 };
  const lPlot = Math.max(largeur - marge.gauche - marge.droite, 0);
  const hPlot = hauteur - marge.haut - marge.bas;
  const ticks = graduations(Math.max(...points.map(p => p.valeur), 0));
  const maxY = ticks[ticks.length - 1] || 1;
  const n = points.length;

  const x = (i) => marge.gauche + (n > 1 ? (i / (n - 1)) * lPlot : lPlot / 2);
  const y = (v) => marge.haut + hPlot - (v / maxY) * hPlot;

  const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(' ');
  const aire = n ? `${ligne} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';

  // Libellés d'axe X : ~6 maximum
  const pasLabel = Math.max(1, Math.ceil(n / 6));

  const surMouvement = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - marge.gauche;
    const i = Math.round((px / (lPlot || 1)) * (n - 1));
    setSurvol(Math.min(Math.max(i, 0), n - 1));
  };
  const surClavier = (e) => {
    if (e.key === 'ArrowRight') setSurvol(i => Math.min((i ?? -1) + 1, n - 1));
    if (e.key === 'ArrowLeft')  setSurvol(i => Math.max((i ?? n) - 1, 0));
  };

  const pointSurvol = survol !== null ? points[survol] : null;
  const dernier = points[n - 1];

  return (
    <div ref={ref} className={`tc-graph ${enRecharge ? 'recharge' : ''}`} style={{ height: hauteur }}>
      {largeur > 0 && (
        <svg
          width={largeur}
          height={hauteur}
          role="img"
          aria-label={`Évolution des ${unite}s`}
          tabIndex={0}
          onPointerMove={surMouvement}
          onPointerLeave={() => setSurvol(null)}
          onKeyDown={surClavier}
          onBlur={() => setSurvol(null)}
          style={{ outline: 'none', cursor: 'crosshair' }}
        >
          {ticks.map(t => (
            <g key={t}>
              <line className="grille" x1={marge.gauche} x2={marge.gauche + lPlot} y1={y(t)} y2={y(t)} />
              <text className="axe-texte" x={marge.gauche - 8} y={y(t) + 4} textAnchor="end">{t}</text>
            </g>
          ))}
          {points.map((p, i) => (i % pasLabel === 0 || i === n - 1) && (
            <text key={i} className="axe-texte" x={x(i)} y={hauteur - 8} textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
              {p.labelCourt}
            </text>
          ))}

          <path d={aire} fill={COULEUR_SERIE} opacity="0.1" />
          <path d={ligne} fill="none" stroke={COULEUR_SERIE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Libellé direct : seulement la dernière valeur */}
          {dernier && survol === null && (
            <>
              <circle cx={x(n - 1)} cy={y(dernier.valeur)} r="4.5" fill={COULEUR_SERIE} stroke="#fff" strokeWidth="2" />
              <text className="axe-texte" x={x(n - 1) - 8} y={y(dernier.valeur) - 10} textAnchor="end" style={{ fill: '#1A2E1A', fontWeight: 700 }}>
                {dernier.valeur}
              </text>
            </>
          )}

          {pointSurvol && (
            <>
              <line x1={x(survol)} x2={x(survol)} y1={marge.haut} y2={y(0)} stroke="#B9B2A5" strokeWidth="1" />
              <circle cx={x(survol)} cy={y(pointSurvol.valeur)} r="5" fill={COULEUR_SERIE} stroke="#fff" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {pointSurvol && (
        <div className="tc-infobulle" style={{ left: x(survol), top: y(pointSurvol.valeur) }}>
          <div className="tc-infobulle-valeur">
            <span className="tc-infobulle-cle" style={{ background: '#5FD39C' }} />
            {pointSurvol.valeur} {unite}{pointSurvol.valeur > 1 ? 's' : ''}
          </div>
          <div className="tc-infobulle-label">{pointSurvol.label}</div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Barre empilée des statuts + légende (icône, libellé, nombre, %)
// -------------------------------------------------------
export function RepartitionStatuts({ comptes }) {
  const total = ORDRE_STATUTS.reduce((s, k) => s + (comptes[k] || 0), 0);
  const [survol, setSurvol] = useState(null);

  return (
    <div>
      <div className="tc-barre-empilee" style={{ position: 'relative' }}>
        {ORDRE_STATUTS.filter(k => comptes[k] > 0).map(k => (
          <div
            key={k}
            className="tc-barre-segment"
            style={{ width: `${(comptes[k] / total) * 100}%`, background: STATUTS[k].couleur }}
            onPointerEnter={() => setSurvol(k)}
            onPointerLeave={() => setSurvol(null)}
            aria-label={`${STATUTS[k].label} : ${comptes[k]}`}
          />
        ))}
      </div>
      <div className="tc-legende">
        {ORDRE_STATUTS.map(k => {
          const Icone = STATUTS[k].icone;
          return (
          <div key={k} className="tc-legende-ligne" style={{ opacity: survol && survol !== k ? 0.45 : 1, transition: 'opacity 150ms' }}>
            <span className="tc-legende-cle" style={{ background: STATUTS[k].couleur }} />
            <Icone size={14} strokeWidth={2.5} aria-hidden="true" style={{ color: 'var(--encre-3)' }} />
            <span>{STATUTS[k].label}</span>
            <span className="valeur">{comptes[k] || 0}</span>
            <span className="pct">{total ? Math.round(((comptes[k] || 0) / total) * 100) : 0} %</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Barres horizontales (classement)
// lignes : [{ titre, valeur, detail }]
// -------------------------------------------------------
export function BarresHorizontales({ lignes, formatValeur = v => v }) {
  const max = Math.max(...lignes.map(l => l.valeur), 1);
  const [pret, setPret] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setPret(true)); return () => cancelAnimationFrame(t); }, []);

  return (
    <div className="tc-hbarres">
      {lignes.map((l, i) => (
        <div key={l.titre + i} className="tc-hbarre-ligne">
          <span className={`tc-hbarre-rang ${i < 3 ? `podium-${i + 1}` : ''}`}>{i + 1}</span>
          <div>
            <div className="tc-hbarre-titre">
              <span title={l.titre}>{l.titre}</span>
              <span>{l.detail}</span>
            </div>
            <div className="tc-hbarre-piste">
              <div className="tc-hbarre" style={{ width: pret ? `${Math.max((l.valeur / max) * 85, 2)}%` : 0 }} />
              <span className="tc-hbarre-valeur">{formatValeur(l.valeur)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Pastille de statut
// -------------------------------------------------------
export function Pastille({ statut }) {
  const s = STATUTS[statut] || STATUTS.confirmee;
  return (
    <span className={`tc-pastille ${statut}`}>
      <span className="tc-pastille-point" aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function Vide({ icone: Icone = Leaf, titre, texte, action }) {
  return (
    <div className="tc-vide tc-apparait">
      <div className="tc-vide-icone"><Icone size={26} strokeWidth={1.75} /></div>
      <p className="tc-vide-titre">{titre}</p>
      {texte && <p className="tc-vide-texte">{texte}</p>}
      {action}
    </div>
  );
}

export function Squelette({ hauteur = 120, style }) {
  return <div className="tc-squelette" style={{ height: hauteur, ...style }} />;
}

// -------------------------------------------------------
// Notifications (toasts) + confirmations, via un contexte
// -------------------------------------------------------
const RetoursContext = createContext(null);

export function RetoursProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const notifier = useCallback((message, type = 'succes') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  // Remplace window.confirm : renvoie une promesse true/false
  const confirmer = useCallback((options) => new Promise(resolve => {
    setConfirmation({ ...options, resolve });
  }), []);

  const fermer = (reponse) => {
    confirmation?.resolve(reponse);
    setConfirmation(null);
  };

  useEffect(() => {
    if (!confirmation) return;
    const surTouche = (e) => { if (e.key === 'Escape') fermer(false); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  return (
    <RetoursContext.Provider value={{ notifier, confirmer }}>
      {children}

      {confirmation && (
        <div className="tc-overlay" onClick={() => fermer(false)}>
          <div className="tc-modale" role="alertdialog" aria-modal="true" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className={`tc-modale-icone ${confirmation.danger ? 'danger' : ''}`}>
              {React.createElement(confirmation.icone || HelpCircle, { size: 22, strokeWidth: 2 })}
            </div>
            <h2 className="tc-modale-titre">{confirmation.titre}</h2>
            {confirmation.texte && <p className="tc-modale-texte">{confirmation.texte}</p>}
            <div className="tc-modale-boutons">
              <button className="tc-btn tc-btn-secondaire" onClick={() => fermer(false)}>Annuler</button>
              <button
                className={`tc-btn ${confirmation.danger ? 'tc-btn-danger' : 'tc-btn-primaire'}`}
                onClick={() => fermer(true)}
                autoFocus
              >
                {confirmation.bouton || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tc-toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`tc-toast ${t.type}`}>
            <span className="tc-toast-icone">{t.type === 'erreur' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </RetoursContext.Provider>
  );
}

export const useRetours = () => useContext(RetoursContext);
