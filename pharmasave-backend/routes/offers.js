// ============================================================
// routes/offers.js — Routes liées aux offres (PostgreSQL)
// ============================================================

const express        = require('express');
const router         = express.Router();
const { Op }         = require('sequelize');
const { Offre, Pharmacie, Utilisateur, PHARMACIE_CHAMPS_PRIVES } = require('../database/models');
const authMiddleware = require('../middleware/auth');
const { pharmacienValide } = authMiddleware;
const { envoyerNotifications } = require('../utils/notifications');
const { validerImage, supprimerImage } = require('../utils/images');

const CATEGORIES_VALIDES = ['soin_visage', 'soin_corps', 'complement', 'bebe', 'solaire'];
const PRIX_MIN = 0.5;    // Minimum accepté par Stripe en EUR
const PRIX_MAX = 10000;

// Champs qu'un pharmacien peut définir sur une offre.
// id et pharmacieId sont exclus : ils ne doivent jamais venir du client.
const CHAMPS_OFFRE = [
  'titre', 'description', 'produits', 'prixOriginal', 'prixReduit',
  'quantiteDisponible', 'datePeremption', 'categorie', 'image',
  'heureRetrait', 'actif',
];

function champsAutorises(body) {
  return Object.fromEntries(
    CHAMPS_OFFRE.filter(c => body[c] !== undefined).map(c => [c, body[c]])
  );
}

// Valide et normalise les champs d'une offre.
// "existante" = offre actuelle en cas de modification (les règles portent
// sur le résultat final, ex. prixReduit ≤ prixOriginal).
// Retourne { erreur } ou { champs }.
function validerOffre(body, existante, pharmacieId) {
  const champs = champsAutorises(body);
  const final  = { ...(existante ? existante.toJSON() : {}), ...champs };

  if (typeof final.titre !== 'string' || final.titre.trim().length < 2 || final.titre.trim().length > 100) {
    return { erreur: 'Le titre de l\'offre est obligatoire (2 à 100 caractères).' };
  }
  if (champs.titre !== undefined) champs.titre = champs.titre.trim();

  if (champs.description !== undefined && champs.description !== null) {
    if (typeof champs.description !== 'string' || champs.description.length > 2000) {
      return { erreur: 'La description ne peut pas dépasser 2000 caractères.' };
    }
  }

  if (champs.produits !== undefined) {
    if (!Array.isArray(champs.produits) || champs.produits.length > 50 ||
        champs.produits.some(p => typeof p !== 'string' || p.length > 200)) {
      return { erreur: 'Liste de produits invalide (50 max, 200 caractères chacun).' };
    }
  }

  const prixOriginal = parseFloat(final.prixOriginal);
  const prixReduit   = parseFloat(final.prixReduit);
  if (!Number.isFinite(prixOriginal) || prixOriginal <= 0 || prixOriginal > PRIX_MAX) {
    return { erreur: 'Le prix original est obligatoire et doit être positif.' };
  }
  if (!Number.isFinite(prixReduit) || prixReduit < PRIX_MIN || prixReduit > PRIX_MAX) {
    return { erreur: `Le prix réduit doit être d'au moins ${PRIX_MIN.toFixed(2)} €.` };
  }
  if (prixReduit > prixOriginal) {
    return { erreur: 'Le prix réduit ne peut pas être supérieur au prix original.' };
  }
  if (champs.prixOriginal !== undefined) champs.prixOriginal = prixOriginal;
  if (champs.prixReduit   !== undefined) champs.prixReduit   = prixReduit;

  if (champs.quantiteDisponible !== undefined) {
    const q = Number(champs.quantiteDisponible);
    if (!Number.isInteger(q) || q < 0 || q > 1000) {
      return { erreur: 'La quantité doit être un nombre entier entre 0 et 1000.' };
    }
    champs.quantiteDisponible = q;
  }

  if (champs.datePeremption !== undefined) {
    if (champs.datePeremption === '' || champs.datePeremption === null) {
      champs.datePeremption = null;
    } else if (typeof champs.datePeremption !== 'string' ||
               !/^\d{4}-\d{2}-\d{2}$/.test(champs.datePeremption) ||
               isNaN(Date.parse(champs.datePeremption))) {
      return { erreur: 'Date de péremption invalide (format AAAA-MM-JJ).' };
    }
  }

  if (champs.categorie !== undefined && champs.categorie !== null &&
      !CATEGORIES_VALIDES.includes(champs.categorie)) {
    return { erreur: 'Catégorie invalide.' };
  }

  if (champs.heureRetrait !== undefined && champs.heureRetrait !== null &&
      (typeof champs.heureRetrait !== 'string' || champs.heureRetrait.length > 100)) {
    return { erreur: 'Heure de retrait invalide (100 caractères max).' };
  }

  if (champs.actif !== undefined && typeof champs.actif !== 'boolean') {
    return { erreur: 'Le champ actif doit être vrai ou faux.' };
  }

  const image = validerImage(champs.image, existante?.image, pharmacieId);
  if (!image.ok) return { erreur: 'Image invalide : utilise une image envoyée depuis le dashboard.' };
  if (image.valeur !== undefined) champs.image = image.valeur;

  return { champs };
}

// Infos pharmacie exposées publiquement avec une offre
const PHARMACIE_PUBLIQUE = { exclude: [...PHARMACIE_CHAMPS_PRIVES, 'valide'] };

// GET /api/offers — Offres actives des pharmacies validées, paginées
router.get('/', async (req, res) => {
  try {
    const limite = Math.min(Math.max(parseInt(req.query.limite) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const where = {
      actif: true,
      [Op.or]: [
        { datePeremption: null },
        { datePeremption: { [Op.gte]: aujourdhui } },
      ],
    };
    if (req.query.categorie) {
      if (!CATEGORIES_VALIDES.includes(req.query.categorie)) {
        return res.status(400).json({ erreur: 'Catégorie invalide.' });
      }
      where.categorie = req.query.categorie;
    }

    const { count, rows } = await Offre.findAndCountAll({
      where,
      include: [{
        model: Pharmacie, as: 'pharmacie',
        attributes: ['nom', 'adresse', 'latitude', 'longitude'],
        where: { valide: true },
        required: true,
      }],
      order: [['createdAt', 'DESC']],
      limit:  limite,
      offset,
    });

    const offres = rows.map(o => ({
      ...o.toJSON(),
      pharmacieNom: o.pharmacie?.nom,
      pharmacieLat: o.pharmacie?.latitude,
      pharmacieLng: o.pharmacie?.longitude,
    }));

    res.json({ offres, total: count, hasMore: offset + limite < count });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/offers/pharmacie/:pharmacieId — Offres d'une pharmacie (dashboard)
router.get('/pharmacie/:pharmacieId', async (req, res) => {
  const pharmacieId = parseInt(req.params.pharmacieId);
  if (!pharmacieId) return res.status(400).json({ erreur: 'Identifiant invalide.' });
  try {
    const offres = await Offre.findAll({
      where: { pharmacieId },
      include: [{ model: Pharmacie, as: 'pharmacie', attributes: ['nom', 'adresse'] }],
      order: [['createdAt', 'DESC']],
    });
    const resultat = offres.map(o => ({
      ...o.toJSON(),
      pharmacieNom: o.pharmacie?.nom,
    }));
    res.json(resultat);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/offers/:id — Détail d'une offre
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ erreur: 'Identifiant invalide.' });
  try {
    const offre = await Offre.findByPk(id, {
      include: [{
        model: Pharmacie, as: 'pharmacie',
        attributes: PHARMACIE_PUBLIQUE,
        where: { valide: true },
        required: true,
      }],
    });

    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });
    res.json({ ...offre.toJSON(), pharmacieNom: offre.pharmacie?.nom });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// POST /api/offers — Créer une offre (pharmacien d'une pharmacie validée)
router.post('/', authMiddleware, pharmacienValide, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;

  const { erreur, champs } = validerOffre(req.body, null, pharmacieId);
  if (erreur) return res.status(400).json({ erreur });

  try {
    const pharmacie = await Pharmacie.findByPk(pharmacieId);
    const offre = await Offre.create({ ...champs, pharmacieId });

    // Notifie tous les clients ayant un push token (hors pharmaciens)
    const utilisateurs = await Utilisateur.findAll({
      where: { pharmacieId: null, pushToken: { [Op.ne]: null } },
      attributes: ['pushToken'],
    });
    envoyerNotifications(
      utilisateurs.map(u => u.pushToken),
      '🛍️ Nouvelle offre disponible !',
      `${pharmacie?.nom} propose "${offre.titre}" à ${offre.prixReduit}€`,
      { offreId: offre.id }
    );

    res.status(201).json(offre);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// PUT /api/offers/:id — Modifier une offre
router.put('/:id', authMiddleware, pharmacienValide, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;
  try {
    const offre = await Offre.findByPk(parseInt(req.params.id) || 0);
    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });

    if (Number(offre.pharmacieId) !== Number(pharmacieId)) {
      return res.status(403).json({ erreur: 'Action non autorisée.' });
    }

    const { erreur, champs } = validerOffre(req.body, offre, pharmacieId);
    if (erreur) return res.status(400).json({ erreur });

    const ancienneImage = offre.image;
    await offre.update(champs);
    if (champs.image !== undefined && ancienneImage && champs.image !== ancienneImage) {
      supprimerImage(ancienneImage, pharmacieId);
    }
    res.json(offre);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// DELETE /api/offers/:id — Supprimer une offre + son image
router.delete('/:id', authMiddleware, async (req, res) => {
  const pharmacieId = req.utilisateur.pharmacieId;
  if (!pharmacieId) {
    return res.status(403).json({ erreur: 'Compte non lié à une pharmacie.' });
  }
  try {
    const offre = await Offre.findByPk(parseInt(req.params.id) || 0);
    if (!offre) return res.status(404).json({ erreur: 'Offre introuvable.' });

    if (Number(offre.pharmacieId) !== Number(pharmacieId)) {
      return res.status(403).json({ erreur: 'Action non autorisée.' });
    }

    const imageUrl = offre.image;
    await offre.destroy();
    supprimerImage(imageUrl, pharmacieId);
    res.json({ message: 'Offre supprimée.' });
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ erreur: 'Cette offre a des réservations : désactive-la plutôt que de la supprimer.' });
    }
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
