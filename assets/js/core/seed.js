const DAY = 86400000;
const daysAgo = n => new Date(Date.now() - n * DAY).toISOString();

export const SEED_CATEGORIES = [
  { id: 'cat-traiteur', slug: 'traiteur', name: 'Traiteur & Restauration', icon: 'fork' },
  { id: 'cat-decoration', slug: 'decoration', name: 'Décoration', icon: 'flower' },
  { id: 'cat-photo', slug: 'photo-video', name: 'Photo & Vidéo', icon: 'camera' },
  { id: 'cat-dj', slug: 'dj-sonorisation', name: 'DJ & Sonorisation', icon: 'music' },
  { id: 'cat-salle', slug: 'salles-lieux', name: 'Salles & Lieux', icon: 'building' },
  { id: 'cat-location', slug: 'location-materiel', name: 'Location de matériel', icon: 'chair' },
  { id: 'cat-wedding', slug: 'wedding-planner', name: 'Wedding Planner', icon: 'rings' },
  { id: 'cat-animation', slug: 'animation', name: 'Animation & MC', icon: 'mic' },
];

export const SEED_USERS = [
  { id: 'u-client', fullName: 'Afi Mensah', email: 'client@demo.tg', phone: '+228 90 11 22 33', role: 'client', createdAt: daysAgo(45) },
  { id: 'u-kossi', fullName: 'Kossi Amevor', email: 'kossi@example.tg', phone: '+228 91 44 55 66', role: 'client', createdAt: daysAgo(38) },
  { id: 'u-ayaba', fullName: 'Ayaba Kpodar', email: 'ayaba@example.tg', phone: '+228 92 77 88 99', role: 'client', createdAt: daysAgo(21) },
  { id: 'u-presta', fullName: 'Kokou Aïvodji', email: 'prestataire@demo.tg', phone: '+228 90 55 66 77', role: 'prestataire', createdAt: daysAgo(60) },
  { id: 'u-admin', fullName: 'Équipe Eventis', email: 'admin@demo.tg', phone: '+228 70 00 00 00', role: 'admin', createdAt: daysAgo(90) },
];

// 10 prestataires — 3 vérifiés (isVerified). MC rattaché à la catégorie animation.
export const SEED_PROVIDERS = [
  { id: 'p-saveurs', ownerId: 'u-presta', businessName: 'Saveurs d’Atakpamé', categoryId: 'cat-traiteur',
    description: 'Cuisine togolaise et internationale pour mariages, baptêmes et séminaires. Menus sur mesure, service traiteur complet de la préparation au dressage.',
    city: 'Lomé', quarter: 'Bè', phone: '+228 90 55 66 77', whatsapp: '+228 90 55 66 77',
    priceFrom: 250000, priceTo: 2500000, coverUrl: '/assets/img/providers/saveurs-d-atakpame.jpg',
    gallery: [], status: 'approved', isVerified: true, createdAt: daysAgo(58) },
  { id: 'p-fiore', ownerId: 'u-own-fiore', businessName: 'Élégance & Fiore', categoryId: 'cat-decoration',
    description: 'Scénographie florale et décoration d’événements : arches, tables d’honneur, éclairage d’ambiance et art de la table.',
    city: 'Lomé', quarter: 'Agbalépédogan', phone: '+228 93 12 34 56', whatsapp: '+228 93 12 34 56',
    priceFrom: 150000, priceTo: 1800000, coverUrl: '/assets/img/providers/elegance-fiore.jpg',
    gallery: [], status: 'approved', isVerified: true, createdAt: daysAgo(41) },
  { id: 'p-lumen', ownerId: 'u-own-lumen', businessName: 'Lumen Studio', categoryId: 'cat-photo',
    description: 'Photographie et vidéo d’événements : reportage mariage, drone, livre photo et même-minute. Équipe de 4 photographes.',
    city: 'Lomé', quarter: 'Tokoin', phone: '+228 96 22 44 88', whatsapp: '+228 96 22 44 88',
    priceFrom: 180000, priceTo: 900000, coverUrl: '/assets/img/providers/lumen-studio.jpg',
    gallery: [], status: 'approved', isVerified: true, createdAt: daysAgo(35) },
  { id: 'p-kroll', ownerId: 'u-own-kroll', businessName: 'DJ K-Roll Sound', categoryId: 'cat-dj',
    description: 'DJ professionnel, sonorisation et éclairage scénique pour soirées privées, mariages et événements corporate.',
    city: 'Lomé', quarter: 'Adidogomé', phone: '+228 97 33 55 11', whatsapp: '+228 97 33 55 11',
    priceFrom: 120000, priceTo: 600000, coverUrl: '/assets/img/providers/dj-kroll.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(30) },
  { id: 'p-baobab', ownerId: 'u-own-baobab', businessName: 'Espace Le Baobab', categoryId: 'cat-salle',
    description: 'Salle des fêtes climatisée de 300 places avec parking, cuisine équipée et espace extérieur pour cérémonies laïques.',
    city: 'Lomé', quarter: 'Agoè', phone: '+228 91 66 22 44', whatsapp: '+228 91 66 22 44',
    priceFrom: 400000, priceTo: 1200000, coverUrl: '/assets/img/providers/espace-baobab.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(26) },
  { id: 'p-loca', ownerId: 'u-own-loca', businessName: 'LocaFête', categoryId: 'cat-location',
    description: 'Location de chaises, tables, barnums, nappes et vaisselle pour tous vos événements. Livraison dans tout Grand Lomé.',
    city: 'Lomé', quarter: 'Hédzranawoé', phone: '+228 92 88 44 22', whatsapp: '+228 92 88 44 22',
    priceFrom: 50000, priceTo: 800000, coverUrl: '/assets/img/providers/locafete.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(22) },
  { id: 'p-nkonou', ownerId: 'u-own-nkonou', businessName: 'N’Konou Events', categoryId: 'cat-wedding',
    description: 'Wedding planner : coordination du jour J, recherche de prestataires, budget et planning. Mariages clés en main.',
    city: 'Lomé', quarter: 'Agoè', phone: '+228 94 11 33 77', whatsapp: '+228 94 11 33 77',
    priceFrom: 300000, priceTo: 2000000, coverUrl: '/assets/img/providers/nkonou-events.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(18) },
  { id: 'p-agbe', ownerId: 'u-own-agbe', businessName: 'Agbé Animation', categoryId: 'cat-animation',
    description: 'Animation de soirées : jeux, danse traditionnelle et moderne, mascottes et shows pour enfants.',
    city: 'Lomé', quarter: 'Bè', phone: '+228 95 44 88 22', whatsapp: '+228 95 44 88 22',
    priceFrom: 100000, priceTo: 500000, coverUrl: '/assets/img/providers/agbe-animation.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(15) },
  { id: 'p-voix', ownerId: 'u-own-voix', businessName: 'Voix d’Or MC', categoryId: 'cat-animation',
    description: 'Maître de cérémonie bilingue français-ewé, animation de mariages, galas et conférences.',
    city: 'Lomé', quarter: 'Tokoin', phone: '+228 98 55 11 99', whatsapp: '+228 98 55 11 99',
    priceFrom: 80000, priceTo: 400000, coverUrl: '/assets/img/providers/voix-d-or.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(10) },
  { id: 'p-gourmand', ownerId: 'u-own-gourmand', businessName: 'Le Gourmand d’Or', categoryId: 'cat-traiteur',
    description: 'Pâtisserie de cérémonie : pièces montées, gâteaux d’anniversaire personnalisés et buffets sucrés.',
    city: 'Lomé', quarter: 'Adidogomé', phone: '+228 90 99 88 77', whatsapp: '+228 90 99 88 77',
    priceFrom: 60000, priceTo: 700000, coverUrl: '/assets/img/providers/gourmand-or.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(6) },
];

export const SEED_SERVICES = [
  { id: 's1', providerId: 'p-saveurs', label: 'Buffet mariage (par personne)', description: 'Entrée, plat, dessert, boissons', price: 4500 },
  { id: 's2', providerId: 'p-saveurs', label: 'Cocktail d’entreprise (par personne)', description: 'Bouchées salées et sucrées', price: 3500 },
  { id: 's3', providerId: 'p-saveurs', label: 'Dîner de gala (par personne)', description: 'Service à table, 3 plats', price: 6000 },
  { id: 's4', providerId: 'p-fiore', label: 'Décoration florale complète', description: 'Arche, tables d’honneur, allée centrale', price: 450000 },
  { id: 's5', providerId: 'p-fiore', label: 'Art de la table', description: 'Nappage, vaisselle, centres de table', price: 180000 },
  { id: 's6', providerId: 'p-lumen', label: 'Reportage photo journée', description: '2 photographes, 300 photos retouchées', price: 350000 },
  { id: 's7', providerId: 'p-lumen', label: 'Vidéo + drone', description: 'Film 10 min + séquences drone', price: 500000 },
  { id: 's8', providerId: 'p-kroll', label: 'Prestation DJ soirée', description: 'DJ + enceintes + micros, 6 h', price: 250000 },
  { id: 's9', providerId: 'p-baobab', label: 'Location salle (journée)', description: '300 places, climatisation, parking', price: 800000 },
  { id: 's10', providerId: 'p-loca', label: 'Chaise pliante (unité)', description: 'Livraison incluse dès 50 unités', price: 500 },
  { id: 's11', providerId: 'p-nkonou', label: 'Coordination jour J', description: 'Accompagnement complet du mariage', price: 650000 },
  { id: 's12', providerId: 'p-agbe', label: 'Animation soirée (4 h)', description: 'Jeux, danse, animation micro', price: 200000 },
  { id: 's13', providerId: 'p-voix', label: 'Maître de cérémonie', description: 'Cérémonie laïque + soirée', price: 150000 },
  { id: 's14', providerId: 'p-gourmand', label: 'Pièce montée', description: 'À partir de, sur devis selon étages', price: 120000 },
];

export const SEED_REQUESTS = [
  { id: 'r1', clientId: 'u-client', providerId: 'p-lumen', eventType: 'mariage', eventDate: daysAgo(-20), guests: 250,
    budget: 600000, message: 'Bonjour, nous cherchons un photographe pour notre mariage le 2 novembre à Agoè.', status: 'closed', createdAt: daysAgo(12), updatedAt: daysAgo(2) },
  { id: 'r2', clientId: 'u-client', providerId: 'p-fiore', eventType: 'mariage', eventDate: daysAgo(-35), guests: 250,
    budget: 500000, message: 'Nous souhaiterions un devis pour la décoration florale de notre cérémonie.', status: 'in_progress', createdAt: daysAgo(8), updatedAt: daysAgo(1) },
  { id: 'r3', clientId: 'u-client', providerId: 'p-kroll', eventType: 'anniversaire', eventDate: daysAgo(-10), guests: 80,
    budget: 250000, message: 'Soirée anniversaire le 24 octobre, recherche DJ avec sono et lumières.', status: 'sent', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { id: 'r4', clientId: 'u-kossi', providerId: 'p-saveurs', eventType: 'bapteme', eventDate: daysAgo(-15), guests: 120,
    budget: 800000, message: 'Baptême le 18 octobre à Bè, buffet pour 120 personnes. Merci de nous faire un devis.', status: 'sent', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

export const SEED_MESSAGES = [
  { id: 'm1', requestId: 'r1', senderId: 'u-client', body: 'Bonjour, nous cherchons un photographe pour notre mariage le 2 novembre à Agoè.', readAt: daysAgo(11), createdAt: daysAgo(12) },
  { id: 'm2', requestId: 'r1', senderId: 'u-own-lumen', body: 'Bonjour ! Nous sommes disponibles. Reportage photo + drone : 750 000 FCFA. Nous pouvons nous rencontrer cette semaine.', readAt: daysAgo(10), createdAt: daysAgo(11) },
  { id: 'm3', requestId: 'r1', senderId: 'u-client', body: 'Parfait, nous acceptons. Rendez-vous jeudi 18 h à notre domicile.', readAt: daysAgo(9), createdAt: daysAgo(10) },
  { id: 'm4', requestId: 'r2', senderId: 'u-client', body: 'Nous souhaiterions un devis pour la décoration florale de notre cérémonie.', readAt: daysAgo(7), createdAt: daysAgo(8) },
  { id: 'm5', requestId: 'r2', senderId: 'u-own-fiore', body: 'Bonjour, merci pour votre demande. Nous vous envoyons notre catalogue fleurs et un devis sous 48 h.', readAt: daysAgo(1), createdAt: daysAgo(7) },
  { id: 'm6', requestId: 'r3', senderId: 'u-client', body: 'Soirée anniversaire le 24 octobre, recherche DJ avec sono et lumières.', readAt: null, createdAt: daysAgo(2) },
  { id: 'm7', requestId: 'r4', senderId: 'u-kossi', body: 'Baptême le 18 octobre à Bè, buffet pour 120 personnes. Merci de nous faire un devis.', readAt: null, createdAt: daysAgo(1) },
  { id: 'm8', requestId: 'r2', senderId: 'u-own-fiore', body: 'Bonjour, voici notre catalogue 2026. N’hésitez pas à nous dire vos préférences de couleurs.', readAt: null, createdAt: daysAgo(0) },
];

export const SEED_REVIEWS = [
  { id: 'v1', requestId: 'r1', clientId: 'u-client', providerId: 'p-lumen', rating: 5,
    comment: 'Travail remarquable, photos magnifiques et livrées rapidement. Équipe discrète et professionnelle.', visible: true, createdAt: daysAgo(2) },
  { id: 'v2', requestId: null, clientId: 'u-ayaba', providerId: 'p-saveurs', rating: 5,
    comment: 'Buffet excellent pour notre séminaire, ponctuels et très organisés.', visible: true, createdAt: daysAgo(9) },
  { id: 'v3', requestId: null, clientId: 'u-kossi', providerId: 'p-saveurs', rating: 4,
    comment: 'Très bon traiteur, seul bémol : un léger retard de livraison des chaises.', visible: true, createdAt: daysAgo(20) },
  { id: 'v4', requestId: null, clientId: 'u-ayaba', providerId: 'p-fiore', rating: 5,
    comment: 'Une décoration de rêve, nos invités en parlent encore !', visible: true, createdAt: daysAgo(5) },
  { id: 'v5', requestId: null, clientId: 'u-client', providerId: 'p-fiore', rating: 5,
    comment: 'Écoute et conseils excellents, devis clair et respecté.', visible: true, createdAt: daysAgo(3) },
];

// Profils synthétiques des propriétaires de prestataires (pas de compte de connexion).
export function seedState() {
  const owners = SEED_PROVIDERS.map((p, i) => ({
    id: p.ownerId, fullName: `Gérant·e ${p.businessName}`, email: `contact${i}@example.tg`,
    phone: p.phone, role: 'prestataire', createdAt: p.createdAt,
  }));
  return {
    users: [...SEED_USERS, ...owners],
    categories: SEED_CATEGORIES.map(c => ({ ...c, active: c.active !== false })),
    providers: SEED_PROVIDERS.map(p => ({ ...p })),
    services: SEED_SERVICES.map(s => ({ ...s })),
    requests: SEED_REQUESTS.map(r => ({ ...r })),
    messages: SEED_MESSAGES.map(m => ({ ...m })),
    reviews: SEED_REVIEWS.map(v => ({ ...v })),
    contactMessages: [],
    seededAt: new Date().toISOString(),
  };
}
