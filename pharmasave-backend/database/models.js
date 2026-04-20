// ============================================================
// database/models.js — Définition des tables de la base de données
// ============================================================
// Chaque "Model" correspond à une table PostgreSQL.
// Sequelize crée automatiquement les tables au démarrage.
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('./connection');

// -------------------------------------------------------
// TABLE : utilisateurs
// -------------------------------------------------------
const Utilisateur = sequelize.define('Utilisateur', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  prenom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,   // Pas deux comptes avec le même email
    validate: { isEmail: true },
  },
  motDePasse: {
    type: DataTypes.STRING,
    allowNull: false,
    // Stocké hashé avec bcrypt — jamais en clair
  },
  telephone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pushToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Lien optionnel vers une pharmacie (null = client normal, valeur = pharmacien)
  pharmacieId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
}, { tableName: 'utilisateurs' });

// -------------------------------------------------------
// TABLE : pharmacies
// -------------------------------------------------------
const Pharmacie = sequelize.define('Pharmacie', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  adresse: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telephone: {
    type: DataTypes.STRING,
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  image: {
    type: DataTypes.STRING,
  },
  horaires: {
    type: DataTypes.STRING,
  },
  note: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
}, { tableName: 'pharmacies' });

// -------------------------------------------------------
// TABLE : offres
// -------------------------------------------------------
const Offre = sequelize.define('Offre', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  titre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  // Tableau de produits stocké en JSON
  produits: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  prixOriginal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  prixReduit: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  quantiteDisponible: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  datePeremption: {
    type: DataTypes.DATEONLY,
  },
  categorie: {
    type: DataTypes.STRING,
  },
  image: {
    type: DataTypes.STRING,
  },
  heureRetrait: {
    type: DataTypes.STRING,
  },
  actif: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Clé étrangère vers la pharmacie
  pharmacieId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, { tableName: 'offres' });

// -------------------------------------------------------
// TABLE : reservations
// -------------------------------------------------------
const Reservation = sequelize.define('Reservation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Numéro unique affiché à l'utilisateur (ex: RES-1234567)
  numero: {
    type: DataTypes.STRING,
    unique: true,
  },
  statut: {
    type: DataTypes.ENUM('confirmee', 'retiree', 'annulee'),
    defaultValue: 'confirmee',
  },
  prixPaye: {
    type: DataTypes.FLOAT,
  },
  // Clés étrangères
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  offreId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, { tableName: 'reservations' });

// -------------------------------------------------------
// TABLE : favoris
// -------------------------------------------------------
const Favori = sequelize.define('Favori', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  utilisateurId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  offreId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, { tableName: 'favoris' });

// -------------------------------------------------------
// RELATIONS entre les tables
// -------------------------------------------------------
// Une pharmacie a plusieurs offres
Pharmacie.hasMany(Offre, { foreignKey: 'pharmacieId', as: 'offres' });
Offre.belongsTo(Pharmacie, { foreignKey: 'pharmacieId', as: 'pharmacie' });

// Un pharmacien (Utilisateur avec pharmacieId) appartient à une pharmacie
Utilisateur.belongsTo(Pharmacie, { foreignKey: 'pharmacieId', as: 'pharmacie' });
Pharmacie.hasMany(Utilisateur, { foreignKey: 'pharmacieId', as: 'pharmaciens' });

// Un utilisateur a plusieurs réservations
Utilisateur.hasMany(Reservation, { foreignKey: 'utilisateurId', as: 'reservations' });
Reservation.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'utilisateur' });

// Une offre a plusieurs réservations
Offre.hasMany(Reservation, { foreignKey: 'offreId', as: 'reservations' });
Reservation.belongsTo(Offre, { foreignKey: 'offreId', as: 'offre' });

// Un utilisateur a plusieurs favoris
Utilisateur.hasMany(Favori, { foreignKey: 'utilisateurId', as: 'favoris' });
Favori.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'utilisateur' });

// Une offre peut être dans plusieurs favoris
Offre.hasMany(Favori, { foreignKey: 'offreId', as: 'favoris' });
Favori.belongsTo(Offre, { foreignKey: 'offreId', as: 'offre' });

module.exports = { Utilisateur, Pharmacie, Offre, Reservation, Favori };
