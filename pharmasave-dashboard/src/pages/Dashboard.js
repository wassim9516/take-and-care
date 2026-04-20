// ============================================================
// src/pages/Dashboard.js — Page principale du dashboard
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOffresPharmacien, getReservationsPharmacien, supprimerOffre, marquerReservationRetiree } from '../api/client';
import FormulaireOffre from '../components/FormulaireOffre';

const VERT       = '#2D6A4F';
const VERT_F     = '#1B4332';
const BEIGE      = '#FAF7F0';
const BORDURE    = '#EDE8DF';

// Libellés des statuts de réservation
const STATUTS = {
  confirmee: { label: 'Confirmée', couleur: VERT },
  retiree:   { label: 'Retirée',   couleur: '#3498DB' },
  annulee:   { label: 'Annulée',   couleur: '#C0392B' },
};

export default function Dashboard() {
  const { pharmacien, seDeconnecter } = useAuth();

  const [onglet, setOnglet]           = useState('offres'); // 'offres' ou 'reservations'
  const [offres, setOffres]           = useState([]);
  const [reservations, setReservations] = useState([]);
  const [chargement, setChargement]   = useState(true);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [offreAModifier, setOffreAModifier]         = useState(null);

  // Filtres onglet Offres
  const [rechercheOffre, setRechercheOffre]         = useState('');
  const [filtreStatutOffre, setFiltreStatutOffre]   = useState('tous');

  // Filtres onglet Réservations
  const [rechercheResa, setRechercheResa]           = useState('');
  const [filtreStatutResa, setFiltreStatutResa]     = useState('tous');

  const pharmacieId = pharmacien?.pharmacieId;

  useEffect(() => {
    if (pharmacieId) chargerDonnees();
  }, [pharmacieId]);

  const chargerDonnees = async () => {
    setChargement(true);
    try {
      const [dataOffres, dataResas] = await Promise.all([
        getOffresPharmacien(pharmacieId),
        getReservationsPharmacien(pharmacieId),
      ]);
      setOffres(dataOffres);
      setReservations(dataResas);
    } catch (err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  };

  const handleSupprimer = async (id) => {
    if (!window.confirm('Supprimer cette offre ?')) return;
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

  const handleMarquerRetiree = async (id) => {
    if (!window.confirm('Confirmer que le client a retiré ce panier ?')) return;
    try {
      await marquerReservationRetiree(id);
      chargerDonnees();
    } catch {
      alert('Erreur lors de la mise à jour.');
    }
  };

  const handleFormulaireTermine = () => {
    setAfficherFormulaire(false);
    setOffreAModifier(null);
    chargerDonnees();
  };

  // Offres filtrées
  const offresFiltrees = offres.filter(o => {
    const matchRecherche = o.titre.toLowerCase().includes(rechercheOffre.toLowerCase());
    const matchStatut = filtreStatutOffre === 'tous' || (filtreStatutOffre === 'active' ? o.actif : !o.actif);
    return matchRecherche && matchStatut;
  });

  // Réservations filtrées
  const resasFiltrees = reservations.filter(r => {
    const client = `${r.utilisateur?.prenom || ''} ${r.utilisateur?.nom || ''}`.toLowerCase();
    const matchRecherche = (r.numero || '').toLowerCase().includes(rechercheResa.toLowerCase())
      || (r.offre?.titre || '').toLowerCase().includes(rechercheResa.toLowerCase())
      || client.includes(rechercheResa.toLowerCase());
    const matchStatut = filtreStatutResa === 'tous' || r.statut === filtreStatutResa;
    return matchRecherche && matchStatut;
  });

  // Stats rapides
  const nbDisponibles  = offres.filter(o => o.actif && o.quantiteDisponible > 0).length;
  const nbReserve      = reservations.filter(r => r.statut === 'confirmee').length;
  const gainTotal      = reservations
    .filter(r => r.statut !== 'annulee')
    .reduce((acc, r) => acc + (r.prixPaye || 0), 0);

  if (!pharmacieId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: BEIGE }}>
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: 40, border: `1px solid ${BORDURE}`, textAlign: 'center' }}>
          <p style={{ color: '#C0392B', fontWeight: 600, marginBottom: 12 }}>Compte non lié à une pharmacie.</p>
          <p style={{ color: '#6B7C6B', fontSize: 14 }}>Contactez un administrateur pour associer votre compte.</p>
          <button onClick={seDeconnecter} style={{ marginTop: 20, padding: '8px 16px', backgroundColor: VERT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* ---- SIDEBAR ---- */}
      <aside style={styles.sidebar}>
        <div style={styles.logoSidebar}>
          <span style={{ fontSize: 28 }}>🍀</span>
          <span style={styles.nomApp}>Take & Care</span>
        </div>

        <nav style={styles.nav}>
          <button
            style={{ ...styles.lienNav, ...(onglet === 'offres' ? styles.lienActif : {}) }}
            onClick={() => setOnglet('offres')}
          >
            📦 Mes offres
          </button>
          <button
            style={{ ...styles.lienNav, ...(onglet === 'reservations' ? styles.lienActif : {}) }}
            onClick={() => setOnglet('reservations')}
          >
            🎫 Réservations
          </button>
        </nav>

        <div style={styles.piedSidebar}>
          <p style={styles.nomPharmacien}>{pharmacien?.prenom} {pharmacien?.nom}</p>
          <button onClick={seDeconnecter} style={styles.boutonDeconnexion}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ---- CONTENU PRINCIPAL ---- */}
      <main style={styles.main}>

        {/* Stats */}
        <div style={styles.statsRapides}>
          <div style={styles.stat}>
            <span style={styles.statNombre}>{offres.length}</span>
            <span style={styles.statLabel}>Offres total</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statNombre}>{nbDisponibles}</span>
            <span style={styles.statLabel}>Disponibles</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statNombre}>{nbReserve}</span>
            <span style={styles.statLabel}>Réservations actives</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statNombre, color: VERT }}>{gainTotal.toFixed(2)}€</span>
            <span style={styles.statLabel}>Revenus générés</span>
          </div>
        </div>

        {/* ---- ONGLET OFFRES ---- */}
        {onglet === 'offres' && (
          <section>
            <div style={styles.ligneEntete}>
              <h2 style={styles.titreSection}>Mes offres</h2>
              <button
                style={styles.boutonAjouter}
                onClick={() => { setOffreAModifier(null); setAfficherFormulaire(true); }}
              >
                + Nouvelle offre
              </button>
            </div>

            <div style={styles.barreFiltre}>
              <input
                style={styles.inputRecherche}
                placeholder="Rechercher une offre..."
                value={rechercheOffre}
                onChange={e => setRechercheOffre(e.target.value)}
              />
              <select style={styles.selectFiltre} value={filtreStatutOffre} onChange={e => setFiltreStatutOffre(e.target.value)}>
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
              <p style={styles.texteChargement}>Chargement...</p>
            ) : offres.length === 0 ? (
              <div style={styles.vide}>
                <p>Aucune offre pour le moment.</p>
                <p style={{ color: '#6B7C6B', fontSize: 14 }}>Clique sur "+ Nouvelle offre" pour commencer.</p>
              </div>
            ) : (
              <div style={styles.tableauConteneur}>
                {offresFiltrees.length === 0 && (
                  <p style={{ padding: 20, color: '#6B7C6B', textAlign: 'center' }}>Aucune offre ne correspond à ta recherche.</p>
                )}
                <table style={styles.tableau}>
                  <thead>
                    <tr style={styles.enteteTableau}>
                      <th style={styles.th}>Titre</th>
                      <th style={styles.th}>Catégorie</th>
                      <th style={styles.th}>Prix réduit</th>
                      <th style={styles.th}>Stock</th>
                      <th style={styles.th}>Statut</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offresFiltrees.map((offre, i) => (
                      <tr key={offre.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : BEIGE }}>
                        <td style={styles.td}>{offre.titre}</td>
                        <td style={styles.td}>{offre.categorie}</td>
                        <td style={styles.td}><strong style={{ color: VERT }}>{offre.prixReduit}€</strong></td>
                        <td style={styles.td}>{offre.quantiteDisponible}</td>
                        <td style={styles.td}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: offre.actif ? VERT + '20' : '#C0392B20',
                            color: offre.actif ? VERT : '#C0392B',
                          }}>
                            {offre.actif ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button style={styles.btnModifier} onClick={() => handleModifier(offre)}>
                            Modifier
                          </button>
                          <button style={styles.btnSupprimer} onClick={() => handleSupprimer(offre.id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---- ONGLET RÉSERVATIONS ---- */}
        {onglet === 'reservations' && (
          <section>
            <div style={{ ...styles.ligneEntete, marginBottom: 16 }}>
              <h2 style={styles.titreSection}>Réservations reçues</h2>
            </div>

            <div style={styles.barreFiltre}>
              <input
                style={styles.inputRecherche}
                placeholder="Rechercher par N°, offre ou client..."
                value={rechercheResa}
                onChange={e => setRechercheResa(e.target.value)}
              />
              <select style={styles.selectFiltre} value={filtreStatutResa} onChange={e => setFiltreStatutResa(e.target.value)}>
                <option value="tous">Tous les statuts</option>
                <option value="confirmee">Confirmée</option>
                <option value="retiree">Retirée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>

            {chargement ? (
              <p style={styles.texteChargement}>Chargement...</p>
            ) : reservations.length === 0 ? (
              <div style={styles.vide}>
                <p>Aucune réservation pour le moment.</p>
              </div>
            ) : (
              <div style={styles.tableauConteneur}>
                {resasFiltrees.length === 0 && (
                  <p style={{ padding: 20, color: '#6B7C6B', textAlign: 'center' }}>Aucune réservation ne correspond à ta recherche.</p>
                )}
                <table style={styles.tableau}>
                  <thead>
                    <tr style={styles.enteteTableau}>
                      <th style={styles.th}>N° Réservation</th>
                      <th style={styles.th}>Offre</th>
                      <th style={styles.th}>Client</th>
                      <th style={styles.th}>Prix payé</th>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Statut</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resasFiltrees.map((resa, i) => {
                      const statut = STATUTS[resa.statut] || STATUTS.confirmee;
                      return (
                        <tr key={resa.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : BEIGE }}>
                          <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>{resa.numero}</td>
                          <td style={styles.td}>{resa.offre?.titre || '—'}</td>
                          <td style={styles.td}>{resa.utilisateur?.prenom} {resa.utilisateur?.nom}</td>
                          <td style={styles.td}><strong style={{ color: VERT }}>{resa.prixPaye}€</strong></td>
                          <td style={styles.td}>{new Date(resa.createdAt).toLocaleDateString('fr-FR')}</td>
                          <td style={styles.td}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: statut.couleur + '20',
                              color: statut.couleur,
                            }}>
                              {statut.label}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {resa.statut === 'confirmee' && (
                              <button
                                style={styles.btnRetiree}
                                onClick={() => handleMarquerRetiree(resa.id)}
                              >
                                ✅ Panier retiré
                              </button>
                            )}
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

      </main>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: BEIGE,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  },
  sidebar: {
    width: 220,
    backgroundColor: VERT_F,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
  },
  logoSidebar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
    paddingLeft: 4,
  },
  nomApp: {
    color: '#fff',
    fontWeight: 800,
    fontSize: 18,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  lienNav: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'left',
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  lienActif: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontWeight: 700,
  },
  piedSidebar: {
    borderTop: '1px solid rgba(255,255,255,0.15)',
    paddingTop: 16,
  },
  nomPharmacien: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    margin: '0 0 10px',
  },
  boutonDeconnexion: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 13,
    width: '100%',
  },
  main: {
    marginLeft: 220,
    padding: 32,
    flex: 1,
  },
  statsRapides: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  stat: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    border: `1px solid ${BORDURE}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statNombre: {
    fontSize: 28,
    fontWeight: 800,
    color: VERT_F,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7C6B',
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
    fontSize: 12,
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
  btnRetiree: {
    backgroundColor: '#3498DB20',
    color: '#3498DB',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSupprimer: {
    backgroundColor: '#C0392B20',
    color: '#C0392B',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
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
  vide: {
    backgroundColor: '#fff',
    borderRadius: 12,
    border: `1px solid ${BORDURE}`,
    padding: 40,
    textAlign: 'center',
    color: '#1A2E1A',
  },
  texteChargement: {
    color: '#6B7C6B',
    padding: 20,
  },
};
