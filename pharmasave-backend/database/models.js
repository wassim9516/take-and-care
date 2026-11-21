// ============================================================
// database/models.js — Définition des tables de la base de données
// ============================================================
// Chaque "Model" correspond à une table PostgreSQL.
// Sequelize crée automatiquement les tables au démarrage.
// ============================================================

const { DataTypes } = require('sequelize');
const sequelize = require('./connection');
const { versStockage, versPublic } = require('../utils/images');

// Montant en euros stocké en NUMERIC(10,2) (pas d'erreurs d'arrondi des
// FLOAT). PostgreSQL renvoie les NUMERIC sous forme de texte : le getter
// les reconvertit en nombre pour l'API.
function champMontant(nom, options = {}) {
  return {
    type: DataTypes.DECIMAL(10, 2),
    ...options,
    get() {
      const v = this.getDataValue(nom);
      return v === null || v === undefined ? v : parseFloat(v);
    },
  };
}

// Image : chemin relatif en base, URL complète à la lecture (utils/images.js)
function champImage(nom) {
  return {
    type: DataTypes.STRING,
    get() { return versPublic(this.getDataValue(nom)); },
    set(valeur) { this.setDataValue(nom, versStockage(valeur)); },
  };
}

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
    // Toujours stocké en minuscules : Jean@x.fr et jean@x.fr = même compte
    set(valeur) {
      this.setDataValue('email', typeof valeur === 'string' ? valeur.trim().toLowerCase() : valeur);
    },
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
  // Notifications « nouvelle offre près de chez toi » (désactivables)
  notifOffres: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  // Position approximative (arrondie à ~1 km) envoyée par l'app avec le
  // push token, utilisée uniquement pour cibler les notifications
  notifLat: { type: DataTypes.FLOAT, allowNull: true },
  notifLng: { type: DataTypes.FLOAT, allowNull: true },
  // Administrateur Take & Care (validation des pharmacies) :
  // npm run admin -- <email>
  estAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Date de suppression du compte (les données personnelles sont alors
  // anonymisées ; la ligne reste pour l'historique des réservations)
  supprimeLe: { type: DataTypes.DATE, allowNull: true },
  // Lien optionnel vers une pharmacie (null = client normal, valeur = pharmacien)
  pharmacieId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  // Incrémenté à chaque changement de mot de passe : invalide les anciens tokens JWT
  tokenVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
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
  image: champImage('image'),
  horaires: {
    type: DataTypes.STRING,
  },
  note: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  stripeAccountId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Une pharmacie inscrite via le dashboard doit être validée par un admin
  // (scripts/valider-pharmacie.js) avant de publier des offres ou d'encaisser
  valide: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, { tableName: 'pharmacies' });

// Champs internes à ne jamais renvoyer dans les routes publiques
const PHARMACIE_CHAMPS_PRIVES = ['stripeAccountId'];

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
  prixOriginal: champMontant('prixOriginal', { allowNull: false }),
  prixReduit:   champMontant('prixReduit',   { allowNull: false }),
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
  image: champImage('image'),
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
  numero: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  // Note laissée par le client après retrait (1-5, null = pas encore noté)
  noteClient: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    validate: { min: 1, max: 5 },
  },
  // expiree = non retirée avant expireLe (voir utils/reservations.js)
  statut: {
    type: DataTypes.ENUM('confirmee', 'retiree', 'annulee', 'expiree'),
    defaultValue: 'confirmee',
  },
  // Date limite de retrait
  expireLe: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Rappel « pense à retirer ton panier » déjà envoyé
  rappelEnvoye: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  prixPaye: champMontant('prixPaye'),
  stripePaymentIntentId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  commission: champMontant('commission', { allowNull: true }),
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
}, {
  tableName: 'favoris',
  indexes: [
    { fields: ['utilisateurId', 'offreId'], unique: true },
  ],
});

// -------------------------------------------------------
// TABLE : codes_verification
// -------------------------------------------------------
// Codes envoyés par SMS ou email (inscription, changement de téléphone,
// mot de passe oublié). En base et non en mémoire : ils survivent à un
// redémarrage et fonctionnent avec plusieurs instances du serveur.
// Un code n'est jamais stocké en clair (hash SHA-256).
const CodeVerification = sequelize.define('CodeVerification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // 'inscription' | 'telephone' | 'reinitialisation'
  type:     { type: DataTypes.STRING, allowNull: false },
  // Téléphone normalisé ou email selon le type
  cle:      { type: DataTypes.STRING, allowNull: false },
  codeHash: { type: DataTypes.STRING, allowNull: false },
  essais:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  expireAt: { type: DataTypes.DATE, allowNull: false },
  // Données à appliquer une fois le code vérifié (ex. compte à créer)
  donnees:  { type: DataTypes.JSON, allowNull: true },
  // Limite d'envois : 3 par fenêtre de 10 minutes
  envois:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  fenetreDebut: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'codes_verification',
  indexes: [{ fields: ['type', 'cle'], unique: true }],
});

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
// RESTRICT : une réservation (éventuellement payée) ne doit jamais être
// effacée en cascade. Un compte supprimé est anonymisé, pas effacé.
Utilisateur.hasMany(Reservation, { foreignKey: 'utilisateurId', as: 'reservations', onDelete: 'RESTRICT' });
Reservation.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'utilisateur', onDelete: 'RESTRICT' });

// Une offre a plusieurs réservations
// RESTRICT : impossible de supprimer une offre qui a des réservations
// (le dashboard propose alors de la masquer)
Offre.hasMany(Reservation, { foreignKey: 'offreId', as: 'reservations', onDelete: 'RESTRICT' });
Reservation.belongsTo(Offre, { foreignKey: 'offreId', as: 'offre', onDelete: 'RESTRICT' });

// Un utilisateur a plusieurs favoris
Utilisateur.hasMany(Favori, { foreignKey: 'utilisateurId', as: 'favoris' });
Favori.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'utilisateur' });

// Une offre peut être dans plusieurs favoris
Offre.hasMany(Favori, { foreignKey: 'offreId', as: 'favoris' });
Favori.belongsTo(Offre, { foreignKey: 'offreId', as: 'offre' });

module.exports = { Utilisateur, Pharmacie, Offre, Reservation, Favori, CodeVerification, PHARMACIE_CHAMPS_PRIVES };
