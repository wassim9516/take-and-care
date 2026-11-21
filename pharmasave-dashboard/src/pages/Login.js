// ============================================================
// src/pages/Login.js — Connexion pharmacien
// ============================================================

import React, { useState } from 'react';
import { Leaf, ShoppingBasket, Bell, BarChart3, Eye, EyeOff, AlertTriangle, Loader2, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demanderReinitialisation, reinitialiserMotDePasse } from '../api/client';
import { erreurMotDePasse } from '../utils/validation';
import { LIENS_LEGAUX } from '../config';

export default function Login({ onInscription }) {
  const [email, setEmail]         = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voirMdp, setVoirMdp]     = useState(false);
  const [erreur, setErreur]       = useState('');
  const [chargement, setChargement] = useState(false);
  const [oubli, setOubli]           = useState(false);
  const { seConnecter } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      await seConnecter(email, motDePasse);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Impossible de joindre le serveur. Vérifie ta connexion.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="tc-login">

      {/* Panneau de marque */}
      <section className="tc-login-marque">
        <span className="tc-login-bulle" style={{ width: 340, height: 340, top: -90, right: -110 }} />
        <span className="tc-login-bulle" style={{ width: 220, height: 220, bottom: 60, left: -80, animationDelay: '-4s' }} />

        <div className="tc-logo" style={{ position: 'relative', padding: 0 }}>
          <div className="tc-logo-icone"><Leaf size={20} strokeWidth={2.25} /></div>
          <div>
            <div className="tc-logo-nom">Take & Care</div>
            <div className="tc-logo-sous">Espace pharmacie</div>
          </div>
        </div>

        <div className="tc-login-accroche tc-apparait">
          <h2>Donnez une seconde vie à vos produits.</h2>
          <p>
            Publiez vos cosmétiques proches de la péremption à prix réduit,
            les clients du quartier les réservent et viennent les chercher en officine.
          </p>
        </div>

        <div className="tc-login-points">
          {[
            [ShoppingBasket, 'Publiez un panier en moins d\'une minute'],
            [Bell, 'Les clients à proximité sont notifiés'],
            [BarChart3, 'Suivez vos ventes et vos retraits en temps réel'],
          ].map(([Icone, texte], i) => (
            <div key={texte} className="tc-login-point tc-apparait" style={{ animationDelay: `${150 + i * 90}ms` }}>
              <span><Icone size={18} /></span>
              <span>{texte}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Formulaire */}
      <section className="tc-login-formulaire">
        {oubli ? (
          <MotDePasseOublie emailInitial={email} onRetour={() => setOubli(false)} />
        ) : (
        <div className="tc-login-carte tc-apparait">
          <h1>Bon retour</h1>
          <p>Connecte-toi pour gérer tes offres et tes réservations.</p>

          <form onSubmit={handleSubmit} className="tc-formulaire">
            <div className="tc-groupe">
              <label className="tc-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="tc-champ"
                placeholder="pharmacie@exemple.fr"
                required
                autoFocus
              />
            </div>

            <div className="tc-groupe">
              <label className="tc-label" htmlFor="mdp">Mot de passe</label>
              <div className="tc-champ-mdp">
                <input
                  id="mdp"
                  type={voirMdp ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  className="tc-champ"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setVoirMdp(v => !v)} aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                  {voirMdp ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {erreur && <div className="tc-alerte erreur"><AlertTriangle size={16} /> {erreur}</div>}

            <button type="submit" className="tc-btn tc-btn-primaire tc-btn-large" disabled={chargement} style={{ marginTop: 4 }}>
              {chargement ? <><Loader2 size={17} className="tc-tourne" /> Connexion…</> : 'Se connecter'}
            </button>
            <button type="button" className="tc-btn tc-btn-fantome tc-btn-petit" onClick={() => { setErreur(''); setOubli(true); }} style={{ alignSelf: 'center' }}>
              Mot de passe oublié ?
            </button>
          </form>

          <div className="tc-separateur">Nouvelle pharmacie ?</div>

          <button className="tc-btn tc-btn-secondaire tc-btn-large" onClick={onInscription}>
            Créer un espace pharmacien <ArrowRight size={16} />
          </button>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: 'var(--encre-3)' }}>
            <a href={LIENS_LEGAUX.cgu} target="_blank" rel="noreferrer">Conditions générales</a>
            {' · '}
            <a href={LIENS_LEGAUX.confidentialite} target="_blank" rel="noreferrer">Confidentialité</a>
          </p>
        </div>
        )}
      </section>
    </div>
  );
}

// -------------------------------------------------------
// Mot de passe oublié : code reçu par email + nouveau mot de passe
// -------------------------------------------------------
function MotDePasseOublie({ emailInitial, onRetour }) {
  const [etape, setEtape]           = useState(1);
  const [email, setEmail]           = useState(emailInitial || '');
  const [code, setCode]             = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur]         = useState('');
  const [info, setInfo]             = useState('');
  const [chargement, setChargement] = useState(false);
  const [termine, setTermine]       = useState(false);

  const envoyerCode = async (e) => {
    e?.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const { message } = await demanderReinitialisation(email.trim());
      setInfo(message);
      setEtape(2);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Impossible d\'envoyer le code. Réessaie.');
    } finally {
      setChargement(false);
    }
  };

  const valider = async (e) => {
    e.preventDefault();
    setErreur('');
    const erreurMdp = erreurMotDePasse(motDePasse);
    if (erreurMdp) return setErreur(erreurMdp);
    setChargement(true);
    try {
      await reinitialiserMotDePasse(email.trim(), code.trim(), motDePasse);
      setTermine(true);
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Code incorrect ou expiré.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="tc-login-carte tc-apparait">
      <h1>Mot de passe oublié</h1>
      {termine ? (
        <>
          <div className="tc-alerte succes"><Check size={16} /> Mot de passe modifié. Tu peux te connecter.</div>
          <button className="tc-btn tc-btn-primaire tc-btn-large" onClick={onRetour} style={{ marginTop: 16 }}>Se connecter</button>
        </>
      ) : etape === 1 ? (
        <form onSubmit={envoyerCode} className="tc-formulaire">
          <p>Saisis l'email de ton compte : on t'envoie un code à 6 chiffres.</p>
          <div className="tc-groupe">
            <label className="tc-label" htmlFor="oubli-email">Email</label>
            <input id="oubli-email" type="email" autoComplete="email" className="tc-champ" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          {erreur && <div className="tc-alerte erreur"><AlertTriangle size={16} /> {erreur}</div>}
          <button type="submit" className="tc-btn tc-btn-primaire tc-btn-large" disabled={chargement}>
            {chargement ? <Loader2 size={17} className="tc-tourne" /> : 'Recevoir le code'}
          </button>
        </form>
      ) : (
        <form onSubmit={valider} className="tc-formulaire">
          <p>{info}</p>
          <div className="tc-groupe">
            <label className="tc-label" htmlFor="oubli-code">Code reçu par email</label>
            <input id="oubli-code" className="tc-champ" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required autoFocus />
          </div>
          <div className="tc-groupe">
            <label className="tc-label" htmlFor="oubli-mdp">Nouveau mot de passe</label>
            <input id="oubli-mdp" type="password" autoComplete="new-password" className="tc-champ" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} placeholder="8 caractères, lettres et chiffres" required />
          </div>
          {erreur && <div className="tc-alerte erreur"><AlertTriangle size={16} /> {erreur}</div>}
          <button type="submit" className="tc-btn tc-btn-primaire tc-btn-large" disabled={chargement}>
            {chargement ? <Loader2 size={17} className="tc-tourne" /> : 'Changer le mot de passe'}
          </button>
          <button type="button" className="tc-btn tc-btn-fantome tc-btn-petit" onClick={() => envoyerCode()} disabled={chargement}>Renvoyer un code</button>
        </form>
      )}
      <button type="button" className="tc-btn tc-btn-fantome" onClick={onRetour} style={{ marginTop: 12 }}>
        <ArrowLeft size={15} /> Retour à la connexion
      </button>
    </div>
  );
}
