// ============================================================
// src/pages/Login.js — Connexion pharmacien
// ============================================================

import React, { useState } from 'react';
import { Leaf, ShoppingBasket, Bell, BarChart3, Eye, EyeOff, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onInscription }) {
  const [email, setEmail]         = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voirMdp, setVoirMdp]     = useState(false);
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
          </form>

          <div className="tc-separateur">Nouvelle pharmacie ?</div>

          <button className="tc-btn tc-btn-secondaire tc-btn-large" onClick={onInscription}>
            Créer un espace pharmacien <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
