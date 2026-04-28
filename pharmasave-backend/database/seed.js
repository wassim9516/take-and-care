// ============================================================
// database/seed.js — Remplit la BDD avec des données de test
// ============================================================
// Lance avec : node database/seed.js
// ⚠️  Efface et recrée toutes les données à chaque exécution
// ============================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const sequelize = require('./connection');
const { Pharmacie, Offre, Utilisateur } = require('./models');

async function seed() {
  try {
    console.log('Connexion à PostgreSQL...');
    await sequelize.authenticate();

    // Recrée les tables (force: true efface les données existantes)
    await sequelize.sync({ force: true });
    console.log('Tables créées.');

    // --- Pharmacies ---
    const pharmacies = await Pharmacie.bulkCreate([
      {
        nom: 'Pharmacie du Marché',
        adresse: '12 Rue du Commerce, 75015 Paris',
        telephone: '01 45 78 12 34',
        latitude: 48.8462,
        longitude: 2.2942,
        image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400',
        horaires: 'Lun-Sam 8h30-20h, Dim 9h-13h',
        note: 4.5,
      },
      {
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
        nom: 'Pharmacie Bien-Être',
        adresse: '34 Rue de Rivoli, 75004 Paris',
        telephone: '01 42 71 45 90',
        latitude: 48.8553,
        longitude: 2.3516,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Was2',
        adresse: '43 Rue des Saints-Pères, 75006 Paris',
        telephone: '01 45 00 00 00',
        latitude: 48.85497297070392,
        longitude: 2.330499169843346,
        image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 5.0,
      },
      {
        nom: 'Pharmacie du JoyBoyy',
        adresse: '39 Rue du Docteur Babinsky , 75018 Paris',
        telephone: '01 42 71 45 90',
        latitude: 48.901283772626776,
        longitude:  2.3334764683301743,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Boulette',
        adresse: '195 Bd Saint-Germain , 75006 Paris',
        telephone: '01 42 71 45 00',
        latitude: 48.85480738735371, 
        longitude:  2.3275161249686507,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Ed',
        adresse: '75 rue de Varenne , 75007 Paris',
        telephone: '01 42 71 45 01',
        latitude: 48.85575559150216, 
        longitude:  2.316708753345935,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Fafa',
        adresse: '32 Rue de Belleville , 75019 Paris',
        telephone: '01 42 71 45 02',
        latitude: 48.872517628250705, 
        longitude:  2.378866579641933,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Coco',
        adresse: '115 rue de la Glaciere , 75013 Paris',
        telephone: '01 42 71 45 03',
        latitude: 48.82739754770625, 
        longitude:  2.342350068870893,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie du Bizon',
        adresse: '9 B Rue Mechain , 75014 Paris',
        telephone: '01 42 71 45 04',
        latitude: 48.83545667689057, 
        longitude:  2.34003286557834,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Toto',
        adresse: '114 avenue du Maine , 75014 Paris',
        telephone: '01 42 71 45 05',
        latitude: 48.834624657264406, 
        longitude:  2.3239715459397217,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Mira',
        adresse: '73 avenue des Champs-Elysée , 75008 Paris',
        telephone: '01 42 71 45 06',
        latitude: 48.870817278400985, 
        longitude:  2.304195932150883,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Loco',
        adresse: '24 avenue de la Bourdonnais , 75007 Paris',
        telephone: '01 42 71 45 07',
        latitude: 48.858991711628065, 
        longitude:  2.2982756562083,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
      {
        nom: 'Pharmacie de Finesse',
        adresse: '193 rue Saint-Honoré , 75001 Paris',
        telephone: '01 42 71 45 08',
        latitude: 48.86471185513054, 
        longitude:  2.332283126898389,
        image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400',
        horaires: 'Lun-Sam 9h-20h',
        note: 4.8,
      },
    ]);

    // --- Offres ---
    await Offre.bulkCreate([
      {
        pharmacieId: pharmacies[0].id,
        titre: 'Panier Soin Visage',
        description: 'Lot de crèmes hydratantes et sérums de qualité.',
        produits: ['Crème hydratante Vichy 50ml', 'Sérum anti-âge Avène 30ml', 'Gel nettoyant Bioderma 200ml'],
        prixOriginal: 45.00,
        prixReduit: 15.00,
        quantiteDisponible: 3,
        datePeremption: '2027-04-30',
        categorie: 'soin_visage',
        image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400',
        heureRetrait: '17h00 - 19h30',
      },
      {
        pharmacieId: pharmacies[0].id,
        titre: 'Panier Solaire',
        description: 'Produits solaires de fin de saison.',
        produits: ['Crème solaire SPF 50 200ml', 'Après-soleil Garnier 250ml', 'Brume fraîche SPF 30 100ml'],
        prixOriginal: 38.00,
        prixReduit: 12.00,
        quantiteDisponible: 5,
        datePeremption: '2027-06-15',
        categorie: 'solaire',
        image: 'https://images.unsplash.com/photo-1521302200778-33500795e128?w=400',
        heureRetrait: '16h00 - 19h00',
      },
      {
        pharmacieId: pharmacies[1].id,
        titre: 'Panier Compléments Alimentaires',
        description: 'Vitamines et compléments alimentaires.',
        produits: ['Vitamine C 1000mg (30 cp)', 'Magnésium + B6 (45 cp)', 'Oméga-3 (30 capsules)'],
        prixOriginal: 32.00,
        prixReduit: 10.00,
        quantiteDisponible: 2,
        datePeremption: '2027-05-20',
        categorie: 'complement',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
        heureRetrait: '18h00 - 20h30',
      },
      {
        pharmacieId: pharmacies[2].id,
        titre: 'Panier Soin Corps Premium',
        description: 'Huiles et crèmes corps de grandes marques.',
        produits: ['Huile sèche Nuxe 100ml', 'Lait corps Mustela 300ml', 'Baume lèvres Caudalie x2'],
        prixOriginal: 52.00,
        prixReduit: 18.00,
        quantiteDisponible: 1,
        datePeremption: '2027-05-10',
        categorie: 'soin_corps',
        image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400',
        heureRetrait: '17h30 - 19h30',
      },
      {
        pharmacieId: pharmacies[1].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[4].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[5].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[6].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[7].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[8].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[9].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[10].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[11].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[12].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[13].id,
        titre: 'Panier Bébé & Maternité',
        description: 'Produits de soin pour bébé des meilleures marques.',
        produits: ['Liniment Biolane 400ml', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
      {
        pharmacieId: pharmacies[13].id,
        titre: 'Panier Bébé et chocolat',
        description: 'Produits de soin pour bébé des nike.',
        produits: ['LSD 50mg', 'Crème change Mustela 150ml', 'Eau micellaire bébé 500ml'],
        prixOriginal: 28.00,
        prixReduit: 9.00,
        quantiteDisponible: 4,
        datePeremption: '2027-07-01',
        categorie: 'bebe',
        image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400',
        heureRetrait: '09h00 - 12h00',
      },
    ]);

    // --- Comptes pharmaciens (un par pharmacie) ---
    const hash = await bcrypt.hash('pharma123', 10);
    await Utilisateur.bulkCreate([
      {
        prenom: 'Sophie',
        nom: 'Martin',
        email: 'pharmacie.marche@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 78 12 34',
        pharmacieId: pharmacies[0].id,
      },
      {
        prenom: 'Lucas',
        nom: 'Bernard',
        email: 'grande.pharmacie@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 43 55 22 11',
        pharmacieId: pharmacies[1].id,
      },
      {
        prenom: 'Emma',
        nom: 'Dubois',
        email: 'pharmacie.bienetre@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 42 71 45 90',
        pharmacieId: pharmacies[2].id,
      },
      {
        prenom: 'Was2',
        nom: 'Pharmacien',
        email: 'pharmacie.was2@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 00 00 00',
        pharmacieId: pharmacies[3].id,
      },
      {
        prenom: 'JoyBoy',
        nom: 'Pharmacien',
        email: 'pharmacie.joy@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 01 00',
        pharmacieId: pharmacies[4].id,
      },
      {
        prenom: 'Boulette',
        nom: 'Pharmacien',
        email: 'pharmacie.boul@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 02 00',
        pharmacieId: pharmacies[5].id,
      },
      {
        prenom: 'Ed',
        nom: 'Pharmacien',
        email: 'pharmacie.ed@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 03 00',
        pharmacieId: pharmacies[6].id,
      },
      {
        prenom: 'Fafa',
        nom: 'Pharmacien',
        email: 'pharmacie.faf@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 04 00',
        pharmacieId: pharmacies[7].id,
      },
      {
        prenom: 'Coco',
        nom: 'Pharmacien',
        email: 'pharmacie.coco@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 05 00',
        pharmacieId: pharmacies[8].id,
      },
      {
        prenom: 'Bizon',
        nom: 'Pharmacien',
        email: 'pharmacie.biz@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 06 00',
        pharmacieId: pharmacies[9].id,
      },
      {
        prenom: 'Toto',
        nom: 'Pharmacien',
        email: 'pharmacie.toto@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 07 00',
        pharmacieId: pharmacies[10].id,
      },
      {
        prenom: 'Mira',
        nom: 'Pharmacien',
        email: 'pharmacie.mira@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 08 00',
        pharmacieId: pharmacies[11].id,
      },
      {
        prenom: 'Loco',
        nom: 'Pharmacien',
        email: 'pharmacie.loco@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 09 00',
        pharmacieId: pharmacies[12].id,
      },
      {
        prenom: 'Finesse',
        nom: 'Pharmacien',
        email: 'pharmacie.finessse@takeandcare.fr',
        motDePasse: hash,
        telephone: '01 45 45 11 00',
        pharmacieId: pharmacies[13].id,
      },
    ]);

    console.log('');
    console.log('✅ Base de données remplie avec succès !');
    console.log('');
    console.log('Comptes pharmaciens créés (mot de passe : pharma123) :');
    console.log('  → pharmacie.marche@takeandcare.fr      (Pharmacie du Marché)');
    console.log('  → grande.pharmacie@takeandcare.fr      (Grande Pharmacie Centrale)');
    console.log('  → pharmacie.bienetre@takeandcare.fr    (Pharmacie Bien-Être)');
    console.log('  → pharmacie.was2@takeandcare.fr        (Pharmacie de Was2)');
    console.log('  → pharmacie.joy@takeandcare.fr        (Pharmacie de JoyBoy)');
    console.log('  → pharmacie.boul@takeandcare.fr        (Pharmacie de Boulette)');
    console.log('  → pharmacie.ed@takeandcare.fr        (Pharmacie de Ed)');
    console.log('  → pharmacie.faf@takeandcare.fr       (Pharmacie de Fafa)');
    console.log('  → pharmacie.coco@takeandcare.fr        (Pharmacie de Coco)');
    console.log('  → pharmacie.biz@takeandcare.fr       (Pharmacie de Bizon)');
    console.log('  → pharmacie.toto@takeandcare.fr        (Pharmacie de Toto)');
    console.log('  → pharmacie.mira@takeandcare.fr        (Pharmacie de Mira)');
    console.log('  → pharmacie.loco@takeandcare.fr        (Pharmacie de Loco)');
    console.log('  → pharmacie.finessse@takeandcare.fr       (Pharmacie de Finesse)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
}

seed();
