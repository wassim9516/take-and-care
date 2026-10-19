// ============================================================
// App.js — Racine de l'application Take & Care
// ============================================================
// Gère la navigation selon l'état de connexion :
//   - Non connecté → écran LoginScreen
//   - Connecté     → app principale avec 3 onglets
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

// Référence globale à la navigation — permet de naviguer depuis n'importe où
export const navigationRef = createNavigationContainerRef();

import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FavorisProvider } from './src/context/FavorisContext';

import HomeScreen        from './src/screens/HomeScreen';
import OfferDetailScreen from './src/screens/OfferDetailScreen';
import MapScreen         from './src/screens/MapScreen';
import PharmacieScreen   from './src/screens/PharmacieScreen';
import ProfileScreen     from './src/screens/ProfileScreen';
import LoginScreen            from './src/screens/LoginScreen';
import CodeVerificationScreen from './src/screens/CodeVerificationScreen';
import FavorisScreen          from './src/screens/FavorisScreen';
import OnboardingScreen       from './src/screens/OnboardingScreen';

import { COLORS } from './src/constants/colors';
import { CONFIG } from './src/config';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const stackOptions = {
  headerStyle: { backgroundColor: '#FAF7F0' },
  headerTintColor: COLORS.primaireF,
  headerTitleStyle: { fontWeight: 'bold' },
};

// Stack d'authentification (hors app principale)
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ ...stackOptions, headerShown: false }}>
      <Stack.Screen name="Login"        component={LoginScreen} />
      <Stack.Screen name="Verification" component={CodeVerificationScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Stack de l'onglet Accueil (liste → détail → fiche pharmacie)
function AccueilStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Accueil"         component={HomeScreen}       options={{ headerShown: false }} />
      <Stack.Screen name="OfferDetail"     component={OfferDetailScreen} options={{ title: 'Détail du panier' }} />
      <Stack.Screen name="PharmacieDetail" component={PharmacieScreen}  options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Stack de l'onglet Favoris (liste favoris → détail offre)
function FavorisStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="FavorisListe" component={FavorisScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="OfferDetail"  component={OfferDetailScreen} options={{ title: 'Détail du panier' }} />
    </Stack.Navigator>
  );
}

// Stack de l'onglet Carte (carte → fiche pharmacie → détail offre)
function CarteStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="CarteEcran"      component={MapScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="PharmacieDetail" component={PharmacieScreen}  options={{ headerShown: false }} />
      <Stack.Screen name="OfferDetail"     component={OfferDetailScreen} options={{ title: 'Détail du panier' }} />
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
      <Tab.Screen name="Carte"    component={CarteStack} />
      <Tab.Screen name="Favoris"  component={FavorisStack} />
      <Tab.Screen name="Profil"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// -------------------------------------------------------
// Routeur principal — choisit entre Login et App
// -------------------------------------------------------
function Routeur() {
  const { estConnecte, chargement, erreurReseau, retenterConnexion } = useAuth();
  const [onboardingFait, setOnboardingFait] = useState(null); // null = chargement

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then(val => {
      setOnboardingFait(val === 'true');
    });
  }, []);

  // Listener : tap sur une notification → ouvre l'offre concernée
  useEffect(() => {
    const abonnement = Notifications.addNotificationResponseReceivedListener(response => {
      const offreId = response.notification.request.content.data?.offreId;
      if (offreId && navigationRef.isReady()) {
        navigationRef.navigate('Offres', {
          screen: 'OfferDetail',
          params: { offerId: offreId },
        });
      }
    });
    return () => abonnement.remove();
  }, []);

  const terminerOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    setOnboardingFait(true);
  };

  if (erreurReseau) {
    return (
      <View style={stylesErreur.conteneur}>
        <MaterialCommunityIcons name="wifi-off" size={64} color={COLORS.texteClair} />
        <Text style={stylesErreur.titre}>Serveur inaccessible</Text>
        <Text style={stylesErreur.message}>
          Vérifie que le backend est lancé et que ton téléphone est sur le même réseau Wi-Fi.
        </Text>
        <TouchableOpacity style={stylesErreur.bouton} onPress={retenterConnexion}>
          <Text style={stylesErreur.texteBouton}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (chargement || onboardingFait === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F0' }}>
        <MaterialCommunityIcons name="clover" size={60} color={COLORS.primaire} />
        <ActivityIndicator color={COLORS.primaire} style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (!onboardingFait) {
    return <OnboardingScreen onTerminer={terminerOnboarding} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" />
      {estConnecte ? <AppPrincipale /> : <AuthStack />}
    </NavigationContainer>
  );
}

const stylesErreur = StyleSheet.create({
  conteneur: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F0', padding: 32, gap: 16 },
  titre:     { fontSize: 20, fontWeight: '700', color: COLORS.primaireF, textAlign: 'center' },
  message:   { fontSize: 14, color: COLORS.texteClair, textAlign: 'center', lineHeight: 22 },
  bouton:    { backgroundColor: COLORS.primaire, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  texteBouton: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// AuthProvider enveloppe tout pour rendre le contexte accessible partout
export default function App() {
  const contenu = (
    <AuthProvider>
      <FavorisProvider>
        <Routeur />
      </FavorisProvider>
    </AuthProvider>
  );

  // Stripe nécessite un Dev Build (pas compatible Expo Go)
  // Si la clé est absente → on lance l'app sans StripeProvider
  if (!CONFIG.STRIPE_PUBLISHABLE_KEY) {
    return contenu;
  }

  return (
    <StripeProvider publishableKey={CONFIG.STRIPE_PUBLISHABLE_KEY}>
      {contenu}
    </StripeProvider>
  );
}
