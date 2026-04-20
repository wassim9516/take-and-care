// ============================================================
// utils/notifications.js — Envoi de notifications push Expo
// ============================================================

const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function envoyerNotifications(tokens, titre, corps, data = {}) {
  if (!tokens || tokens.length === 0) return;

  const messages = tokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({
      to:    token,
      sound: 'default',
      title: titre,
      body:  corps,
      data,
    }));

  if (messages.length === 0) return;

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error('Erreur envoi push:', err.message);
  }
}

module.exports = { envoyerNotifications };
