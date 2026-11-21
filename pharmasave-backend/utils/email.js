// ============================================================
// utils/email.js — Envoi d'emails (SMTP via nodemailer)
// ============================================================
// Si SMTP_HOST n'est pas configuré : mode développement
// → l'email s'affiche dans la console au lieu d'être envoyé.
// ============================================================

let transport = null;

if (process.env.SMTP_HOST) {
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth:   process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
}

async function envoyerEmail(destinataire, sujet, texte) {
  if (!transport) {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  ✉️  EMAIL (MODE DEV — non envoyé)        │');
    console.log(`│  À : ${destinataire}`);
    console.log(`│  Sujet : ${sujet}`);
    texte.split('\n').forEach(l => console.log(`│  ${l}`));
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    return;
  }

  await transport.sendMail({
    from:    process.env.EMAIL_FROM || 'Take & Care <no-reply@takeandcare.fr>',
    to:      destinataire,
    subject: sujet,
    text:    texte,
  });
}

module.exports = { envoyerEmail };
