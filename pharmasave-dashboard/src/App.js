// ============================================================
// src/App.js — Racine du dashboard pharmacien
// ============================================================

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login                  from './pages/Login';
import Dashboard              from './pages/Dashboard';
import InscriptionPharmacien  from './pages/InscriptionPharmacien';

function Routeur() {
  const { estConnecte, chargement } = useAuth();
  const [afficherInscription, setAfficherInscription] = useState(false);

  if (chargement) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#FAF7F0' }}>
        <span style={{ fontSize: 48 }}>🍀</span>
      </div>
    );
  }

  if (estConnecte) return <Dashboard />;

  if (afficherInscription) {
    return <InscriptionPharmacien onRetourConnexion={() => setAfficherInscription(false)} />;
  }

  return <Login onInscription={() => setAfficherInscription(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routeur />
    </AuthProvider>
  );
}
