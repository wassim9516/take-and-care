// ============================================================
// tests/api.test.js — Tests de bout en bout de l'API
// ============================================================
// Lancer : npm test (PostgreSQL doit tourner)
// Une base « pharmasave_test » est créée puis supprimée : la base de
// développement n'est jamais touchée.
// ============================================================

require('dotenv').config({ quiet: true });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const BASE_TEST = 'pharmasave_test';
process.env.NODE_ENV    = 'test';
process.env.JWT_SECRET  = 'secret-de-test';
process.env.BACKEND_URL = 'http://test.local';
delete process.env.DATABASE_URL;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SMTP_HOST;

const configAdmin = {
  host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'postgres',
};

async function requeteAdmin(sql) {
  const client = new Client(configAdmin);
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
}

// Les SMS et emails de dev sont écrits dans la console : on y lit les codes
const sortieConsole = [];
const logOriginal = console.log;
console.log = (...args) => { sortieConsole.push(args.join(' ')); };
const dernierCode = () => {
  for (let i = sortieConsole.length - 1; i >= 0; i--) {
    const m = sortieConsole[i].match(/(\d{6})(?: \(valable|\s*$)/);
    if (m) return m[1];
  }
  throw new Error('Aucun code dans la console');
};

let sequelize, modeles, serveur, BASE;

async function api(methode, chemin, corps, token) {
  const reponse = await fetch(BASE + chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corps === undefined ? undefined : (typeof corps === 'string' ? corps : JSON.stringify(corps)),
  });
  let donnees = null;
  try { donnees = await reponse.json(); } catch { /* corps vide */ }
  return { status: reponse.status, data: donnees };
}

async function connexion(email, motDePasse) {
  const { status, data } = await api('POST', '/api/auth/connexion', { email, motDePasse });
  assert.equal(status, 200, JSON.stringify(data));
  return data.token;
}

let telephoneSuivant = 10000000;
async function creerClient(email) {
  const telephone = `06${telephoneSuivant++}`;
  let r = await api('POST', '/api/auth/demander-verification', {
    prenom: 'Test', nom: 'Client', email, motDePasse: 'motdepasse1', telephone,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  r = await api('POST', '/api/auth/confirmer-inscription', { telephone, code: dernierCode() });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: r.data.token, id: r.data.utilisateur.id, telephone };
}

const ctx = {};

before(async () => {
  process.env.DB_NAME = BASE_TEST;
  await requeteAdmin(`DROP DATABASE IF EXISTS ${BASE_TEST}`);
  await requeteAdmin(`CREATE DATABASE ${BASE_TEST}`);

  sequelize = require('../database/connection');
  modeles   = require('../database/models');
  await sequelize.sync({ force: true });
  await require('../database/migrations').executerMigrations();

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('pharma1234', 4);
  const { Pharmacie, Utilisateur, Offre } = modeles;

  ctx.pharmacie = await Pharmacie.create({ nom: 'Pharmacie Test', adresse: '1 rue du Test, Paris', latitude: 48.85, longitude: 2.35, valide: true });
  ctx.pharmacieAttente = await Pharmacie.create({ nom: 'Pharmacie En Attente', adresse: '2 rue du Test, Lyon', latitude: 45.76, longitude: 4.83, valide: false });
  await Utilisateur.create({ prenom: 'Phil', nom: 'Pharma', email: 'pharma@test.fr', motDePasse: hash, pharmacieId: ctx.pharmacie.id });
  await Utilisateur.create({ prenom: 'Paul', nom: 'Attente', email: 'attente@test.fr', motDePasse: hash, pharmacieId: ctx.pharmacieAttente.id });
  await Utilisateur.create({ prenom: 'Ada', nom: 'Admin', email: 'admin@test.fr', motDePasse: hash, estAdmin: true });

  const base = { pharmacieId: ctx.pharmacie.id, prixOriginal: 30, categorie: 'soin_visage', produits: ['Crème'] };
  ctx.offre     = await Offre.create({ ...base, titre: 'Panier Visage', prixReduit: 12.5, quantiteDisponible: 3 });
  ctx.offreBis  = await Offre.create({ ...base, titre: 'Panier Corps', prixReduit: 8, quantiteDisponible: 2, categorie: 'soin_corps' });
  ctx.epuisee   = await Offre.create({ ...base, titre: 'Panier Épuisé', prixReduit: 5, quantiteDisponible: 0 });
  ctx.perimee   = await Offre.create({ ...base, titre: 'Panier Périmé', prixReduit: 5, quantiteDisponible: 4, datePeremption: '2020-01-01' });

  const app = require('../app');
  await new Promise(resolve => { serveur = app.listen(0, resolve); });
  BASE = `http://127.0.0.1:${serveur.address().port}`;

  ctx.tokenPharma = await connexion('pharma@test.fr', 'pharma1234');
  ctx.tokenAdmin  = await connexion('admin@test.fr', 'pharma1234');
});

after(async () => {
  serveur?.close();
  await sequelize?.close();
  await requeteAdmin(`DROP DATABASE IF EXISTS ${BASE_TEST}`);
  console.log = logOriginal;
});

// -------------------------------------------------------
test('la liste des offres cache les offres épuisées et périmées', async () => {
  const { status, data } = await api('GET', '/api/offers');
  assert.equal(status, 200);
  const titres = data.offres.map(o => o.titre).sort();
  assert.deepEqual(titres, ['Panier Corps', 'Panier Visage']);
  assert.equal(typeof data.offres[0].prixReduit, 'number');
});

test('recherche, prix maximum et tri sont appliqués par le serveur', async () => {
  let r = await api('GET', '/api/offers?recherche=corps');
  assert.deepEqual(r.data.offres.map(o => o.titre), ['Panier Corps']);
  r = await api('GET', '/api/offers?prixMax=10');
  assert.deepEqual(r.data.offres.map(o => o.titre), ['Panier Corps']);
  r = await api('GET', '/api/offers?tri=prix');
  assert.deepEqual(r.data.offres.map(o => o.prixReduit), [8, 12.5]);
  r = await api('GET', '/api/offers?tri=distance');
  assert.equal(r.status, 400);
});

test('JSON invalide → 400, route protégée sans token → 401', async () => {
  assert.equal((await api('POST', '/api/auth/connexion', '{pas du json')).status, 400);
  assert.equal((await api('GET', '/api/reservations')).status, 401);
});

test('inscription : mobile français obligatoire, mot de passe solide, code vérifié', async () => {
  let r = await api('POST', '/api/auth/demander-verification', { prenom: 'A', nom: 'B', email: 'x@test.fr', motDePasse: 'motdepasse1', telephone: '0612345678' });
  assert.equal(r.status, 400); // prénom trop court
  r = await api('POST', '/api/auth/demander-verification', { prenom: 'Al', nom: 'Bo', email: 'x@test.fr', motDePasse: 'court', telephone: '0612345678' });
  assert.match(r.data.erreur, /8 caractères/);
  r = await api('POST', '/api/auth/demander-verification', { prenom: 'Al', nom: 'Bo', email: 'x@test.fr', motDePasse: 'motdepasse1', telephone: '+447700900123' });
  assert.match(r.data.erreur, /mobile français/);

  r = await api('POST', '/api/auth/demander-verification', { prenom: 'Al', nom: 'Bo', email: 'x@test.fr', motDePasse: 'motdepasse1', telephone: '0699999999' });
  assert.equal(r.status, 200);
  assert.equal(r.data.apercu, '+336******99');
  r = await api('POST', '/api/auth/confirmer-inscription', { telephone: '0699999999', code: '000000' });
  assert.match(r.data.erreur, /4 essai/);
  r = await api('POST', '/api/auth/confirmer-inscription', { telephone: '0699999999', code: dernierCode() });
  assert.equal(r.status, 201);
});

test('réservation, annulation et stock', async () => {
  const client = await creerClient('resa@test.fr');
  let r = await api('POST', '/api/reservations', { offreId: ctx.offre.id }, client.token);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.reservation.expireLe);
  const reservationId = r.data.reservation.id;
  assert.equal((await api('GET', `/api/offers/${ctx.offre.id}`)).data.quantiteDisponible, 2);

  r = await api('POST', '/api/reservations', { offreId: ctx.offre.id }, client.token);
  assert.equal(r.status, 409); // déjà une réservation en cours pour cette offre
  r = await api('POST', '/api/reservations', { offreId: ctx.perimee.id }, client.token);
  assert.equal(r.status, 400); // offre périmée

  r = await api('DELETE', `/api/reservations/${reservationId}`, undefined, client.token);
  assert.equal(r.status, 200);
  assert.equal((await api('GET', `/api/offers/${ctx.offre.id}`)).data.quantiteDisponible, 3);
});

test('une offre réservée ne peut pas être supprimée (et la base l\'interdit aussi)', async () => {
  const client = await creerClient('suppr-offre@test.fr');
  await api('POST', '/api/reservations', { offreId: ctx.offreBis.id }, client.token);

  const r = await api('DELETE', `/api/offers/${ctx.offreBis.id}`, undefined, ctx.tokenPharma);
  assert.equal(r.status, 400);
  await assert.rejects(modeles.Offre.destroy({ where: { id: ctx.offreBis.id } }), /foreign key/i);
});

test('masquer une offre ne touche pas au stock', async () => {
  const avant = (await modeles.Offre.findByPk(ctx.offreBis.id)).quantiteDisponible;
  let r = await api('PUT', `/api/offers/${ctx.offreBis.id}`, { actif: false }, ctx.tokenPharma);
  assert.equal(r.status, 200);
  assert.equal(r.data.quantiteDisponible, avant);
  r = await api('PUT', `/api/offers/${ctx.offreBis.id}`, { actif: true }, ctx.tokenPharma);
  assert.equal(r.data.actif, true);
});

test('un pharmacien ne voit et ne modifie que sa pharmacie', async () => {
  const tokenAutre = await connexion('attente@test.fr', 'pharma1234');
  assert.equal((await api('PUT', `/api/offers/${ctx.offre.id}`, { actif: false }, tokenAutre)).status, 403);
  assert.equal((await api('GET', `/api/reservations/pharmacie/${ctx.pharmacie.id}`, undefined, tokenAutre)).status, 403);
  const r = await api('GET', '/api/offers/mienne', undefined, ctx.tokenPharma);
  assert.ok(r.data.some(o => o.titre === 'Panier Épuisé')); // les offres épuisées restent visibles du pharmacien
});

test('rappel puis expiration d\'une réservation non retirée', async () => {
  const { envoyerRappels, expirerReservations } = require('../utils/reservations');
  const client = await creerClient('expire@test.fr');
  const { data } = await api('POST', '/api/reservations', { offreId: ctx.offre.id }, client.token);
  const stockAvant = (await modeles.Offre.findByPk(ctx.offre.id)).quantiteDisponible;

  await modeles.Reservation.update({ expireLe: new Date(Date.now() + 3600 * 1000) }, { where: { id: data.reservation.id } });
  await envoyerRappels();
  assert.equal((await modeles.Reservation.findByPk(data.reservation.id)).rappelEnvoye, true);

  await modeles.Reservation.update({ expireLe: new Date(Date.now() - 1000) }, { where: { id: data.reservation.id } });
  await expirerReservations();
  assert.equal((await modeles.Reservation.findByPk(data.reservation.id)).statut, 'expiree');
  assert.equal((await modeles.Offre.findByPk(ctx.offre.id)).quantiteDisponible, stockAvant + 1);
});

test('mot de passe oublié : code par email, anciennes sessions révoquées', async () => {
  const client = await creerClient('oubli@test.fr');
  let r = await api('POST', '/api/auth/mot-de-passe-oublie', { email: 'inconnu@test.fr' });
  const reponseInconnu = r.data.message;
  r = await api('POST', '/api/auth/mot-de-passe-oublie', { email: 'oubli@test.fr' });
  assert.equal(r.data.message, reponseInconnu); // ne révèle pas si le compte existe

  r = await api('POST', '/api/auth/reinitialiser-mot-de-passe', { email: 'oubli@test.fr', code: dernierCode(), nouveauMotDePasse: 'nouveau1234' });
  assert.equal(r.status, 200);
  assert.equal((await api('GET', '/api/auth/moi', undefined, client.token)).status, 401);
  await connexion('oubli@test.fr', 'nouveau1234');
});

test('suppression de compte : données anonymisées, connexion impossible', async () => {
  const client = await creerClient('rgpd@test.fr');
  await api('POST', '/api/reservations', { offreId: ctx.offre.id }, client.token);

  assert.equal((await api('DELETE', '/api/auth/compte', { motDePasse: 'mauvais1' }, client.token)).status, 401);
  const r = await api('DELETE', '/api/auth/compte', { motDePasse: 'motdepasse1' }, client.token);
  assert.equal(r.status, 200);

  const u = await modeles.Utilisateur.findByPk(client.id);
  assert.equal(u.telephone, null);
  assert.match(u.email, /supprime\.invalid$/);
  assert.ok(u.supprimeLe);
  const resas = await modeles.Reservation.findAll({ where: { utilisateurId: client.id } });
  assert.ok(resas.every(x => x.statut === 'annulee'));
  assert.equal((await api('POST', '/api/auth/connexion', { email: 'rgpd@test.fr', motDePasse: 'motdepasse1' })).status, 401);
});

test('administration : réservée aux admins, validation d\'une pharmacie', async () => {
  assert.equal((await api('GET', '/api/admin/pharmacies', undefined, ctx.tokenPharma)).status, 403);

  let r = await api('GET', '/api/admin/pharmacies?statut=attente', undefined, ctx.tokenAdmin);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.map(p => p.nom), ['Pharmacie En Attente']);
  assert.equal(r.data[0].pharmaciens[0].email, 'attente@test.fr');
  assert.equal(r.data[0].stripeAccountId, undefined);

  r = await api('PATCH', `/api/admin/pharmacies/${ctx.pharmacieAttente.id}`, { valide: true }, ctx.tokenAdmin);
  assert.equal(r.status, 200);
  assert.equal((await modeles.Pharmacie.findByPk(ctx.pharmacieAttente.id)).valide, true);
  assert.ok(sortieConsole.some(l => l.includes('Ta pharmacie est validée')));

  r = await api('GET', '/api/admin/stats', undefined, ctx.tokenAdmin);
  assert.equal(r.status, 200);
  assert.equal(r.data.pharmaciesEnAttente, 0);
  assert.ok(r.data.clients >= 1);
});
