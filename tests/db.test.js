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
