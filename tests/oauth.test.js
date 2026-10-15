import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from './helpers/memory-storage.js';
import {
  OAUTH_INTENT_KEY, safeNext, redirectUrl, writeIntent, readIntent, clearIntent, hasIntent,
  oauthErrorFR, DEMO_OAUTH_MESSAGE,
} from '../assets/js/core/oauth.js';

// Ces fonctions sont pures (DOM/stockage injectés) : le contrat OAuth est vérifiable
// sous Node, sans instance Supabase ni navigateur.

test('safeNext : n’accepte qu’un chemin interne', () => {
  assert.equal(safeNext('/compte/'), '/compte/');
  assert.equal(safeNext('/espace-prestataire/profil.html?onglet=avis'), '/espace-prestataire/profil.html?onglet=avis');
  assert.equal(safeNext('//evil.example.com'), null, 'protocole-relatif refusé');
  assert.equal(safeNext('/../../admin/'), null, 'traversée de chemin refusée');
  assert.equal(safeNext('https://evil.example.com/x'), null, 'absolute refusé');
  assert.equal(safeNext(''), null);
  assert.equal(safeNext(null), null);
  assert.equal(safeNext(undefined), null);
});

test('redirectUrl : identique en local et en production, sans configuration dans le code', () => {
  assert.equal(redirectUrl('http://localhost:4173'), 'http://localhost:4173/auth/connexion.html');
  assert.equal(redirectUrl('https://eventis.tg'), 'https://eventis.tg/auth/connexion.html');
  assert.equal(redirectUrl('https://eventis.tg/'), 'https://eventis.tg/auth/connexion.html');
});

test('intention OAuth : aller-retour puis effacement', () => {
  const storage = memoryStorage();
  assert.equal(hasIntent(storage), false, 'aucune intention avant de partir vers Google');
  writeIntent(storage, { role: 'prestataire', next: '/catalogue.html' });
  assert.equal(hasIntent(storage), true);
  assert.deepEqual(readIntent(storage), { role: 'prestataire', next: '/catalogue.html' });
  clearIntent(storage);
  assert.equal(hasIntent(storage), false);
  assert.deepEqual(readIntent(storage), { role: null, next: null });
});

test('intention OAuth : le rôle administrateur n’est jamais enregistrable', () => {
  const storage = memoryStorage();
  writeIntent(storage, { role: 'admin', next: '/admin/' });
  assert.equal(readIntent(storage).role, null, 'admin n’est pas un rôle d’inscription');
  // Le chemin « next » n'est qu'une indication de destination après connexion : la
  // page cible garde ses propres gardes (guards.js), ce n'est pas un levier de rôle.
  assert.equal(readIntent(storage).next, '/admin/');
});

test('intention OAuth : stockage indisponible ou contenu illisible ne casse rien', () => {
  assert.deepEqual(readIntent(memoryStorage()), { role: null, next: null });
  const broken = { getItem: () => { throw new Error('interdit'); }, setItem: () => { throw new Error('interdit'); }, removeItem: () => {} };
  assert.doesNotThrow(() => writeIntent(broken, { role: 'client', next: null }));
  assert.deepEqual(readIntent(broken), { role: null, next: null });
  const hostile = memoryStorage();
  hostile.setItem(OAUTH_INTENT_KEY, '{"role":"admin","next":"https://evil"}');
  assert.deepEqual(readIntent(hostile), { role: null, next: null });
  const junk = memoryStorage();
  junk.setItem(OAUTH_INTENT_KEY, 'pas-du-json');
  assert.deepEqual(readIntent(junk), { role: null, next: null });
});

test('oauthErrorFR : fournisseur Google non activé dans Supabase', () => {
  const message = oauthErrorFR(new Error('unknown provider'), 'http://localhost:4173');
  assert.match(message, /pas activé/i);
  assert.match(message, /Google/);
  assert.match(message, /Authentication/);
});

test('oauthErrorFR : URL de redirection refusée — la correction nomme l’URL exacte', () => {
  const message = oauthErrorFR(
    { message: 'redirect_to URL "http://localhost:4173/auth/connexion.html" is not allowed' },
    'http://localhost:4173');
  assert.match(message, /Redirect URLs/);
  assert.match(message, /http:\/\/localhost:4173\/auth\/connexion\.html/);
});

test('oauthErrorFR : erreur réseau signalée en français', () => {
  assert.match(oauthErrorFR(new TypeError('Failed to fetch'), 'https://eventis.tg'), /réseau|joindre/i);
});

test('oauthErrorFR : toute autre réponse est affichée telle quelle, sans promettre', () => {
  assert.match(oauthErrorFR(new Error('Quelque chose de prévu'), 'https://eventis.tg'), /Quelque chose de prévu/);
  assert.match(oauthErrorFR(null, 'https://eventis.tg'), /indisponible/i);
});

test('mode démo : le message explique qu’aucune connexion Google n’est possible', () => {
  assert.match(DEMO_OAUTH_MESSAGE, /démonstration/i);
  assert.match(DEMO_OAUTH_MESSAGE, /Supabase/);
});
