// ============================================================
// routes/admin.js — Administration Take & Care
// ============================================================
// Réservé aux comptes estAdmin (npm run admin -- <email>).
// Validation / suspension des pharmacies et chiffres clés.
// ============================================================

const express  = require('express');
const router   = express.Router();
const { Op, fn, col } = require('sequelize');
const authMiddleware = require('../middleware/auth');
const { adminSeulement } = authMiddleware;
const { Pharmacie, Utilisateur, Offre, Reservation } = require('../database/models');
const { envoyerEmail } = require('../utils/email');

router.use(authMiddleware, adminSeulement);

// GET /api/admin/pharmacies?statut=attente|validees|toutes
router.get('/pharmacies', async (req, res) => {
  const statut = req.query.statut || 'attente';
  const where = statut === 'attente' ? { valide: false }
    : statut === 'validees' ? { valide: true }
    : {};

  try {
    const pharmacies = await Pharmacie.findAll({
      where,
      attributes: { exclude: ['stripeAccountId'], include: [[fn('COUNT', col('offres.id')), 'nbOffres']] },
      include: [
        {
          model: Utilisateur, as: 'pharmaciens',
          attributes: ['id', 'prenom', 'nom', 'email', 'telephone', 'createdAt'],
          where: { supprimeLe: null },
          required: false,
        },
        { model: Offre, as: 'offres', attributes: [] },
      ],
      group: ['Pharmacie.id', 'pharmaciens.id'],
      order: [['createdAt', statut === 'attente' ? 'ASC' : 'DESC']],
    });
    res.json(pharmacies.map(p => ({ ...p.toJSON(), nbOffres: Number(p.get('nbOffres')) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// PATCH /api/admin/pharmacies/:id — Body : { valide: boolean, message? }
// Valide ou suspend une pharmacie et prévient le pharmacien par email.
router.patch('/pharmacies/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { valide } = req.body;
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 1000) : '';
  if (!id) return res.status(400).json({ erreur: 'Identifiant invalide.' });
  if (typeof valide !== 'boolean') return res.status(400).json({ erreur: 'valide doit être vrai ou faux.' });

  try {
    const pharmacie = await Pharmacie.findByPk(id, {
      include: [{ model: Utilisateur, as: 'pharmaciens', attributes: ['prenom', 'email'], where: { supprimeLe: null }, required: false }],
    });
    if (!pharmacie) return res.status(404).json({ erreur: 'Pharmacie introuvable.' });

    const changement = pharmacie.valide !== valide;
    await pharmacie.update({ valide });
    console.log(`🛡  Admin #${req.utilisateur.id} : pharmacie #${id} ${valide ? 'validée' : 'suspendue'}`);

    if (changement) {
      for (const p of pharmacie.pharmaciens || []) {
        const texte = valide
          ? `Bonjour ${p.prenom},\n\nBonne nouvelle : ${pharmacie.nom} est validée sur Take & Care. ` +
            `Tu peux maintenant publier tes paniers depuis ton tableau de bord.` +
            (message ? `\n\n${message}` : '') + `\n\nL'équipe Take & Care`
          : `Bonjour ${p.prenom},\n\n${pharmacie.nom} n'est plus visible sur Take & Care pour le moment.` +
            (message ? `\n\nMotif : ${message}` : '') +
            `\n\nRéponds à cet email pour toute question.\n\nL'équipe Take & Care`;
        envoyerEmail(p.email, valide ? 'Ta pharmacie est validée 🎉' : 'Ta pharmacie est suspendue', texte)
          .catch(err => console.error('Email admin :', err.message));
      }
    }

    res.json({ message: valide ? 'Pharmacie validée.' : 'Pharmacie suspendue.', pharmacie: { id, valide } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

// GET /api/admin/stats — Chiffres clés de la plateforme
router.get('/stats', async (req, res) => {
  try {
    const [clients, pharmaciesValidees, pharmaciesEnAttente, offresEnLigne, parStatut, encaisse] = await Promise.all([
      Utilisateur.count({ where: { pharmacieId: null, supprimeLe: null, estAdmin: false } }),
      Pharmacie.count({ where: { valide: true } }),
      Pharmacie.count({ where: { valide: false } }),
      Offre.count({ where: { actif: true, quantiteDisponible: { [Op.gt]: 0 } } }),
      Reservation.findAll({ attributes: ['statut', [fn('COUNT', col('id')), 'nb']], group: ['statut'], raw: true }),
      Reservation.findOne({
        attributes: [[fn('COALESCE', fn('SUM', col('prixPaye')), 0), 'volume'], [fn('COALESCE', fn('SUM', col('commission')), 0), 'commissions']],
        where: { statut: { [Op.in]: ['confirmee', 'retiree'] } },
        raw: true,
      }),
    ]);

    res.json({
      clients,
      pharmaciesValidees,
      pharmaciesEnAttente,
      offresEnLigne,
      reservations: Object.fromEntries(parStatut.map(r => [r.statut, Number(r.nb)])),
      volume:       parseFloat(encaisse.volume),
      commissions:  parseFloat(encaisse.commissions),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur.' });
  }
});

module.exports = router;
