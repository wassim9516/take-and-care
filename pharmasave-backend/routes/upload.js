// ============================================================
// routes/upload.js — Upload d'images
// ============================================================

const express        = require('express');
const router         = express.Router();
const multer         = require('multer');
const path           = require('path');
const authMiddleware = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `offre-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    const typesAutorises = /jpeg|jpg|png|webp/;
    if (typesAutorises.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilise JPG, PNG ou WEBP.'));
    }
  },
});

// POST /api/upload — Upload une image, retourne l'URL publique
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erreur: 'Aucun fichier reçu.' });
  }
  const base = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const url  = `${base}/uploads/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;
