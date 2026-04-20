// ============================================================
// database/connection.js — Connexion à PostgreSQL via Sequelize
// ============================================================

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host:    process.env.DB_HOST,
    port:    process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Passe à true pour voir les requêtes SQL dans le terminal
  }
);

module.exports = sequelize;
