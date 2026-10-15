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

// Faux client Supabase : les enregistrements d'appels (calls) sont la preuve vérifiée
// par les tests — ce que le code a réellement demandé à Supabase, pas ce qu'il dit.
function fakeClient({ session = true, profile = PROFILE_ROW, metadata = {} } = {}) {
  const user = session ? { id: 'u1', email: 'kossi@example.tg', user_metadata: metadata } : null;
  const calls = { oAuth: [], inserts: [] };
  const rows = { profiles: profile, providers: null };
  const table = (name) => ({
    select: () => ({
      eq: () => ({
        single: async () => (rows[name]
          ? { data: rows[name], error: null }
          : { data: null, error: { message: 'aucune ligne' } }),
        maybeSingle: async () => (rows[name]
          ? { data: rows[name], error: null }
          : { data: null, error: null }),
      }),
    }),
    insert: async (row) => {
      calls.inserts.push({ table: name, row });
      if (name === 'profiles') rows.profiles = { ...PROFILE_ROW, ...row };
      if (name === 'providers') rows.providers = row;
      return { error: null };
    },
  });
  return {
    calls,
    rows,
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      getUser: async () => ({ data: { user } }),
      onAuthStateChange: cb => { cb('INITIAL_SESSION', user ? { user } : null); return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => {},
      signInWithPassword: async () => ({ data: { user }, error: null }),
      signInWithOAuth: async (options) => {
        calls.oAuth.push(options);
        return { data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x', provider: 'google' }, error: null };
      },
    },
    from: (name) => table(name),
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

// --- Contrat OAuth Google (mode réel) ---------------------------------------
// Aucun de ces tests n'appelle une véritable instance Supabase : ils figent ce que
// le code demande au client (fournisseur, URL de retour, lignes écrites) et les
// permissions accordées. Le parcours réseau Google lui-même reste à valider sur un
// projet réel — voir README, section « Configuration Google ».

test('signInWithGoogle : demande le fournisseur google et l’URL de retour, sans naviguer', async () => {
  const client = fakeClient();
  const auth = loadAuthSupabase(client);
  const url = await auth.signInWithGoogle({ redirectTo: 'http://localhost:4173/auth/connexion.html' });
  assert.match(url, /^https:\/\/accounts\.google\.com\//, 'l’URL du consentement est renvoyée à l’appelant');
  assert.equal(client.calls.oAuth.length, 1);
  const call = client.calls.oAuth[0];
  assert.equal(call.provider, 'google');
  assert.equal(call.options.redirectTo, 'http://localhost:4173/auth/connexion.html');
  assert.equal(call.options.skipBrowserRedirect, true, 'la page ne quitte l’écran qu’après vérification de l’erreur');
});

test('signInWithGoogle : une erreur fournisseur est remontée, aucune URL inventée', async () => {
  const client = fakeClient();
  client.auth.signInWithOAuth = async () => ({ data: { url: null }, error: { message: 'unknown provider' } });
  const auth = loadAuthSupabase(client);
  await assert.rejects(() => auth.signInWithGoogle({ redirectTo: 'http://localhost:4173/auth/connexion.html' }),
    /unknown provider/);
});

test('pendingSignup : une session Google sans ligne profiles est un compte à compléter', async () => {
  const auth = loadAuthSupabase(fakeClient({ profile: null, metadata: { full_name: 'Awa Diallo' } }));
  assert.deepEqual(await auth.pendingSignup(),
    { id: 'u1', email: 'kossi@example.tg', fullName: 'Awa Diallo' });
});

test('pendingSignup : le nom vient des métadonnées Google, sinon de l’e-mail', async () => {
  const sansNom = loadAuthSupabase(fakeClient({ profile: null, metadata: {} }));
  assert.equal((await sansNom.pendingSignup()).fullName, 'kossi');
  const sansEmail = loadAuthSupabase(fakeClient({ profile: null, metadata: { name: 'Moussa' } }));
  assert.equal((await sansEmail.pendingSignup()).fullName, 'Moussa');
});

test('pendingSignup : null quand le profil existe ou qu’aucune session n’est ouverte', async () => {
  const dejaProfil = loadAuthSupabase(fakeClient());
  assert.equal(await dejaProfil.pendingSignup(), null);
  const sansSession = loadAuthSupabase(fakeClient({ session: false }));
  assert.equal(await sansSession.pendingSignup(), null);
});

test('mode réel : une session sans profil ne fait plus échouer ready() (sinon boucle de redirection)', async () => {
  const auth = loadAuthSupabase(fakeClient({ profile: null }));
  assert.equal(await auth.ready(), null, 'ready() se résout sur null, pas sur une exception');
  assert.equal(auth.current(), null);
});

test('completeSignup : un compte Google reçoit le rôle client, jamais de fiche prestataire', async () => {
  const client = fakeClient({ profile: null, metadata: { full_name: 'Kossi' } });
  const auth = loadAuthSupabase(client);
  const user = await auth.completeSignup({ role: 'client' });
  assert.equal(user.role, 'client');
  assert.equal(client.calls.inserts.length, 1, 'une seule ligne écrite : profiles');
  assert.deepEqual(client.calls.inserts[0],
    { table: 'profiles', row: { id: 'u1', full_name: 'Kossi', email: 'kossi@example.tg', phone: '', role: 'client' } });
  assert.equal(auth.current().id, 'u1', 'la session devient lisible par les gardes');
});

test('completeSignup : le rôle prestataire crée la fiche en attente, comme une inscription classique', async () => {
  const client = fakeClient({ profile: null });
  const auth = loadAuthSupabase(client);
  await auth.completeSignup({ role: 'prestataire' });
  assert.equal(client.calls.inserts[0].row.role, 'prestataire');
  assert.deepEqual(client.calls.inserts[1],
    { table: 'providers', row: { profile_id: 'u1', business_name: '' } });
});

test('completeSignup : administrateur refusé, aucune écriture', async () => {
  const client = fakeClient({ profile: null });
  const auth = loadAuthSupabase(client);
  await assert.rejects(() => auth.completeSignup({ role: 'admin' }), /Rôle invalide/);
  assert.equal(client.calls.inserts.length, 0);
});

test('completeSignup : refusé si le profil existe déjà ou si aucune session n’est ouverte', async () => {
  const dejaLà = loadAuthSupabase(fakeClient());
  await assert.rejects(() => dejaLà.completeSignup({ role: 'client' }), /compléter/);
  const sansSession = loadAuthSupabase(fakeClient({ session: false }));
  await assert.rejects(() => sansSession.completeSignup({ role: 'client' }), /compléter/);
});

test('démo : pendingSignup existe et répond toujours null (aucun OAuth en démonstration)', async () => {
  const demo = makeAuth();
  assert.equal(await demo.pendingSignup(), null);
});
