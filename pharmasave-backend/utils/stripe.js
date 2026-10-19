// ============================================================
// utils/stripe.js — Client Stripe partagé
// ============================================================
// null si STRIPE_SECRET_KEY est vide : les paiements sont désactivés
// et les réservations sont gratuites (mode développement).

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

module.exports = { stripe };
