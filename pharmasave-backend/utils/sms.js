// ============================================================
// utils/sms.js — Envoi de SMS via Twilio
// ============================================================
// Si TWILIO_ACCOUNT_SID n'est pas configuré : mode développement
// → le code s'affiche dans la console au lieu d'être envoyé par SMS

let client = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// Normalise un numéro français vers le format international (+33...)
function normaliserTelephone(tel) {
  const n = tel.replace(/[\s.\-()]/g, '');
  if (n.startsWith('+')) return n;
  if (n.startsWith('00')) return '+' + n.slice(2);
  if (n.startsWith('0'))  return '+33' + n.slice(1);
  return '+33' + n;
}

async function envoyerSMS(telephone, message) {
  const numero = normaliserTelephone(telephone);

  if (!client) {
    // Mode développement — affiche le code dans la console
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  📱 SMS (MODE DEV — non envoyé)          │');
    console.log(`│  Destinataire : ${numero.padEnd(24)}│`);
    console.log(`│  Message : ${message.padEnd(30)}│`);
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    return;
  }

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to:   numero,
  });
}

module.exports = { envoyerSMS, normaliserTelephone };
