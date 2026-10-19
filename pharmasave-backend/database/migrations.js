// ============================================================
// database/migrations.js — Mises à jour du schéma au démarrage
// ============================================================
// sequelize.sync() crée les tables manquantes mais n'ajoute jamais
// de colonne à une table existante. Chaque migration ci-dessous est
// idempotente : elle vérifie l'état de la base avant d'agir, donc
// elle peut tourner à chaque démarrage sans risque.
// Pour un nouveau champ : ajoute-le dans models.js ET ici.
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('./connection');

async function colonneExiste(table, colonne) {
  const description = await sequelize.getQueryInterface().describeTable(table);
  return Object.prototype.hasOwnProperty.call(description, colonne);
}

async function executerMigrations() {
  const qi = sequelize.getQueryInterface();

  // utilisateurs.tokenVersion — révocation des tokens au changement de mot de passe
  if (!(await colonneExiste('utilisateurs', 'tokenVersion'))) {
    await qi.addColumn('utilisateurs', 'tokenVersion', {
      type: DataTypes.INTEGER, allowNull: false, defaultValue: 0,
    });
    console.log('🛠  Migration : utilisateurs.tokenVersion ajoutée');
  }

  // pharmacies.valide — les pharmacies déjà en base sont considérées validées
  if (!(await colonneExiste('pharmacies', 'valide'))) {
    await qi.addColumn('pharmacies', 'valide', {
      type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await sequelize.query('UPDATE pharmacies SET valide = true');
    console.log('🛠  Migration : pharmacies.valide ajoutée (pharmacies existantes validées)');
  }

  // Emails en minuscules (sauf si cela créerait un doublon — à régler à la main)
  const [, resultat] = await sequelize.query(`
    UPDATE utilisateurs u SET email = lower(u.email)
    WHERE u.email <> lower(u.email)
      AND NOT EXISTS (
        SELECT 1 FROM utilisateurs v WHERE v.id <> u.id AND lower(v.email) = lower(u.email)
      )
  `);
  if (resultat?.rowCount) {
    console.log(`🛠  Migration : ${resultat.rowCount} email(s) passé(s) en minuscules`);
  }
}

module.exports = { executerMigrations };
