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
│   ├── .env                ← ⚠️ À MODIFIER : ton IP locale (voir .env.example)
│   └── eas.json            ← Builds pour l'App Store / Play Store (voir PUBLICATION.md)
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
cp .env.example .env   # puis mets ton IP locale dans EXPO_PUBLIC_API_URL
cd ~/Desktop/tkf/pharmasave-dashboard && npm install
```

> La version du SDK Expo de l'app (voir `expo` dans `pharmasave-app/package.json`)
> doit être celle que supporte Expo Go sur ton téléphone.
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
- `pharmasave-app/.env` → `EXPO_PUBLIC_API_URL=http://<IP>:3000/api` (relance `npx expo start -c` après modification)
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

## Administration (valider les pharmacies)

Une pharmacie inscrite depuis le dashboard est **en attente** : elle ne peut ni
publier d'offres ni recevoir de paiements.

Donne les droits d'administration à ton compte (une fois) :

```bash
cd ~/Desktop/tkf/pharmasave-backend
npm run admin -- ton.email@exemple.fr        # --retirer pour enlever les droits
```

Connecte-toi ensuite au dashboard avec ce compte : tu arrives sur l'espace
**Administration** (pharmacies en attente, validées, chiffres clés). Avant de valider,
vérifie qu'il s'agit d'une vraie officine (lien « Annuaire des entreprises », appel au
numéro de la pharmacie). Le pharmacien est prévenu par email à la validation ou à la
suspension.

En ligne de commande, c'est toujours possible :

```bash
cd ~/Desktop/tkf/pharmasave-backend
npm run valider-pharmacie              # liste les pharmacies en attente
npm run valider-pharmacie -- 15        # valide la pharmacie #15
npm run valider-pharmacie -- 15 --retirer
```

---

## Valider un retrait en pharmacie

Dashboard → « Valider un retrait » → **Scanner le QR code** (webcam ou caméra de la
tablette) ou saisir le numéro affiché sous le QR code du client.
La caméra ne fonctionne que sur `http://localhost` ou en **https** (production).

---

## Tests automatisés

```bash
cd ~/Desktop/tkf/pharmasave-backend   && npm test   # PostgreSQL doit tourner
cd ~/Desktop/tkf/pharmasave-dashboard && npm test
```

Les tests du backend créent une base `pharmasave_test` puis la suppriment :
ta base de développement n'est jamais touchée.

---

## Paiements Stripe (optionnel)

Sans `STRIPE_SECRET_KEY`, les réservations sont gratuites (5 en cours maximum par
client, une seule par offre). Pour activer les paiements :

1. `STRIPE_SECRET_KEY` dans le `.env` du backend, clé publique dans `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pharmasave-app/.env`)
2. Webhook Stripe : endpoint `<BACKEND_URL>/api/paiements/webhook`, événement
   `payment_intent.succeeded`, secret dans `STRIPE_WEBHOOK_SECRET`
3. Le paiement dans l'app nécessite un build EAS (pas Expo Go)

4. Chaque pharmacie doit connecter son compte bancaire (dashboard → Paiements → Stripe Connect).
   Tant que ce n'est pas fait, ses paniers ne peuvent pas être payés : l'argent va
   directement à la pharmacie, moins la commission (`COMMISSION_TAUX`).

Une annulation par le client déclenche un remboursement Stripe complet.

---

## Réservations, codes et emails

- Un panier doit être retiré dans les **48 h** (`RESERVATION_DUREE_HEURES`). Passé ce délai,
  la réservation passe en « expirée » (vérifié toutes les 10 min ; un rappel push est
  envoyé au client 6 h avant, `RAPPEL_RETRAIT_HEURES`), le panier est remis
  en vente et un panier payé n'est pas remboursé (règle écrite dans les CGU).
- Codes SMS et emails : sans Twilio ni SMTP configurés, ils s'affichent dans la
  console du backend (mode développement). Les SMS ne partent que vers des mobiles
  français (06/07).
- Mot de passe oublié : un code est envoyé par email (variables `SMTP_*` du `.env`).
- Pages légales : http://localhost:3000/legal/cgu et `/legal/confidentialite`
  (fichiers dans `pharmasave-backend/public/legal/`, **à compléter** : champs surlignés en jaune).

---

## Dépannage courant

| Problème | Solution |
|---|---|
| "Network request failed" | Vérifie l'IP dans `pharmasave-app/.env` et `pharmasave-backend/.env` + même WiFi, puis `npx expo start -c` |
| "Project is incompatible with this version of Expo Go" | Le SDK du projet ne correspond pas à celui d'Expo Go : aligne `expo` dans `package.json` sur la version d'Expo Go (`npx expo install expo@^<SDK>.0.0` puis `npx expo install --fix`) |
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
