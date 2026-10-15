import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from './helpers/memory-storage.js';
import { DemoAdapter } from '../assets/js/core/db.js';

const makeDb = () => new DemoAdapter(memoryStorage());

test('seed: 8 catégories, 10 prestataires publics approuvés', async () => {
  const db = makeDb();
  assert.equal((await db.listCategories()).length, 8);
  const list = await db.listProviders();
  assert.equal(list.length, 10);
  assert.ok(list.every(p => p.status === 'approved'));
});

test('listProviders: filtre catégorie + quartier + vérifiés + tri prix', async () => {
  const db = makeDb();
  const traiteurs = await db.listProviders({ category: 'cat-traiteur' });
  assert.equal(traiteurs.length, 2);
  const be = await db.listProviders({ quarter: 'Bè' });
  assert.ok(be.length >= 2 && be.every(p => p.quarter === 'Bè'));
  const verified = await db.listProviders({ verifiedOnly: true });
  assert.equal(verified.length, 3);
  assert.ok(verified.every(p => p.isVerified));
  const asc = await db.listProviders({ sort: 'prix-asc' });
  for (let i = 1; i < asc.length; i++) assert.ok(asc[i].priceFrom >= asc[i - 1].priceFrom);
});

test('listProviders: recherche texte et note minimale', async () => {
  const db = makeDb();
  const found = await db.listProviders({ q: 'gourmand' });
  assert.equal(found.length, 1);
  assert.equal(found[0].businessName, 'Le Gourmand d’Or');
  const rated = await db.listProviders({ minRating: 4.5 });
  assert.ok(rated.every(p => p.avgRating >= 4.5));
});

test('getProvider: services et note moyenne', async () => {
  const db = makeDb();
  const p = await db.getProvider('p-saveurs');
  assert.equal(p.services.length, 3);
  assert.equal(p.isVerified, true);
  assert.ok(p.avgRating >= 4);
});

test('cycle demande: création → message passe en cours → acceptée → clôturée', async () => {
  const db = makeDb();
  const r = await db.createRequest({ clientId: 'u-client', providerId: 'p-baobab', eventType: 'mariage',
    eventDate: '2026-12-01', guests: 200, budget: 900000, message: 'Test' });
  assert.equal(r.status, 'sent');
  await db.sendMessage({ requestId: r.id, senderId: 'u-own-baobab', body: 'Nous vérifions la date.' });
  assert.equal((await db.getRequest(r.id)).status, 'in_progress');
  await db.updateRequestStatus(r.id, { status: 'accepted', byRole: 'prestataire' });
  await db.updateRequestStatus(r.id, { status: 'closed', byRole: 'client' });
  assert.equal((await db.getRequest(r.id)).status, 'closed');
});

test('un tiers ne peut pas écrire dans les messages d\'une demande', async () => {
  const db = makeDb();
  await assert.rejects(() => db.sendMessage({ requestId: 'r1', senderId: 'u-kossi', body: 'intrus' }),
    /Non autorisé/);
});

test('refus exige un message du prestataire', async () => {
  const db = makeDb();
  await assert.rejects(() => db.updateRequestStatus('r3', { status: 'declined', byRole: 'prestataire' }));
  await db.sendMessage({ requestId: 'r3', senderId: 'u-own-kroll', body: 'Malheureusement indisponible.' });
  await db.updateRequestStatus('r3', { status: 'declined', byRole: 'prestataire' });
  assert.equal((await db.getRequest('r3')).status, 'declined');
});

test('messagerie: fils, non-lus, marqué lu', async () => {
  const db = makeDb();
  const threadsKroll = await db.listThreadsFor('u-own-kroll');
  const t = threadsKroll.find(x => x.request.id === 'r3');
  assert.equal(t.unreadCount, 1);
  assert.equal(t.counterparty.name, 'Afi Mensah');
  await db.markRequestRead('r3', 'u-own-kroll');
  assert.equal((await db.listThreadsFor('u-own-kroll')).find(x => x.request.id === 'r3').unreadCount, 0);
});

test('avis: visible=false par défaut, publication par admin, un seul avis par demande', async () => {
  const db = makeDb();
  const v = await db.createReview({ requestId: 'r1', clientId: 'u-client', rating: 5, comment: 'Super !' });
  assert.equal(v.visible, false);
  await db.setReviewVisible(v.id, true);
  const pub = await db.listReviewsForProvider('p-lumen');
  assert.ok(pub.some(x => x.id === v.id));
  await assert.rejects(() => db.createReview({ requestId: 'r1', clientId: 'u-client', rating: 4, comment: 'doublon' }));
  await assert.rejects(() => db.createReview({ requestId: 'r2', clientId: 'u-client', rating: 4, comment: 'pas clôturée' }));
});

// R22 — lecture des avis par leur auteur (« Mes avis », T12). Contrats verrouillés :
// l'auteur voit SES avis y compris non publiés (seule raison d'être de la section),
// un autre client ne les voit pas, tri createdAt décroissant, providerName joint,
// et un avis non publié ne fuite jamais côté public (listReviewsForProvider).
test('client: listReviewsForClient — auteur voit ses avis non publiés, pas les autres', async () => {
  const db = makeDb();
  // Graine : u-kossi n'a que v3 (publié) ; u-ayaba a v6 (non publié, le plus
  // récent : il y a 1 j), v4 puis v2 : tri décroissant et lecture d'un avis
  // non publié par son auteur vérifiés sans création.
  const kossiBefore = await db.listReviewsForClient('u-kossi');
  assert.deepEqual(kossiBefore.map(v => v.id), ['v3']);
  assert.equal(kossiBefore[0].providerName, 'Saveurs d’Atakpamé');
  const ayaba = await db.listReviewsForClient('u-ayaba');
  assert.deepEqual(ayaba.map(v => v.id), ['v6', 'v4', 'v2']);
  assert.equal(ayaba[0].visible, false, 'l\'auteur voit son avis non publié dès la graine');
  assert.deepEqual(await db.listReviewsForClient('u-nobody'), []);

  await db.updateRequestStatus('r4', { status: 'accepted', byRole: 'prestataire' });
  await db.updateRequestStatus('r4', { status: 'closed', byRole: 'client' });
  const v = await db.createReview({ requestId: 'r4', clientId: 'u-kossi',
    rating: 5, comment: 'Buffet excellent, tous les invités étaient ravis.' });

  const after = await db.listReviewsForClient('u-kossi');
  assert.equal(after.length, 2);
  assert.equal(after[0].id, v.id, 'tri createdAt décroissant : le plus récent en tête');
  assert.equal(after[0].visible, false, 'l\'auteur voit son avis non publié');
  assert.equal(after[0].providerName, 'Saveurs d’Atakpamé');
  for (const k of ['id', 'requestId', 'providerId', 'rating', 'comment', 'visible', 'createdAt', 'providerName']) {
    assert.ok(k in after[0], `champ manquant : ${k}`);
  }
  // Un autre client ne voit pas l'avis de Kossi.
  const other = await db.listReviewsForClient('u-client');
  assert.ok(!other.some(x => x.requestId === 'r4'));
  // Cœur de la tâche : tant que l'admin ne publie pas, la fiche publique ignore l'avis.
  assert.ok(!(await db.listReviewsForProvider('p-saveurs')).some(x => x.id === v.id));
  await db.setReviewVisible(v.id, true);
  assert.ok((await db.listReviewsForProvider('p-saveurs')).some(x => x.id === v.id));
});

test('admin: suspendre masque du public ; vérifier accorde le badge', async () => {
  const db = makeDb();
  await db.setProviderStatus('p-kroll', 'suspended');
  const pub = await db.listProviders();
  assert.ok(!pub.some(p => p.id === 'p-kroll'));
  await db.setProviderVerified('p-kroll', true);
  const admin = await db.listProvidersAdmin({});
  assert.equal(admin.find(p => p.id === 'p-kroll').isVerified, true);
});

test('stats et contact', async () => {
  const db = makeDb();
  const s = await db.getStats();
  assert.equal(s.providersPending, 0);
  assert.ok(s.signupsSeries.length === 30);
  await db.saveContactMessage({ name: 'Test', email: 't@t.tg', message: 'Bonjour' });
});

// Ruling R14 — listReviewsAdmin est consommé par la file de modération admin (T11).
// Verrouillés ici : contenu (v6 non publié, ruling R15), ordre (non publiés d'abord),
// tri createdAt décroissant à l'intérieur de chaque groupe, jointures de noms.
test('admin: listReviewsAdmin — non publiés d\'abord, tri date décroissante, noms joints', async () => {
  const db = makeDb();
  const all = await db.listReviewsAdmin();
  assert.equal(all.length, 6); // tous les avis de la graine, publiés ou non
  assert.ok(all.some(v => v.id === 'v6' && v.visible === false));
  const v6 = all.find(v => v.id === 'v6');
  assert.equal(v6.clientName, 'Ayaba Kpodar');
  assert.equal(v6.providerName, 'Lumen Studio');
  assert.equal(v6.requestId, null);
  assert.equal(v6.rating, 4);
  assert.equal(typeof v6.comment, 'string');
  // Champs conservés pour la modération (aucun perdu au passage).
  for (const k of ['id', 'requestId', 'clientId', 'providerId', 'rating', 'comment', 'visible', 'createdAt']) {
    assert.ok(k in v6, `champ manquant : ${k}`);
  }
  // File : les non publiés forment un bloc en tête, les publiés un bloc en suite.
  const unpublished = all.filter(v => !v.visible);
  const firstPublished = all.findIndex(v => v.visible);
  assert.equal(unpublished.length, firstPublished);
  assert.ok(all.slice(firstPublished).every(v => v.visible));
  // Tri createdAt décroissant dans chaque groupe.
  const sortedDesc = list => {
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].createdAt >= list[i].createdAt);
  };
  sortedDesc(all.slice(0, firstPublished));
  sortedDesc(all.slice(firstPublished));
  // Jointure aussi sur un avis publié et sur un avis rattaché à une demande.
  assert.equal(all.find(v => v.id === 'v1').providerName, 'Lumen Studio');
  assert.equal(all.find(v => v.id === 'v1').clientName, 'Afi Mensah');
  // Un avis publié masqué par l'admin rejoint la file en tête (non publiés d'abord),
  // à sa place dans le tri par date : v6 (il y a 1 j) reste devant v1 (il y a 2 j).
  await db.setReviewVisible('v1', false);
  assert.deepEqual((await db.listReviewsAdmin()).slice(0, 2).map(v => v.id), ['v6', 'v1']);
  // I4 — croisement ownerSuspended : suspendre le gérant de Lumen Studio masque
  // p-lumen du catalogue (drapeau porté par listProvidersAdmin) SANS toucher à
  // la file de modération, qui continue de nommer le prestataire.
  await db.setUserSuspended('u-own-lumen', true);
  assert.equal((await db.listProvidersAdmin({ status: 'approved' })).find(p => p.id === 'p-lumen').ownerSuspended, true);
  const afterOwner = await db.listReviewsAdmin();
  assert.equal(afterOwner.length, 6);
  assert.equal(afterOwner.find(v => v.id === 'v1').providerName, 'Lumen Studio');
  assert.ok(afterOwner.some(v => v.id === 'v6'));
  await db.setUserSuspended('u-own-lumen', false);
});

// Note M3 — plus strict que le brief EN DÉMO : aucun compte administrateur ne peut
// être suspendu. Le reste du test verrouille I4/R18 : la suspension du GÉRANT d'un
// prestataire approuvé le masque du catalogue public (chemin _ownerSuspended) et
// listProvidersAdmin expose le drapeau ownerSuspended consommé par la page admin.
test('admin: setUserSuspended refuse un administrateur ; gérant suspendu = masque public + ownerSuspended', async () => {
  const db = makeDb();
  await assert.rejects(() => db.setUserSuspended('u-admin', true),
    /Un administrateur ne peut pas être suspendu\./);
  assert.equal((await db.listUsersAdmin()).find(u => u.id === 'u-admin').suspended, false);
  // Client simple (pas de fiche) : suspendable/réactivable, sans effet catalogue.
  await db.setUserSuspended('u-kossi', true);
  assert.equal((await db.listUsersAdmin()).find(u => u.id === 'u-kossi').suspended, true);
  await db.setUserSuspended('u-kossi', false);
  assert.equal((await db.listUsersAdmin()).find(u => u.id === 'u-kossi').suspended, false);
  // Gérant réel de la graine : u-own-lumen owns p-lumen (statut approuvé).
  assert.equal((await db.listProvidersAdmin({ status: 'approved' })).find(p => p.id === 'p-lumen').ownerSuspended, false);
  await db.setUserSuspended('u-own-lumen', true);
  assert.ok(!(await db.listProviders()).some(p => p.id === 'p-lumen'), 'p-lumen doit être masqué du catalogue');
  await assert.rejects(() => db.getProvider('p-lumen'), /Prestataire introuvable/);
  const row = (await db.listProvidersAdmin({ status: 'approved' })).find(p => p.id === 'p-lumen');
  assert.equal(row.status, 'approved');
  assert.equal(row.ownerSuspended, true);
  await db.setUserSuspended('u-own-lumen', false);
  assert.ok((await db.listProviders()).some(p => p.id === 'p-lumen'));
  assert.equal((await db.listProvidersAdmin({ status: 'approved' })).find(p => p.id === 'p-lumen').ownerSuspended, false);
});

// I7 — la voie « pending → Approuver » de la page admin, côté db : aucun
// prestataire pending en graine ; setProviderStatus(id,'pending') est la voie
// publique légitime pour entrer dans la file, puis approuver la referme.
test('admin: file pending → approbation via setProviderStatus (voie publique)', async () => {
  const db = makeDb();
  assert.equal((await db.listProvidersAdmin({ status: 'pending' })).length, 0);
  await db.setProviderStatus('p-gourmand', 'pending');
  const pend = await db.listProvidersAdmin({ status: 'pending' });
  assert.deepEqual(pend.map(p => p.id), ['p-gourmand']);
  assert.ok(!(await db.listProviders()).some(p => p.id === 'p-gourmand'));
  await db.setProviderStatus('p-gourmand', 'approved');
  assert.ok((await db.listProviders()).some(p => p.id === 'p-gourmand'));
  assert.equal((await db.listProvidersAdmin({ status: 'pending' })).length, 0);
});
