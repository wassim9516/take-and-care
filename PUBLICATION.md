# Publication sur l'App Store et le Google Play Store

Ce qui est déjà prêt dans le code :

- Mot de passe oublié (app + dashboard), code envoyé par email
- Suppression de compte dans l'app (Profil → Supprimer mon compte) et dans le dashboard
  (Réglages → Sécurité), exigée par Apple (règle 5.1.1(v)) et par le RGPD
- Pages légales servies par le backend : `<BACKEND_URL>/legal/cgu` et `<BACKEND_URL>/legal/confidentialite`,
  avec des liens dans l'app (inscription, profil) et dans le dashboard
- URL de l'API, clé Stripe et email de support configurables par environnement (`EXPO_PUBLIC_*`)
- Configuration des builds EAS (`pharmasave-app/eas.json`), identifiants `fr.takeandcare.app`
- Permissions minimales : localisation « pendant l'utilisation » uniquement, pas de localisation
  en arrière-plan, `ITSAppUsesNonExemptEncryption = false` (pas de formulaire d'export à chaque build)
- Notifications push ciblées et désactivables depuis le profil

## À faire de ton côté

### 1. Comptes

- [ ] Compte **Apple Developer** (99 €/an) — https://developer.apple.com
- [ ] Compte **Google Play Console** (25 $ une fois) — https://play.google.com/console
- [ ] Compte **Expo** — `npx eas login`

### 2. Projet EAS (notifications push)

```bash
cd pharmasave-app
npx eas init                 # crée le projet et affiche son ID
```

Comme le projet a un `app.config.js`, ajoute l'ID affiché comme variable d'environnement EAS :

```bash
npx eas env:create --name EAS_PROJECT_ID --value <id> --environment production --environment preview --environment development
```

Sans cet ID, `getExpoPushTokenAsync` ne renvoie rien et aucune notification n'arrive.
Pour les notifications Android, ajoute aussi la clé FCM (Firebase) : `npx eas credentials`.

### 3. Clés et variables

| Variable | Où | Pourquoi |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `eas.json` (déjà mis sur l'URL Railway) | URL **https** du backend de production |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | variable EAS `production` | clé publique `pk_live_…` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | variable EAS | adresse de support affichée dans l'app (vérifie qu'elle existe) |
| `GOOGLE_MAPS_API_KEY` | variable EAS (secret) | carte sur Android (Maps SDK for Android, Google Cloud) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Railway | paiements |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Railway | emails « mot de passe oublié » (Brevo, Mailjet, Resend…) |
| `TWILIO_*` | Railway | SMS d'inscription |
| `UPLOADS_DIR` | Railway + **Volume** monté (ex. `/data/uploads`) | sinon les photos sont effacées à chaque déploiement |
| `CORS_ORIGINS` | Railway | URL du dashboard en production |
| `NODE_ENV=production` | Railway | sécurité (JWT obligatoire, pas de seed) |

### 4. Administration

Donne-toi les droits d'admin sur la base de production (une fois), pour valider les
pharmacies depuis le dashboard :

```bash
railway run npm run admin -- ton.email@exemple.fr
```

### 5. Pages légales

Complète les champs surlignés en jaune dans `pharmasave-backend/public/legal/cgu.html`
et `confidentialite.html` : raison sociale, SIREN, adresse, hébergeur, emails, **médiateur de la
consommation** (obligatoire en France pour vendre à des particuliers). Fais-les relire par
un juriste avant le lancement.

### 6. Builds et envoi

```bash
cd pharmasave-app
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
npx eas submit --platform ios
npx eas submit --platform android
```

### 7. Fiches des stores

- [ ] Captures d'écran (iPhone 6,7" et 6,5", Android téléphone), icône 1024×1024 (déjà dans `assets/icon.png`)
- [ ] Description, mots-clés, catégorie (Shopping ou Santé et forme)
- [ ] URL de la politique de confidentialité : `<BACKEND_URL>/legal/confidentialite`
- [ ] **App Privacy** (Apple) / **Sécurité des données** (Google) : déclare nom, email, téléphone,
      position approximative, historique d'achats, identifiants d'appareil (push) ; usage
      « fonctionnalité de l'app », pas de suivi publicitaire
- [ ] **Compte de démonstration** pour la revue Apple/Google : un compte client déjà vérifié
      (email + mot de passe) et une pharmacie de test avec des offres actives, à indiquer dans
      les notes pour le réviseur (la vérification SMS bloquerait sinon la revue)
- [ ] Android : questionnaire de classification du contenu, public cible (adultes)

## Points d'attention pour la revue

- Les produits vendus doivent être de la parapharmacie (pas de médicaments) : c'est écrit
  dans les CGU, veille à ce que les pharmacies le respectent.
- Les paiements portent sur des biens physiques retirés en magasin : Stripe est autorisé,
  pas besoin de l'achat intégré Apple.
