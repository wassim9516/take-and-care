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

const DUREE_RESERVATION_HEURES = parseInt(process.env.RESERVATION_DUREE_HEURES || '48', 10);

async function colonnes(table) {
  return sequelize.getQueryInterface().describeTable(table);
}

async function ajouterColonne(table, colonne, definition, apres) {
  const description = await colonnes(table);
  if (Object.prototype.hasOwnProperty.call(description, colonne)) return false;
  await sequelize.getQueryInterface().addColumn(table, colonne, definition);
  if (apres) await apres();
  console.log(`🛠  Migration : ${table}.${colonne} ajoutée`);
  return true;
}

// Remplace ON DELETE CASCADE par ON DELETE RESTRICT sur une clé étrangère
async function cleEtrangereRestrict(table, colonne, tableCible) {
  const [lignes] = await sequelize.query(`
    SELECT con.conname AS nom, con.confdeltype AS suppression
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.conrelid = :table::regclass AND con.contype = 'f' AND a.attname = :colonne
  `, { replacements: { table, colonne } });

  // 'r' = RESTRICT
  if (lignes.length === 1 && lignes[0].suppression === 'r') return;

  await sequelize.transaction(async (t) => {
    for (const { nom } of lignes) {
      await sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${nom}"`, { transaction: t });
    }
    await sequelize.query(
      `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${colonne}_fkey" FOREIGN KEY ("${colonne}")
       REFERENCES "${tableCible}" (id) ON UPDATE CASCADE ON DELETE RESTRICT`,
      { transaction: t }
    );
  });
  console.log(`🛠  Migration : ${table}.${colonne} → ON DELETE RESTRICT`);
}

// FLOAT → NUMERIC(10,2) pour les montants
async function colonneMontant(table, colonne) {
  const [[info]] = await sequelize.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = :table AND column_name = :colonne
  `, { replacements: { table, colonne } });
  if (!info || info.data_type === 'numeric') return;
  await sequelize.query(
    `ALTER TABLE "${table}" ALTER COLUMN "${colonne}" TYPE NUMERIC(10,2) USING round("${colonne}"::numeric, 2)`
  );
  console.log(`🛠  Migration : ${table}.${colonne} → NUMERIC(10,2)`);
}

async function executerMigrations() {
  // utilisateurs.tokenVersion — révocation des tokens au changement de mot de passe
  await ajouterColonne('utilisateurs', 'tokenVersion', {
    type: DataTypes.INTEGER, allowNull: false, defaultValue: 0,
  });

  // pharmacies.valide — les pharmacies déjà en base sont considérées validées
  await ajouterColonne('pharmacies', 'valide', {
    type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
  }, () => sequelize.query('UPDATE pharmacies SET valide = true'));

  // Notifications ciblées + suppression de compte
  await ajouterColonne('utilisateurs', 'notifOffres', {
    type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true,
  });
  await ajouterColonne('utilisateurs', 'notifLat', { type: DataTypes.FLOAT, allowNull: true });
  await ajouterColonne('utilisateurs', 'notifLng', { type: DataTypes.FLOAT, allowNull: true });
  await ajouterColonne('utilisateurs', 'supprimeLe', { type: DataTypes.DATE, allowNull: true });
  await ajouterColonne('utilisateurs', 'estAdmin', {
    type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
  });
  await ajouterColonne('reservations', 'rappelEnvoye', {
    type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,
  });

  // Statut « expiree » + date limite de retrait
  await sequelize.query(`ALTER TYPE "enum_reservations_statut" ADD VALUE IF NOT EXISTS 'expiree'`);
  await ajouterColonne('reservations', 'expireLe', { type: DataTypes.DATE, allowNull: true }, () =>
    sequelize.query(
      `UPDATE reservations SET "expireLe" = "createdAt" + (:heures || ' hours')::interval WHERE statut = 'confirmee'`,
      { replacements: { heures: String(DUREE_RESERVATION_HEURES) } }
    ));

  // Supprimer une offre ne doit plus effacer ses réservations
  await cleEtrangereRestrict('reservations', 'offreId', 'offres');
  await cleEtrangereRestrict('reservations', 'utilisateurId', 'utilisateurs');

  // Montants en NUMERIC
  await colonneMontant('offres', 'prixOriginal');
  await colonneMontant('offres', 'prixReduit');
  await colonneMontant('reservations', 'prixPaye');
  await colonneMontant('reservations', 'commission');

  // Images uploadées : URL absolue (avec l'ancienne IP) → chemin relatif
  for (const table of ['offres', 'pharmacies']) {
    const [, resultat] = await sequelize.query(`
      UPDATE "${table}" SET image = regexp_replace(image, '^https?://[^/]+(/uploads/)', '\\1')
      WHERE image ~ '^https?://[^/]+/uploads/'
    `);
    if (resultat?.rowCount) {
      console.log(`🛠  Migration : ${resultat.rowCount} image(s) de ${table} en chemin relatif`);
    }
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
