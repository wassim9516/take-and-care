// ============================================================
// app.config.js — Complète app.json avec les valeurs secrètes ou
// propres à chaque environnement (lues dans les variables d'env)
// ============================================================
//   EAS_PROJECT_ID       → identifiant du projet EAS (npx eas init)
//                          nécessaire aux notifications push
//   GOOGLE_MAPS_API_KEY  → clé Google Maps SDK for Android
//                          (sans elle, la carte est grise sur Android)
// ============================================================

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        ...(process.env.GOOGLE_MAPS_API_KEY
          ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } }
          : {}),
      },
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
