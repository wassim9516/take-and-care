# Take & Care — Guide de démarrage

## Structure du projet

```
tkf/
├── pharmasave-backend/     ← API Node.js + PostgreSQL
│   ├── server.js           ← Point d'entrée du serveur
│   ├── .env                ← ⚠️ Configuration (IP, base, clés) — jamais commité
│   ├── routes/             ← Endpoints de l'API
│   ├── database/           ← Modèles, migrations, seed.js (données de test)
│   └── scripts/            ← Validation des pharmacies (admin)
│
├── pharmasave-app/         ← Application mobile Expo (clients)
│   ├── App.js              ← Navigation principale
│   └── src/config.js       ← ⚠️ À MODIFIER : ton IP locale
│
└── pharmasave-dashboard/   ← Dashboard web (pharmaciens)
    └── src/config.js       ← URL de l'API (REACT_APP_API_URL en production)
```

---

## Étape 1 — Installer les dépendances

```bash
cd ~/Desktop/tkf/pharmasave-backend   && npm install
cp .env.example .env   # puis remplis les valeurs (DB_*, JWT_SECRET…)
cd ~/Desktop/tkf/pharmasave-app       && npm install
cd ~/Desktop/tkf/pharmasave-dashboard && npm install
```

> L'app mobile reste sur **Expo SDK 57** (version supportée par Expo Go sur l'iPhone).
> Ne pas lancer `expo upgrade` sans vérifier la version d'Expo Go.

---

## Étape 2 — Démarrer PostgreSQL

PostgreSQL ne redémarre pas tout seul après un redémarrage du Mac :

```bash
pg_ctl -D ~/.local/pgdata -l ~/.local/pgdata/server.log start
```

Première fois seulement — remplir la base avec des pharmacies et offres de test
(⚠️ efface toutes les données) :

```bash
cd ~/Desktop/tkf/pharmasave-backend
npm run seed
```

---

## Étape 3 — Trouver ton IP locale (IMPORTANT)

```bash
ipconfig getifaddr en0
```

Reporte cette adresse à **deux endroits** :
- `pharmasave-app/src/config.js` → `API_URL: 'http://<IP>:3000/api'`
- `pharmasave-backend/.env` → `BACKEND_URL=http://<IP>:3000`

> ⚠️ L'iPhone et le Mac doivent être sur le **même réseau WiFi** !

---

## Étape 4 — Lancer le backend

```bash
cd ~/Desktop/tkf/pharmasave-backend
npm run dev
```

Vérifie : http://localhost:3000 doit afficher `{"message":"Take & Care API ✅", ...}`.

Les nouvelles colonnes de la base sont ajoutées automatiquement au démarrage
(`database/migrations.js`).

---

## Étape 5 — Lancer l'app mobile

```bash
cd ~/Desktop/tkf/pharmasave-app
npx expo start
```

Scanne le QR code avec l'appareil photo de l'iPhone → l'app s'ouvre dans Expo Go.

---

## Étape 6 — Lancer le dashboard pharmacien

```bash
cd ~/Desktop/tkf/pharmasave-dashboard
npm start
```

Il s'ouvre sur http://localhost:3001 et utilise le backend local.
Comptes de test : les emails `pharmacie.*@takeandcare.fr` créés par `seed.js`,
mot de passe = `SEED_PASSWORD` du `.env` du backend.

---

## Valider une nouvelle pharmacie

Une pharmacie inscrite depuis le dashboard est **en attente** : elle ne peut ni
publier d'offres ni recevoir de paiements. Après avoir vérifié qu'il s'agit d'une
vraie officine :

```bash
cd ~/Desktop/tkf/pharmasave-backend
npm run valider-pharmacie              # liste les pharmacies en attente
npm run valider-pharmacie -- 15        # valide la pharmacie #15
npm run valider-pharmacie -- 15 --retirer
```

---

## Paiements Stripe (optionnel)

Sans `STRIPE_SECRET_KEY`, les réservations sont gratuites (5 en cours maximum par
client, une seule par offre). Pour activer les paiements :

1. `STRIPE_SECRET_KEY` dans le `.env` du backend, clé publique dans `pharmasave-app/src/config.js`
2. Webhook Stripe : endpoint `<BACKEND_URL>/api/paiements/webhook`, événement
   `payment_intent.succeeded`, secret dans `STRIPE_WEBHOOK_SECRET`
3. Le paiement dans l'app nécessite un build EAS (pas Expo Go)

Une annulation par le client déclenche un remboursement Stripe complet.

---

## Dépannage courant

| Problème | Solution |
|---|---|
| "Network request failed" | Vérifie l'IP dans `config.js` et `.env` + même WiFi |
| "Project is incompatible with this version of Expo Go" | Le projet doit rester en SDK 57 : `rm -rf node_modules package-lock.json && npm install`, puis `npx expo start -c` |
| QR code ne fonctionne pas | Dans le terminal Expo, appuie sur `s` pour passer en mode "Expo Go" |
| Le backend ne démarre pas | PostgreSQL n'est pas lancé (étape 2) |
| Carte ne s'affiche pas | Accepte la permission de localisation |

---

## Ce que tu peux modifier facilement

### Ajouter une offre
Depuis le dashboard pharmacien (« + Nouvelle offre »).

### Ajouter une pharmacie de test
Ajoute-la dans `pharmasave-backend/database/seed.js` avec de vraies coordonnées GPS
(Google Maps → clic droit → « C'est ici »), puis `npm run seed`.

### Changer les couleurs
Modifie `pharmasave-app/src/constants/colors.js`.

### Ajouter une catégorie
1. Backend : `CATEGORIES_VALIDES` dans `routes/offers.js`
2. App : tableau `CATEGORIES` dans `HomeScreen.js`, couleur dans `colors.js`
3. Dashboard : liste des catégories dans `components/FormulaireOffre.js`

### Create By F ###
