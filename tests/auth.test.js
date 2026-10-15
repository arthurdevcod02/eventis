import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from './helpers/memory-storage.js';
import { DemoAuth } from '../assets/js/core/auth-demo.js';

const makeAuth = () => new DemoAuth(memoryStorage());

test('inscription client puis connexion', async () => {
  const auth = makeAuth();
  const user = await auth.signUp({ fullName: 'Nouveau Client', email: 'nouveau@example.tg',
    phone: '+228 90 00 00 00', password: 'motdepasse1', role: 'client' });
  assert.equal(user.role, 'client');
  assert.equal(user.fullName, 'Nouveau Client');
  const logged = await auth.signIn('nouveau@example.tg', 'motdepasse1');
  assert.equal(logged.email, 'nouveau@example.tg');
  assert.equal(auth.current().id, user.id);
});

test('inscription prestataire crée un profil prestataire en attente', async () => {
  const auth = makeAuth();
  const user = await auth.signUp({ fullName: 'Nouveau Pro', email: 'pro@example.tg',
    phone: '+228 90 00 00 01', password: 'motdepasse1', role: 'prestataire' });
  const providerId = await auth.getProviderIdFor(user.id);
  assert.ok(providerId);
  const auth2 = makeAuth(); // même stockage → vérification croisée faite via db dans la page
});

test('doublon e-mail rejeté ; mauvais mot de passe rejeté ; suspension bloque la connexion', async () => {
  const auth = makeAuth();
  await auth.signUp({ fullName: 'A', email: 'a@b.tg', phone: '1', password: 'motdepasse1', role: 'client' });
  await assert.rejects(() => auth.signUp({ fullName: 'B', email: 'a@b.tg', phone: '2', password: 'motdepasse1', role: 'client' }),
    /déjà utilisé/);
  await assert.rejects(() => auth.signIn('a@b.tg', 'faux'), /Invalides/);
  // suspension via l'adaptateur de données partagé, puis connexion bloquée
  const { DemoAdapter } = await import('../assets/js/core/db.js');
  const db = new DemoAdapter(auth.storage);
  const user = (await db.listUsersAdmin()).find(u => u.email === 'a@b.tg');
  await db.setUserSuspended(user.id, true);
  await assert.rejects(() => auth.signIn('a@b.tg', 'motdepasse1'), /suspendu/);
});

test('onChange notifie connexion et déconnexion', async () => {
  const auth = makeAuth();
  const seen = [];
  const unsub = auth.onChange(u => seen.push(u?.email ?? null));
  await auth.signUp({ fullName: 'C', email: 'c@d.tg', phone: '3', password: 'motdepasse1', role: 'client' });
  await auth.signIn('c@d.tg', 'motdepasse1');
  await auth.signOut();
  unsub();
  assert.deepEqual(seen.filter(Boolean), ['c@d.tg', 'c@d.tg']);
  assert.equal(seen[seen.length - 1], null);
});

test('comptes démo présents et signIn fonctionne', async () => {
  const auth = makeAuth();
  assert.equal((await auth.signIn('client@demo.tg', 'demo1234')).role, 'client');
  assert.equal((await auth.signIn('prestataire@demo.tg', 'demo1234')).role, 'prestataire');
  assert.equal((await auth.signIn('admin@demo.tg', 'demo1234')).role, 'admin');
});

// --- Contrat de garde de session (R21) -----------------------------------------
// guards.requireAuth LIT la session en synchrone. Si AuthSupabase.current()
// renvoyait une Promise (l'ancien code), la garde la jugeait toujours vraie et
// laissait passer n'importe quel visiteur sur une page protégée en mode réel.
// Ces tests figent le contrat avec un faux client Supabase : pas d'instance réelle.
const { readFileSync } = await import('node:fs');

function loadAuthSupabase(client) {
  const src = readFileSync(new URL('../assets/js/core/auth-supabase.js', import.meta.url), 'utf8');
  const fakeWindow = { supabase: { createClient: () => client } };
  new Function('window', src)(fakeWindow); // script classique : il écrit dans window
  const cfg = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon' };
  return new fakeWindow.EventisAuthSupabase.AuthSupabase(cfg, {});
}

const PROFILE_ROW = { id: 'u1', full_name: 'Kossi', email: 'kossi@example.tg', phone: '', role: 'client', suspended: false };

function fakeClient({ session = true } = {}) {
  const user = session ? { id: 'u1' } : null;
  return {
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      onAuthStateChange: cb => { cb('INITIAL_SESSION', user ? { user } : null); return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => {},
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: PROFILE_ROW, error: null }) }) }) }),
  };
}

test('mode réel : current() est synchrone, null avant ready(), profil après ready()', async () => {
  const auth = loadAuthSupabase(fakeClient());
  assert.equal(auth.current(), null, 'current() ne doit pas renvoyer une Promise');
  const p = auth.ready();
  assert.ok(p instanceof Promise);
  const user = await p;
  assert.equal(user.id, 'u1');
  assert.equal(auth.current().fullName, 'Kossi');
  assert.equal(await auth.ready(), auth.current(), 'ready() est idempotent');
});

test('mode réel : aucune session enregistrée → current() reste null', async () => {
  const auth = loadAuthSupabase(fakeClient({ session: false }));
  assert.equal(await auth.ready(), null);
  assert.equal(auth.current(), null);
});

test('demo et réel partagent le contrat ready()/current() lu par la garde', async () => {
  const demo = makeAuth();
  assert.equal(demo.current(), null);
  assert.equal(await demo.ready(), null);
  await demo.signIn('client@demo.tg', 'demo1234');
  assert.deepEqual(await demo.ready(), demo.current());
});
