// ============================================================
// data/mockData.js — Données de test (fausses données)
// ============================================================
// Ces données simulent une base de données.
// Plus tard, tu pourras remplacer ça par une vraie DB
// (ex: SQLite, PostgreSQL) sans changer les routes.
// ============================================================

// Liste des pharmacies fictives (avec coordonnées GPS réelles de Paris)
const pharmacies = [
  {
    id: 1,
    nom: 'Pharmacie du Marché',
    adresse: '12 Rue du Commerce, 75015 Paris',
    telephone: '01 45 78 12 34',
    latitude: 48.8549,
    longitude: 2.3304,
    // Note : "distance" est calculée dynamiquement selon la position de l'utilisateur
    // Ici c'est une valeur par défaut pour les tests
    image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400',
    horaires: 'Lun-Sam 8h30-20h, Dim 9h-13h',
    note: 4.5,
  },
  {
    id: 2,
    nom: 'Pharmacie du Soleil',
    adresse: '12 Rue du Commerce, 75015 Paris',
    telephone: '01 45 78 12 34',
    latitude: 48.8462,
    longitude: 2.2942,
    // Note : "distance" est calculée dynamiquement selon la position de l'utilisateur
    // Ici c'est une valeur par défaut pour les tests
    image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400',
    horaires: 'Lun-Sam 8h30-20h, Dim 9h-13h',
    note: 4.5,
  },
  {
    id: 3,
    nom: 'Grande Pharmacie Centrale',
    adresse: '8 Avenue de la République, 75011 Paris',
    telephone: '01 43 55 22 11',
    latitude: 48.8632,
    longitude: 2.3731,
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400',
    horaires: 'Lun-Ven 8h-21h, Sam 9h-19h',
    note: 4.2,
  },
  {
    id: 4,
    nom: 'Pharmacie Bien-Être',
    adresse: '34 Rue de Rivoli, 75004 Paris',
    telephone: '01 42 71 45 90',
    latitude: 48.8553,
    longitude: 2.3516,
    image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
    horaires: 'Lun-Sam 9h-20h',
    note: 4.8,
  },
];

// Liste des offres/paniers disponibles
// Chaque offre représente un lot de produits proches de leur date de péremption
const offers = [
  {
    id: 1,
    pharmacieId: 1,        // Référence vers la pharmacie
    pharmacieNom: 'Pharmacie du Marché',
    titre: 'Panier Soin Visage',
    description: 'Lot de crèmes hydratantes et sérums de qualité. Produits proches de la date de péremption mais parfaitement utilisables.',
    produits: [
      'Crème hydratante Vichy 50ml',
      'Sérum anti-âge Avène 30ml',
      'Gel nettoyant Bioderma 200ml',
    ],
    // Prix original (total si achetés séparément)
    prixOriginal: 45.00,
    // Prix réduit proposé par la pharmacie
    prixReduit: 15.00,
    quantiteDisponible: 3,  // Nombre de paniers restants
    datePeremption: '2025-04-30',
    categorie: 'soin_visage',  // Catégories possibles : soin_visage, soin_corps, complement, bebe, solaire
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',
    heureRetrait: '17h00 - 19h30',
    actif: true,
  },
  {
    id: 2,
    pharmacieId: 1,
    pharmacieNom: 'Pharmacie du Marché',
    titre: 'Panier Solaire',
    description: 'Produits solaires de fin de saison. Parfaits pour un départ en vacances ou pour anticiper l\'été prochain.',
    produits: [
      'Crème solaire SPF 50 Ambre Solaire 200ml',
      'Après-soleil Garnier 250ml',
      'Brume fraîche SPF 30 100ml',
    ],
    prixOriginal: 38.00,
    prixReduit: 12.00,
    quantiteDisponible: 5,
    datePeremption: '2025-06-15',
    categorie: 'solaire',
    image: 'https://images.unsplash.com/photo-1521302200778-33500795e128?w=400',
    heureRetrait: '16h00 - 19h00',
    actif: true,
  },
  {
    id: 3,
    pharmacieId: 2,
    pharmacieNom: 'Grande Pharmacie Centrale',
    titre: 'Panier Compléments Alimentaires',
    description: 'Vitamines et compléments alimentaires. Idéal pour un boost d\'énergie ou renforcer son immunité.',
    produits: [
      'Vitamine C 1000mg (30 comprimés)',
      'Magnésium + B6 (45 comprimés)',
      'Oméga-3 (30 capsules)',
    ],
    prixOriginal: 32.00,
    prixReduit: 10.00,
    quantiteDisponible: 2,
    datePeremption: '2025-05-20',
    categorie: 'complement',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
    heureRetrait: '18h00 - 20h30',
    actif: true,
  },
  {
    id: 4,
    pharmacieId: 3,
    pharmacieNom: 'Pharmacie Bien-Être',
    titre: 'Panier Soin Corps Premium',
    description: 'Huiles et crèmes corps de grandes marques. Une occasion rare à prix réduit.',
    produits: [
      'Huile sèche Nuxe 100ml',
      'Lait corps Mustela 300ml',
      'Baume lèvres Caudalie (x2)',
    ],
    prixOriginal: 52.00,
    prixReduit: 18.00,
    quantiteDisponible: 1,
    datePeremption: '2025-05-10',
    categorie: 'soin_corps',
    image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400',
    heureRetrait: '17h30 - 19h30',
    actif: true,
  },
  {
    id: 5,
    pharmacieId: 2,
    pharmacieNom: 'Grande Pharmacie Centrale',
    titre: 'Panier Bébé & Maternité',
    description: 'Produits de soin pour bébé des meilleures marques. Doux et testés dermatologiquement.',
    produits: [
      'Liniment Biolane 400ml',
      'Crème change Mustela 150ml',
      'Eau micellaire bébé 500ml',
    ],
    prixOriginal: 28.00,
    prixReduit: 9.00,
    quantiteDisponible: 4,
    datePeremption: '2025-07-01',
    categorie: 'bebe',
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
    heureRetrait: '09h00 - 12h00',
    actif: true,
  },
];

module.exports = { pharmacies, offers };
