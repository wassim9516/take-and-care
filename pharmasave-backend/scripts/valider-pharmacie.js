// ============================================================
// scripts/valider-pharmacie.js — Validation des pharmacies (admin)
// ============================================================
// Une pharmacie inscrite depuis le dashboard ne peut ni publier
// d'offres ni encaisser tant qu'elle n'est pas validée.
// Vérifie d'abord qu'il s'agit d'une vraie officine (n° FINESS,
// SIRET, appel au téléphone de la pharmacie…).
//
//   npm run valider-pharmacie              → liste les pharmacies en attente
//   npm run valider-pharmacie -- 12        → valide la pharmacie #12
//   npm run valider-pharmacie -- 12 --retirer → retire la validation
// ============================================================

require('dotenv').config();
const sequelize = require('../database/connection');
const { Pharmacie, Utilisateur } = require('../database/models');
const { executerMigrations } = require('../database/migrations');

async function main() {
  await sequelize.authenticate();
  await executerMigrations();

  const id = parseInt(process.argv[2]);
  const retirer = process.argv.includes('--retirer');

  if (!id) {
    const enAttente = await Pharmacie.findAll({
      where: { valide: false },
      include: [{ model: Utilisateur, as: 'pharmaciens', attributes: ['prenom', 'nom', 'email', 'telephone'] }],
      order: [['createdAt', 'ASC']],
    });
    if (enAttente.length === 0) {
      console.log('Aucune pharmacie en attente de validation.');
      return;
    }
    console.log(`${enAttente.length} pharmacie(s) en attente :\n`);
    for (const p of enAttente) {
      console.log(`#${p.id}  ${p.nom} — ${p.adresse} — tél. ${p.telephone || '?'} (inscrite le ${p.createdAt.toLocaleDateString('fr-FR')})`);
      for (const u of p.pharmaciens) {
        console.log(`      ${u.prenom} ${u.nom} <${u.email}> ${u.telephone || ''}`);
      }
    }
    console.log('\nPour valider : npm run valider-pharmacie -- <id>');
    return;
  }

  const pharmacie = await Pharmacie.findByPk(id);
  if (!pharmacie) {
    console.error(`❌ Pharmacie #${id} introuvable.`);
    process.exitCode = 1;
    return;
  }
  await pharmacie.update({ valide: !retirer });
  console.log(retirer
    ? `⛔ Validation retirée pour #${id} ${pharmacie.nom}.`
    : `✅ Pharmacie #${id} ${pharmacie.nom} validée.`);
}

main()
  .catch(err => { console.error('❌', err.message); process.exitCode = 1; })
  .finally(() => sequelize.close());
