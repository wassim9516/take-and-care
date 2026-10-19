// ============================================================
// src/pages/Reglages.js — Réglages du pharmacien
// ============================================================
// Sections : Mon profil · Ma pharmacie · Sécurité · Préférences
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  User, Store, ShieldCheck, SlidersHorizontal, Camera, MapPin, Crosshair,
  Phone, Clock, Mail, KeyRound, LogOut, Monitor, LayoutGrid, List, RefreshCw,
  Bell, Check, Info, Loader2, Plus, X, Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  modifierProfil, modifierPharmacie, modifierMotDePasse, deconnecterPartout, uploadImage,
} from '../api/client';
import { useRetours } from '../components/ui';
import { usePreferences } from '../utils/preferences';
import {
  JOURS_LONGS, semaineParDefaut, ecrireHoraires, lireHoraires, erreurHoraires,
} from '../utils/horaires';

const SECTIONS = [
  { id: 'profil',      label: 'Mon profil',   icone: User,              detail: 'Nom, téléphone' },
  { id: 'pharmacie',   label: 'Ma pharmacie', icone: Store,             detail: 'Fiche, horaires, adresse' },
  { id: 'securite',    label: 'Sécurité',     icone: ShieldCheck,       detail: 'Mot de passe, sessions' },
  { id: 'preferences', label: 'Préférences',  icone: SlidersHorizontal, detail: 'Affichage, alertes' },
];

export default function Reglages({ section, onSection, pharmacie, onPharmacieMiseAJour }) {
  return (
    <div className="tc-reglages tc-apparait">
      <nav className="tc-reglages-nav" aria-label="Sections des réglages">
        {SECTIONS.map(({ id, label, icone: Icone, detail }) => (
          <button
            key={id}
            className={`tc-reglages-lien ${section === id ? 'actif' : ''}`}
            onClick={() => onSection(id)}
            aria-current={section === id ? 'page' : undefined}
          >
            <span className="tc-reglages-lien-icone"><Icone size={18} strokeWidth={2} /></span>
            <span>
              <span className="tc-reglages-lien-titre">{label}</span>
              <span className="tc-reglages-lien-detail">{detail}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="tc-reglages-contenu">
        {section === 'profil'      && <SectionProfil />}
        {section === 'pharmacie'   && (
          pharmacie
            ? <SectionPharmacie key={pharmacie.id} pharmacie={pharmacie} onMiseAJour={onPharmacieMiseAJour} />
            : <div className="tc-carte"><div className="tc-squelette" style={{ height: 360 }} /></div>
        )}
        {section === 'securite'    && <SectionSecurite />}
        {section === 'preferences' && <SectionPreferences />}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Éléments communs
// -------------------------------------------------------
function Carte({ titre, description, children, pied }) {
  return (
    <section className="tc-carte tc-reglage-carte">
      <header className="tc-reglage-entete">
        <h2 className="tc-carte-titre">{titre}</h2>
        {description && <p className="tc-carte-sous-titre">{description}</p>}
      </header>
      <div className="tc-reglage-corps">{children}</div>
      {pied && <footer className="tc-reglage-pied">{pied}</footer>}
    </section>
  );
}

function BoutonEnregistrer({ modifie, chargement, form, libelle = 'Enregistrer' }) {
  return (
    <>
      <span className="tc-reglage-etat">
        {modifie ? 'Modifications non enregistrées' : <><Check size={14} /> À jour</>}
      </span>
      <button type="submit" form={form} className="tc-btn tc-btn-primaire" disabled={!modifie || chargement}>
        {chargement ? <Loader2 size={16} className="tc-tourne" /> : <Save size={16} />}
        {libelle}
      </button>
    </>
  );
}

function Champ({ id, label, aide, icone: Icone, ...props }) {
  return (
    <div className="tc-groupe">
      <label className="tc-label" htmlFor={id}>{label}{aide && <span className="aide"> · {aide}</span>}</label>
      <div className={Icone ? 'tc-champ-icone' : undefined}>
        {Icone && <Icone size={16} aria-hidden="true" />}
        <input id={id} className="tc-champ" {...props} />
      </div>
    </div>
  );
}

function Interrupteur({ actif, onChange, label, detail }) {
  return (
    <label className="tc-option">
      <span>
        <span className="tc-option-titre">{label}</span>
        {detail && <span className="tc-option-detail">{detail}</span>}
      </span>
      <button
        type="button"
        className={`tc-switch ${actif ? 'on' : ''}`}
        role="switch"
        aria-checked={actif}
        onClick={() => onChange(!actif)}
      >
        <span className="tc-switch-piste" />
      </button>
    </label>
  );
}

// -------------------------------------------------------
// Mon profil
// -------------------------------------------------------
function SectionProfil() {
  const { pharmacien, mettreAJourPharmacien } = useAuth();
  const { notifier } = useRetours();
  const initial = useMemo(() => ({
    prenom: pharmacien?.prenom || '', nom: pharmacien?.nom || '', telephone: pharmacien?.telephone || '',
  }), [pharmacien]);
  const [valeurs, setValeurs] = useState(initial);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const modifie = JSON.stringify(valeurs) !== JSON.stringify(initial);
  const changer = (cle) => (e) => setValeurs(v => ({ ...v, [cle]: e.target.value }));

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const { utilisateur } = await modifierProfil({
        prenom: valeurs.prenom.trim(), nom: valeurs.nom.trim(), telephone: valeurs.telephone.trim(),
      });
      mettreAJourPharmacien(utilisateur);
      setValeurs({ prenom: utilisateur.prenom, nom: utilisateur.nom, telephone: utilisateur.telephone || '' });
      notifier('Profil mis à jour.');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur lors de la mise à jour.');
    } finally {
      setChargement(false);
    }
  };

  const initialesAvatar = `${valeurs.prenom[0] || ''}${valeurs.nom[0] || ''}`.toUpperCase() || '?';

  return (
    <Carte
      titre="Mon profil"
      description="Tes informations personnelles de titulaire du compte."
      pied={<BoutonEnregistrer modifie={modifie} chargement={chargement} form="form-profil" />}
    >
      <form id="form-profil" onSubmit={enregistrer} className="tc-formulaire">
        <div className="tc-profil-apercu">
          <div className="tc-avatar tc-avatar-grand">{initialesAvatar}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{valeurs.prenom || 'Prénom'} {valeurs.nom || 'Nom'}</div>
            <div style={{ color: 'var(--encre-3)', fontSize: 13 }}>Pharmacien titulaire</div>
          </div>
        </div>

        <div className="tc-ligne">
          <Champ id="r-prenom" label="Prénom" value={valeurs.prenom} onChange={changer('prenom')} required minLength={2} maxLength={50} />
          <Champ id="r-nom" label="Nom" value={valeurs.nom} onChange={changer('nom')} required minLength={2} maxLength={50} />
        </div>
        <Champ id="r-tel" label="Téléphone" aide="utilisé pour te joindre en cas de besoin" icone={Phone} type="tel" value={valeurs.telephone} onChange={changer('telephone')} placeholder="06 12 34 56 78" />

        <div className="tc-groupe">
          <label className="tc-label" htmlFor="r-email">Email de connexion</label>
          <div className="tc-champ-icone">
            <Mail size={16} aria-hidden="true" />
            <input id="r-email" className="tc-champ" value={pharmacien?.email || ''} disabled />
          </div>
          <span className="tc-aide"><Info size={13} /> Pour changer d'email, contacte l'équipe Take & Care.</span>
        </div>

        {erreur && <div className="tc-alerte erreur">{erreur}</div>}
      </form>
    </Carte>
  );
}

// -------------------------------------------------------
// Ma pharmacie
// -------------------------------------------------------
function SectionPharmacie({ pharmacie, onMiseAJour }) {
  const { pharmacien } = useAuth();
  const { notifier } = useRetours();

  const initial = useMemo(() => ({
    nom: pharmacie.nom || '',
    adresse: pharmacie.adresse || '',
    telephone: pharmacie.telephone || '',
    latitude: pharmacie.latitude != null ? String(pharmacie.latitude) : '',
    longitude: pharmacie.longitude != null ? String(pharmacie.longitude) : '',
    image: pharmacie.image || '',
    horaires: pharmacie.horaires || '',
  }), [pharmacie]);

  const [valeurs, setValeurs] = useState(initial);
  const semaineLue = useMemo(() => lireHoraires(initial.horaires), [initial.horaires]);
  // Horaires en texte libre (ancien format) : on propose de passer à l'éditeur
  const [modeLibre, setModeLibre] = useState(!!initial.horaires && !semaineLue);
  const [semaine, setSemaine] = useState(semaineLue || semaineParDefaut());
  const [imageFichier, setImageFichier] = useState(null);
  const [geoChargement, setGeoChargement] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const horairesTexte = modeLibre ? valeurs.horaires : ecrireHoraires(semaine);
  const modifie = imageFichier !== null
    || JSON.stringify({ ...valeurs, horaires: horairesTexte }) !== JSON.stringify(initial);
  const changer = (cle) => (e) => setValeurs(v => ({ ...v, [cle]: e.target.value }));
  const valide = pharmacien?.pharmacieValidee !== false;

  const majJour = (i, changement) => setSemaine(s => s.map((j, k) => (k === i ? { ...j, ...changement } : j)));
  const majPlage = (i, p, borne, valeur) => setSemaine(s => s.map((j, k) => {
    if (k !== i) return j;
    const plages = j.plages.map((pl, q) => (q === p ? (borne === 0 ? [valeur, pl[1]] : [pl[0], valeur]) : pl));
    return { ...j, plages };
  }));
  const copierLundi = () => setSemaine(s => s.map((j, k) => (k > 0 && k < 5 ? JSON.parse(JSON.stringify(s[0])) : j)));

  const geoLocaliser = () => {
    if (!navigator.geolocation) { setErreur('Géolocalisation non supportée par ce navigateur.'); return; }
    setGeoChargement(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setValeurs(v => ({ ...v, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGeoChargement(false);
      },
      () => { setErreur('Impossible d\'obtenir la position.'); setGeoChargement(false); }
    );
  };

  const choisirImage = (fichier) => {
    if (!fichier) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(fichier.type)) { setErreur('Format non supporté : JPG, PNG ou WEBP.'); return; }
    if (fichier.size > 5 * 1024 * 1024) { setErreur('Image trop lourde (5 Mo maximum).'); return; }
    setErreur('');
    setImageFichier(fichier);
    setValeurs(v => ({ ...v, image: URL.createObjectURL(fichier) }));
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!modeLibre) {
      const err = erreurHoraires(semaine);
      if (err) { setErreur(err); return; }
    }
    setChargement(true);
    try {
      let image;
      if (imageFichier) image = await uploadImage(imageFichier);
      const { pharmacie: maj } = await modifierPharmacie(pharmacie.id, {
        nom: valeurs.nom.trim(),
        adresse: valeurs.adresse.trim(),
        telephone: valeurs.telephone.trim(),
        horaires: horairesTexte,
        latitude: valeurs.latitude,
        longitude: valeurs.longitude,
        ...(image ? { image } : {}),
      });
      setImageFichier(null);
      onMiseAJour(maj);
      notifier('Fiche pharmacie mise à jour. Les clients voient déjà les changements.');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Erreur lors de la mise à jour.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <form id="form-pharmacie" onSubmit={enregistrer} className="tc-reglages-pile">
      <Carte
        titre="Fiche de la pharmacie"
        description="Ces informations sont visibles par les clients dans l'application."
      >
        <div className="tc-formulaire">
          <div className="tc-photo-pharmacie">
            <div className="tc-photo-cadre">
              {valeurs.image ? <img src={valeurs.image} alt="" /> : <Store size={34} strokeWidth={1.5} />}
            </div>
            <div>
              <div className="tc-label">Photo de la devanture</div>
              <p className="tc-aide" style={{ margin: '4px 0 10px' }}>Format paysage conseillé · JPG, PNG ou WEBP · 5 Mo max</p>
              <label className={`tc-btn tc-btn-secondaire tc-btn-petit ${valide ? '' : 'desactive'}`}>
                <Camera size={15} /> {valeurs.image ? 'Changer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={!valide} onChange={e => choisirImage(e.target.files[0])} />
              </label>
              {!valide && <p className="tc-aide" style={{ marginTop: 8 }}>Disponible après validation de ta pharmacie.</p>}
            </div>
          </div>

          <Champ id="p-nom" label="Nom de la pharmacie" value={valeurs.nom} onChange={changer('nom')} required maxLength={100} />
          <Champ id="p-adresse" label="Adresse complète" icone={MapPin} value={valeurs.adresse} onChange={changer('adresse')} required maxLength={200} placeholder="12 rue du Commerce, 75015 Paris" />
          <Champ id="p-tel" label="Téléphone de l'officine" icone={Phone} type="tel" value={valeurs.telephone} onChange={changer('telephone')} maxLength={30} placeholder="01 23 45 67 89" />
        </div>
      </Carte>

      <Carte
        titre="Horaires d'ouverture"
        description="Affichés sur ta fiche et utilisés par les clients pour venir retirer leurs paniers."
      >
        {modeLibre ? (
          <div className="tc-formulaire">
            <div className="tc-alerte attention">
              <Info size={16} />
              <span>Tes horaires sont saisis en texte libre. Passe à l'éditeur pour un affichage plus clair dans l'app.</span>
            </div>
            <Champ id="p-horaires" label="Horaires (texte libre)" icone={Clock} value={valeurs.horaires} onChange={changer('horaires')} maxLength={200} />
            <div><button type="button" className="tc-btn tc-btn-secondaire tc-btn-petit" onClick={() => setModeLibre(false)}>Utiliser l'éditeur jour par jour</button></div>
          </div>
        ) : (
          <>
            <div className="tc-horaires">
              {semaine.map((jour, i) => (
                <div key={i} className={`tc-horaire-ligne ${jour.ouvert ? '' : 'ferme'}`}>
                  <div className="tc-horaire-jour">
                    <button
                      type="button"
                      className={`tc-switch ${jour.ouvert ? 'on' : ''}`}
                      role="switch"
                      aria-checked={jour.ouvert}
                      aria-label={`${JOURS_LONGS[i]} ouvert`}
                      onClick={() => majJour(i, { ouvert: !jour.ouvert })}
                    >
                      <span className="tc-switch-piste" />
                    </button>
                    <span>{JOURS_LONGS[i]}</span>
                  </div>
                  {jour.ouvert ? (
                    <div className="tc-horaire-plages">
                      {jour.plages.map(([a, b], p) => (
                        <span key={p} className="tc-plage">
                          <input type="time" className="tc-champ" value={a} onChange={e => majPlage(i, p, 0, e.target.value)} aria-label={`${JOURS_LONGS[i]} ouverture ${p + 1}`} />
                          <span>–</span>
                          <input type="time" className="tc-champ" value={b} onChange={e => majPlage(i, p, 1, e.target.value)} aria-label={`${JOURS_LONGS[i]} fermeture ${p + 1}`} />
                          {p === 1 && (
                            <button type="button" className="tc-btn tc-btn-fantome tc-btn-icone" onClick={() => majJour(i, { plages: [jour.plages[0]] })} aria-label="Retirer la pause">
                              <X size={15} />
                            </button>
                          )}
                        </span>
                      ))}
                      {jour.plages.length === 1 && (
                        <button
                          type="button"
                          className="tc-btn tc-btn-fantome tc-btn-petit"
                          onClick={() => majJour(i, { plages: [[jour.plages[0][0], '12:30'], ['14:00', jour.plages[0][1]]] })}
                        >
                          <Plus size={14} /> Pause déjeuner
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="tc-horaire-ferme">Fermé</span>
                  )}
                </div>
              ))}
            </div>
            <div className="tc-horaires-pied">
              <button type="button" className="tc-btn tc-btn-fantome tc-btn-petit" onClick={copierLundi}>Appliquer les horaires du lundi du mardi au vendredi</button>
              <span className="tc-aide"><Clock size={13} /> Affiché : {ecrireHoraires(semaine)}</span>
            </div>
          </>
        )}
      </Carte>

      <Carte titre="Localisation" description="Position du repère de ta pharmacie sur la carte de l'application.">
        <div className="tc-formulaire">
          <div className="tc-ligne">
            <Champ id="p-lat" label="Latitude" type="number" step="any" value={valeurs.latitude} onChange={changer('latitude')} />
            <Champ id="p-lng" label="Longitude" type="number" step="any" value={valeurs.longitude} onChange={changer('longitude')} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="tc-btn tc-btn-secondaire tc-btn-petit" onClick={geoLocaliser} disabled={geoChargement}>
              {geoChargement ? <Loader2 size={15} className="tc-tourne" /> : <Crosshair size={15} />} Utiliser ma position actuelle
            </button>
            {valeurs.latitude && valeurs.longitude && (
              <a
                className="tc-btn tc-btn-fantome tc-btn-petit"
                href={`https://www.openstreetmap.org/?mlat=${valeurs.latitude}&mlon=${valeurs.longitude}#map=18/${valeurs.latitude}/${valeurs.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={15} /> Vérifier sur la carte
              </a>
            )}
          </div>
        </div>
      </Carte>

      <Carte titre="Aperçu côté client" description="Voici comment ta pharmacie apparaît dans l'application.">
        <div className="tc-fiche-apercu">
          <div className="tc-fiche-image">
            {valeurs.image ? <img src={valeurs.image} alt="" /> : <Store size={28} strokeWidth={1.5} />}
          </div>
          <div className="tc-fiche-infos">
            <strong>{valeurs.nom || 'Nom de la pharmacie'}</strong>
            <span><MapPin size={13} /> {valeurs.adresse || 'Adresse'}</span>
            <span><Clock size={13} /> {horairesTexte || 'Horaires non renseignés'}</span>
            <span><Phone size={13} /> {valeurs.telephone || 'Téléphone non renseigné'}</span>
          </div>
        </div>
      </Carte>

      {erreur && <div className="tc-alerte erreur">{erreur}</div>}

      {/* Barre d'enregistrement : n'apparaît que s'il y a des changements */}
      {modifie && (
        <div className="tc-barre-enregistrer visible">
          <BoutonEnregistrer modifie={modifie} chargement={chargement} form="form-pharmacie" libelle="Enregistrer la fiche" />
        </div>
      )}
    </form>
  );
}

// -------------------------------------------------------
// Sécurité
// -------------------------------------------------------
function SectionSecurite() {
  const { notifier, confirmer } = useRetours();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  const force = nouveau.length === 0 ? 0
    : [nouveau.length >= 8, /[A-Z]/.test(nouveau) && /[a-z]/.test(nouveau), /\d/.test(nouveau), /[^A-Za-z0-9]/.test(nouveau)]
      .filter(Boolean).length;
  const libellesForce = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];

  const changer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (nouveau.length < 6) return setErreur('Le nouveau mot de passe doit faire au moins 6 caractères.');
    if (nouveau !== confirmation) return setErreur('Les deux nouveaux mots de passe ne correspondent pas.');
    setChargement(true);
    try {
      await modifierMotDePasse(ancien, nouveau);
      setAncien(''); setNouveau(''); setConfirmation('');
      notifier('Mot de passe modifié. Tes autres sessions ont été déconnectées.');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Ancien mot de passe incorrect.');
    } finally {
      setChargement(false);
    }
  };

  const toutDeconnecter = async () => {
    const ok = await confirmer({
      titre: 'Déconnecter les autres appareils ?',
      texte: 'Toutes les sessions ouvertes sur d\'autres ordinateurs ou navigateurs seront fermées. Tu resteras connecté ici.',
      bouton: 'Déconnecter',
      danger: true,
    });
    if (!ok) return;
    setDeconnexionEnCours(true);
    try {
      await deconnecterPartout();
      notifier('Les autres sessions ont été déconnectées.');
    } catch {
      notifier('Impossible de déconnecter les autres sessions.', 'erreur');
    } finally {
      setDeconnexionEnCours(false);
    }
  };

  return (
    <div className="tc-reglages-pile">
      <Carte
        titre="Mot de passe"
        description="Change-le régulièrement et n'utilise pas le même que sur d'autres sites."
        pied={(
          <button type="submit" form="form-mdp" className="tc-btn tc-btn-primaire" disabled={chargement || !ancien || !nouveau || !confirmation}>
            {chargement ? <Loader2 size={16} className="tc-tourne" /> : <KeyRound size={16} />} Modifier le mot de passe
          </button>
        )}
      >
        <form id="form-mdp" onSubmit={changer} className="tc-formulaire" style={{ maxWidth: 420 }}>
          <Champ id="s-ancien" label="Mot de passe actuel" type="password" autoComplete="current-password" value={ancien} onChange={e => setAncien(e.target.value)} />
          <div className="tc-groupe">
            <Champ id="s-nouveau" label="Nouveau mot de passe" aide="6 caractères minimum" type="password" autoComplete="new-password" value={nouveau} onChange={e => setNouveau(e.target.value)} />
            {nouveau && (
              <div className="tc-force" data-niveau={force}>
                <div className="tc-force-barres">{[1, 2, 3, 4].map(n => <span key={n} className={n <= force ? 'plein' : ''} />)}</div>
                <span>{libellesForce[force] || 'Faible'}</span>
              </div>
            )}
          </div>
          <Champ id="s-confirm" label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          {erreur && <div className="tc-alerte erreur">{erreur}</div>}
        </form>
      </Carte>

      <Carte titre="Sessions" description="Où ton compte est-il connecté ?">
        <div className="tc-session">
          <span className="tc-session-icone"><Monitor size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Ce navigateur</div>
            <div className="tc-aide">Session actuelle</div>
          </div>
          <span className="tc-pastille retiree"><span className="tc-pastille-point" />Active</span>
        </div>
        <div className="tc-session" style={{ borderBottom: 'none' }}>
          <span className="tc-session-icone"><LogOut size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Autres appareils</div>
            <div className="tc-aide">Ordinateur oublié allumé, ancien navigateur… Ferme toutes les autres sessions d'un coup.</div>
          </div>
          <button className="tc-btn tc-btn-secondaire tc-btn-petit" onClick={toutDeconnecter} disabled={deconnexionEnCours}>
            {deconnexionEnCours ? <Loader2 size={15} className="tc-tourne" /> : <LogOut size={15} />} Tout déconnecter
          </button>
        </div>
      </Carte>
    </div>
  );
}

// -------------------------------------------------------
// Préférences (enregistrées dans ce navigateur)
// -------------------------------------------------------
function SectionPreferences() {
  const [preferences, modifier] = usePreferences();
  const { notifier } = useRetours();
  const [premierRendu, setPremierRendu] = useState(true);

  // Petite confirmation à chaque changement (pas au premier affichage)
  useEffect(() => {
    if (premierRendu) { setPremierRendu(false); return; }
    notifier('Préférence enregistrée.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences]);

  return (
    <div className="tc-reglages-pile">
      <Carte titre="Affichage" description="Enregistré dans ce navigateur uniquement.">
        <div className="tc-option">
          <span>
            <span className="tc-option-titre">Affichage des offres</span>
            <span className="tc-option-detail">Vue utilisée à l'ouverture de « Mes offres ».</span>
          </span>
          <div className="tc-segments">
            <button type="button" className={`tc-segment ${preferences.vueOffres === 'grille' ? 'actif' : ''}`} onClick={() => modifier({ vueOffres: 'grille' })}>
              <LayoutGrid size={14} /> Cartes
            </button>
            <button type="button" className={`tc-segment ${preferences.vueOffres === 'liste' ? 'actif' : ''}`} onClick={() => modifier({ vueOffres: 'liste' })}>
              <List size={14} /> Liste
            </button>
          </div>
        </div>
        <div className="tc-option">
          <span>
            <span className="tc-option-titre">Page d'accueil</span>
            <span className="tc-option-detail">Onglet affiché à la connexion.</span>
          </span>
          <select className="tc-champ" style={{ width: 200 }} value={preferences.ongletDemarrage} onChange={e => modifier({ ongletDemarrage: e.target.value })}>
            <option value="offres">Mes offres</option>
            <option value="reservations">Réservations</option>
            <option value="stats">Statistiques</option>
          </select>
        </div>
        <div className="tc-option" style={{ borderBottom: 'none' }}>
          <span>
            <span className="tc-option-titre"><RefreshCw size={14} /> Actualisation automatique</span>
            <span className="tc-option-detail">Fréquence de mise à jour des offres et réservations.</span>
          </span>
          <select className="tc-champ" style={{ width: 200 }} value={preferences.rafraichissement} onChange={e => modifier({ rafraichissement: Number(e.target.value) })}>
            <option value={30}>Toutes les 30 secondes</option>
            <option value={60}>Toutes les minutes</option>
            <option value={300}>Toutes les 5 minutes</option>
            <option value={0}>Désactivée</option>
          </select>
        </div>
      </Carte>

      <Carte titre="Alertes" description="Pendant que le dashboard est ouvert.">
        <Interrupteur
          actif={preferences.alerteNouvelleResa}
          onChange={v => modifier({ alerteNouvelleResa: v })}
          label={<><Bell size={14} /> Nouvelle réservation</>}
          detail="Affiche une notification dès qu'un client réserve un panier."
        />
      </Carte>
    </div>
  );
}
