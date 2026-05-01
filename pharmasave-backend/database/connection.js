// ============================================================
// database/connection.js — Connexion à PostgreSQL via Sequelize
// ============================================================
// En production (Railway) : utilise DATABASE_URL
// En développement local  : utilise les variables DB_* du .env

const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

if (process.env.DATABASE_URL) {
  // Mode Railway / production
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Requis pour Railway PostgreSQL
      },
    },
  });
} else {
  // Mode développement local
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host:    process.env.DB_HOST,
      port:    process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
    }
  );
}

module.exports = sequelize;
