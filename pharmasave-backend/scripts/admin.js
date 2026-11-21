// ============================================================
// scripts/admin.js — Donne (ou retire) les droits d'administration
// ============================================================
// Un administrateur se connecte au dashboard avec son compte habituel
// et voit l'espace d'administration (validation des pharmacies…).
//
//   npm run admin                         → liste les administrateurs
//   npm run admin -- marie@exemple.fr     → donne les droits
//   npm run admin -- marie@exemple.fr --retirer
// ============================================================

require('dotenv').config();
const sequelize = require('../database/connection');
const { Utilisateur } = require('../database/models');
const { executerMigrations } = require('../database/migrations');
const { messageErreur } = require('../utils/erreurs');

async function main() {
  await sequelize.authenticate();
  await executerMigrations();

  const email = process.argv.slice(2).find(a => !a.startsWith('--'))?.trim().toLowerCase();
  const retirer = process.argv.includes('--retirer');

  if (!email) {
    const admins = await Utilisateur.findAll({ where: { estAdmin: true }, attributes: ['id', 'prenom', 'nom', 'email'] });
    if (admins.length === 0) console.log('Aucun administrateur. Pour en créer un : npm run admin -- <email>');
    admins.forEach(a => console.log(`#${a.id}  ${a.prenom} ${a.nom} <${a.email}>`));
    return;
  }

  const utilisateur = await Utilisateur.findOne({ where: { email } });
  if (!utilisateur || utilisateur.supprimeLe) {
    console.error(`❌ Aucun compte avec l'email ${email}. Crée d'abord le compte (app ou dashboard).`);
    process.exitCode = 1;
    return;
  }

  // tokenVersion + 1 : les sessions ouvertes se reconnectent avec les nouveaux droits
  await utilisateur.update({ estAdmin: !retirer, tokenVersion: utilisateur.tokenVersion + 1 });
  console.log(retirer
    ? `⛔ ${email} n'est plus administrateur.`
    : `✅ ${email} est administrateur. Connecte-toi au dashboard pour accéder à l'administration.`);
}

main()
  .catch(err => { console.error('❌', messageErreur(err)); process.exitCode = 1; })
  .finally(() => sequelize.close());
