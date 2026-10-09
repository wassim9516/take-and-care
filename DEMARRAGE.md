# Take & Care — Guide de démarrage

## Structure du projet

```
tkF/
├── pharmasave-backend/   ← Serveur Node.js (API)
│   ├── server.js         ← Point d'entrée du serveur
│   ├── data/mockData.js  ← Données de test (pharmacies, offres)
│   └── routes/           ← Endpoints de l'API
│       ├── pharmacies.js
│       └── offers.js
│
└── pharmasave-app/       ← Application mobile Expo
    ├── App.js            ← Navigation principale
    ├── src/
    │   ├── config.js     ← ⚠️ À MODIFIER : ton IP locale
    │   ├── api/client.js ← Appels vers le backend
    │   ├── screens/      ← Écrans de l'app
    │   └── components/   ← Composants réutilisables
    └── package.json
```

---

## Étape 1 — Installer les dépendances

Ouvre **deux terminaux** côte à côte.

**Terminal 1 — Backend :**
```bash
cd ~/Desktop/tkF/pharmasave-backend
npm install
cp .env.example .env   # puis remplis les valeurs (DB_USER, JWT_SECRET…)
```

**Terminal 2 — App mobile :**
```bash
cd ~/Desktop/tkF/pharmasave-app
npm install
```

---

## Étape 2 — Trouver ton IP locale (IMPORTANT)

Dans un terminal, tape :
```bash
ifconfig | grep "inet 192"
```

Tu verras quelque chose comme : `inet 192.168.1.42`

Copie cette adresse, puis ouvre `pharmasave-app/src/config.js`
et remplace `192.168.1.XX` par ton adresse.

> ⚠️ L'iPhone et le Mac doivent être sur le **même réseau WiFi** !

---

## Étape 3 — Lancer le backend

Dans **Terminal 1** :
```bash
cd ~/Desktop/tkF/pharmasave-backend
npm run dev
```

Tu dois voir :
```
🚀 Serveur PharmaSave démarré !
   Local : http://localhost:3000
```

Vérifie que ça marche : ouvre http://localhost:3000 dans Safari → tu dois voir `{"message":"PharmaSave API opérationnelle ✅"}`

---

## Étape 4 — Installer Expo Go sur l'iPhone

1. Ouvre l'App Store sur ton iPhone 11
2. Cherche **"Expo Go"** et installe-le

---

## Étape 5 — Lancer l'app mobile

Dans **Terminal 2** :
```bash
cd ~/Desktop/tkF/pharmasave-app
npx expo start
```

Un QR code s'affiche dans le terminal.

**Sur l'iPhone :**
- Ouvre l'appareil photo
- Pointe-le vers le QR code
- Appuie sur la notification qui apparaît
- L'app se lance dans Expo Go !

---

## Dépannage courant

| Problème | Solution |
|---|---|
| "Network request failed" | Vérifie l'IP dans `config.js` + même WiFi |
| QR code ne fonctionne pas | Dans le terminal Expo, appuie sur `s` pour passer en mode "Expo Go" |
| App trop lente à charger | Normal la 1ère fois, Expo compile tout |
| Carte ne s'affiche pas | Accepte la permission de localisation |

---

## Ce que tu peux modifier facilement

### Ajouter une offre
Ouvre `pharmasave-backend/data/mockData.js` et ajoute un objet dans le tableau `offers`.

### Ajouter une pharmacie
Dans le même fichier, ajoute un objet dans `pharmacies` avec de vraies coordonnées GPS.
(Tu peux les trouver sur Google Maps en faisant clic droit → "C'est ici")

### Changer les couleurs
Modifie `pharmasave-app/src/constants/colors.js`.

### Ajouter une catégorie
1. Dans `mockData.js` : utilise un nouveau nom de catégorie dans les offres
2. Dans `HomeScreen.js` : ajoute-la dans le tableau `CATEGORIES`
3. Dans `colors.js` : ajoute une couleur dans `categories`

### Create By F ###