// ============================================================
// src/App.js — Racine du dashboard pharmacien
// ============================================================

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';

function Routeur() {
  const { estConnecte, chargement } = useAuth();

  if (chargement) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#FAF7F0' }}>
        <span style={{ fontSize: 48 }}>🍀</span>
      </div>
    );
  }

  return estConnecte ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routeur />
    </AuthProvider>
  );
}
