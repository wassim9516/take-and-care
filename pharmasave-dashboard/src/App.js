// ============================================================
// src/App.js — Racine du dashboard pharmacien
// ============================================================

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RetoursProvider } from './components/ui';
import { Leaf } from 'lucide-react';
import Login                  from './pages/Login';
import Dashboard              from './pages/Dashboard';
import InscriptionPharmacien  from './pages/InscriptionPharmacien';

function Routeur() {
  const { estConnecte, chargement } = useAuth();
  const [afficherInscription, setAfficherInscription] = useState(false);

  if (chargement) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Leaf className="tc-apparait" size={44} strokeWidth={1.75} color="#2D6A4F" />
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
      <RetoursProvider>
        <Routeur />
      </RetoursProvider>
    </AuthProvider>
  );
}
