// ============================================================
// App.js — Racine de l'application Take & Care
// ============================================================
// Gère la navigation selon l'état de connexion :
//   - Non connecté → écran LoginScreen
//   - Connecté     → app principale avec 3 onglets
// ============================================================

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FavorisProvider } from './src/context/FavorisContext';

import HomeScreen        from './src/screens/HomeScreen';
import OfferDetailScreen from './src/screens/OfferDetailScreen';
import MapScreen         from './src/screens/MapScreen';
import ProfileScreen     from './src/screens/ProfileScreen';
import LoginScreen       from './src/screens/LoginScreen';
import FavorisScreen     from './src/screens/FavorisScreen';

import { COLORS } from './src/constants/colors';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack de l'onglet Accueil (liste → détail)
function AccueilStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FAF7F0' },
        headerTintColor: COLORS.primaireF,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="Accueil" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} options={{ title: 'Détail du panier' }} />
    </Stack.Navigator>
  );
}

// Navigation principale (onglets) — visible uniquement si connecté
function AppPrincipale() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icones = {
            'Offres':   focused ? 'home'   : 'home-outline',
            'Carte':    focused ? 'map'    : 'map-outline',
            'Favoris':  focused ? 'heart'  : 'heart-outline',
            'Profil':   focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icones[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor:   COLORS.primaire,
        tabBarInactiveTintColor: COLORS.texteClair,
        tabBarStyle: {
          backgroundColor: COLORS.blanc,
          borderTopColor:  COLORS.bordure,
          paddingBottom: 5,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Offres"   component={AccueilStack} />
      <Tab.Screen name="Carte"    component={MapScreen} />
      <Tab.Screen name="Favoris"  component={FavorisScreen} />
      <Tab.Screen name="Profil"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// -------------------------------------------------------
// Routeur principal — choisit entre Login et App
// -------------------------------------------------------
function Routeur() {
  const { estConnecte, chargement } = useAuth();

  // Pendant la vérification du token au démarrage
  if (chargement) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F0' }}>
        <MaterialCommunityIcons name="clover" size={60} color={COLORS.primaire} />
        <ActivityIndicator color={COLORS.primaire} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {/* Si connecté : app principale, sinon : écran de connexion */}
      {estConnecte ? <AppPrincipale /> : <LoginScreen />}
    </NavigationContainer>
  );
}

// AuthProvider enveloppe tout pour rendre le contexte accessible partout
export default function App() {
  return (
    <AuthProvider>
      <FavorisProvider>
        <Routeur />
      </FavorisProvider>
    </AuthProvider>
  );
}
