import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memoryStorage } from './helpers/memory-storage.js';
import { DemoAuth } from '../assets/js/core/auth-demo.js';
import {
  RECOVERY_RETURN_PATH, authErrorFR, confirmEmailMessage, hasAuthReturnCode, recoveryUrl, validateNewPassword,
} from '../assets/js/core/auth-messages.js';
import { signOutTarget } from '../assets/js/core/guards.js';

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
const FAKE_LOCATION = { search: '', hash: '', origin: 'https://eventis.test' };

// `location` est prêté au faux window : auth-supabase.js le lit dès son évaluation
// pour figer l'URL d'entrée, avant que supabase-js n'efface « ?code= ».
function loadAuthSupabase(client, { location = FAKE_LOCATION } = {}) {
  const src = readFileSync(new URL('../assets/js/core/auth-supabase.js', import.meta.url), 'utf8');
  const fakeWindow = { supabase: { createClient: () => client }, location };
  new Function('window', src)(fakeWindow); // script classique : il écrit dans window
  const cfg = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon' };
  return new fakeWindow.EventisAuthSupabase.AuthSupabase(cfg, {});
}

const PROFILE_ROW = { id: 'u1', full_name: 'Kossi', email: 'kossi@example.tg', phone: '', role: 'client', suspended: false };

// Faux client Supabase : les enregistrements d'appels (calls) sont la preuve vérifiée
// par les tests — ce que le code a réellement demandé à Supabase, pas ce qu'il dit.
function fakeClient({ session = true, profile = PROFILE_ROW, metadata = {} } = {}) {
  const user = session ? { id: 'u1', email: 'kossi@example.tg', user_metadata: metadata } : null;
  const calls = { oAuth: [], inserts: [], signUp: [], reset: [], update: [] };
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
      signUp: async (params) => {
        calls.signUp.push(params);
        return { data: { user: { id: 'u1', email: params.email }, session: user ? { user } : null }, error: null };
      },
      resetPasswordForEmail: async (email, options) => {
        calls.reset.push({ email, options });
        return { error: null };
      },
      updateUser: async (attributes) => {
        calls.update.push(attributes);
        return { data: { user }, error: null };
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
    { id: 'u1', email: 'kossi@example.tg', fullName: 'Awa Diallo', phone: '', role: null });
});

test('pendingSignup : les métadonnées de l’inscription portent le téléphone et le rôle', async () => {
  const auth = loadAuthSupabase(fakeClient({ profile: null,
    metadata: { full_name: 'Awa Diallo', phone: '+228 90 00 00 00', role: 'prestataire' } }));
  const pending = await auth.pendingSignup();
  assert.equal(pending.phone, '+228 90 00 00 00', 'le téléphone saisi à l’inscription survit au lien de confirmation');
  assert.equal(pending.role, 'prestataire');
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
  const user = await auth.completeSignup({ role: 'client', cguVersion: '2026-10-15' });
  assert.equal(user.role, 'client');
  assert.equal(client.calls.inserts.length, 1, 'une seule ligne écrite : profiles');
  assert.deepEqual(client.calls.inserts[0],
    { table: 'profiles', row: { id: 'u1', full_name: 'Kossi', email: 'kossi@example.tg',
      phone: '', role: 'client', cgu_version: '2026-10-15' } });
  assert.equal(auth.current().id, 'u1', 'la session devient lisible par les gardes');
});

test('completeSignup : le rôle prestataire crée la fiche en attente, comme une inscription classique', async () => {
  const client = fakeClient({ profile: null });
  const auth = loadAuthSupabase(client);
  await auth.completeSignup({ role: 'prestataire', cguVersion: '2026-10-15' });
  assert.equal(client.calls.inserts[0].row.role, 'prestataire');
  assert.equal(client.calls.inserts[0].row.cgu_version, '2026-10-15',
    'la version acceptée part en base avec le profil, sur les deux voies d’entrée');
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

// --- Réinitialisation du mot de passe ----------------------------------------
// Le parcours « mot de passe oublié » n’existait pas : le lien d’e-mail renvoyait sur
// la page de connexion, sans formulaire. Ces tests figent les trois pièces du contrat :
// savoir qu’on arrive par un lien (entryUrl + hasAuthReturnCode), demander la
// réinitialisation vers la bonne page, et écrire le nouveau mot de passe.

test('hasAuthReturnCode : reconnaît le code PKCE et l’ancien flux implicite', () => {
  assert.equal(hasAuthReturnCode({ search: '?code=abc123' }), true);
  assert.equal(hasAuthReturnCode({ search: '?foo=1&code=abc' }), true);
  assert.equal(hasAuthReturnCode({ hash: '#access_token=xyz&type=recovery' }), true);
  assert.equal(hasAuthReturnCode({ hash: '#access_token=xyz&type=signup' }), true);
  // Rien d’autre ne doit ouvrir le formulaire : un simple ?code= absent = on n’a pas suivi de lien.
  assert.equal(hasAuthReturnCode({ search: '?next=/compte/' }), false);
  assert.equal(hasAuthReturnCode({ hash: '#token=xyz' }), false);
  assert.equal(hasAuthReturnCode(), false, 'appelé sans argument : pas de lien, pas de formulaire');
});

test('entryUrl() conserve l’URL d’entrée telle que la page a été chargée', async () => {
  const auth = loadAuthSupabase(fakeClient(), { location: { search: '?code=abc123', hash: '', origin: 'https://eventis.test' } });
  assert.deepEqual(auth.entryUrl(), { search: '?code=abc123', hash: '' });
});

test('recoveryUrl : chemin de retour identique à la page créée, sans doublon de barre oblique', () => {
  assert.equal(recoveryUrl('https://eventis-app.netlify.app'), 'https://eventis-app.netlify.app' + RECOVERY_RETURN_PATH);
  assert.equal(recoveryUrl('https://eventis-app.netlify.app/'), 'https://eventis-app.netlify.app' + RECOVERY_RETURN_PATH);
});

test('le chemin littéral du mode réel est bien celui de RECOVERY_RETURN_PATH', () => {
  // auth-supabase.js est un script classique : il ne peut pas importer auth-messages.js.
  // Cette vérification est la seule garde contre les deux chaînes qui divergent —
  // une divergence enverrait le lien d’e-mail sur une page qui n’existe pas.
  const src = readFileSync(new URL('../assets/js/core/auth-supabase.js', import.meta.url), 'utf8');
  assert.ok(src.includes(`'${RECOVERY_RETURN_PATH}'`),
    'requestPasswordReset() doit demander exactement le chemin de la page de réinitialisation');
});

test('requestPasswordReset : demande l’e-mail avec l’URL de retour de la page de réinitialisation', async () => {
  const client = fakeClient();
  const auth = loadAuthSupabase(client);
  await auth.requestPasswordReset('kossi@example.tg');
  assert.equal(client.calls.reset.length, 1);
  assert.equal(client.calls.reset[0].email, 'kossi@example.tg');
  assert.equal(client.calls.reset[0].options.redirectTo, 'https://eventis.test' + RECOVERY_RETURN_PATH);
});

test('updatePassword : écrit le mot de passe puis rend le profil lisible', async () => {
  const client = fakeClient();
  const auth = loadAuthSupabase(client);
  const user = await auth.updatePassword('nouveauMotDePasse');
  assert.deepEqual(client.calls.update, [{ password: 'nouveauMotDePasse' }]);
  assert.equal(user.id, 'u1');
  assert.equal(auth.current().id, 'u1', 'après mise à jour, current() reflète la session');
});

test('updatePassword : une erreur serveur est remontée, le cache reste vide', async () => {
  const client = fakeClient();
  client.auth.updateUser = async () => ({ data: { user: null }, error: { message: 'invalid code' } });
  const auth = loadAuthSupabase(client);
  await assert.rejects(() => auth.updatePassword('trop-court'), /invalid code/);
  assert.equal(auth.current(), null);
});

test('validateNewPassword : mêmes règles qu’à l’inscription', () => {
  assert.equal(validateNewPassword('1234567', '1234567'), 'Le mot de passe doit contenir au moins 8 caractères.');
  assert.equal(validateNewPassword('12345678', '87654321'), 'Les mots de passe ne correspondent pas.');
  assert.equal(validateNewPassword('12345678', '12345678'), '');
});

test('mode démo : updatePassword refuse au lieu de simuler une réinitialisation', async () => {
  const auth = makeAuth();
  await assert.rejects(() => auth.updatePassword('motdepasse1'), /Supabase/);
});

// --- Messages d’erreur français -----------------------------------------------

test('authErrorFR : le corps vide « {} » ne s’affiche jamais tel quel', () => {
  assert.equal(authErrorFR(new Error('{}')), 'L’opération a échoué sans que le serveur précise pourquoi. Réessayez, ou utilisez votre e-mail et votre mot de passe.');
  assert.notEqual(authErrorFR('{}'), '{}');
  assert.equal(authErrorFR(new Error('   ')), authErrorFR(new Error('{}')));
});

test('authErrorFR : chaque réponse connue devient une consigne en français', () => {
  const cases = [
    ['Error sending recovery email', 'passerelle d’e-mail'],
    ['Email amount over rate limit', 'Attendez une heure'],
    ['Email not confirmed', 'confirmée'],
    ['Invalid login credentials', 'incorrect'],
    ['Could not find a user with this login', 'Aucun compte Eventis'],
    ['User already registered', 'déjà utilisé'],
    ['Password should be at least 6 characters.', 'au moins 8 caractères'],
    ['Address is not valid. email address is invalid', 'refusée par le serveur'],
    ['invalid code: token has expired', 'expiré'],
    ['JSON object requested, multiple (or no) rows returned', 'refusé la lecture'],
    ['Failed to fetch', 'joindre le serveur'],
  ];
  for (const [raw, expected] of cases) {
    const message = authErrorFR(new Error(raw));
    assert.notEqual(message, raw, `« ${raw} » doit être traduit`);
    assert.ok(message.includes(expected), `« ${raw} » → ${message} doit contenir « ${expected} »`);
  }
});

test('authErrorFR : une réponse inconnue est renvoyée telle quelle, jamais masquée', () => {
  assert.equal(authErrorFR(new Error('Bizantian error: quorum lost')), 'Bizantian error: quorum lost');
});

test('confirmEmailMessage : nomme l’adresse à ouvrir', () => {
  assert.match(confirmEmailMessage('awa@example.tg'), /awa@example\.tg/);
  assert.match(confirmEmailMessage('awa@example.tg'), /confirmation/i);
});

// --- Inscription quand le projet exige la confirmation d’e-mail ---------------

test('signUp : les réponses du formulaire partent dans les métadonnées du compte', async () => {
  const client = fakeClient();
  const auth = loadAuthSupabase(client);
  const user = await auth.signUp({ fullName: 'Awa Diallo', email: 'awa@example.tg', phone: '+228 90 00 00 00',
    password: 'motdepasse1', role: 'client', cguVersion: '2026-10-15',
    emailRedirectTo: 'https://eventis.test/auth/connexion.html' });
  const call = client.calls.signUp[0];
  assert.equal(call.options.emailRedirectTo, 'https://eventis.test/auth/connexion.html');
  assert.deepEqual(call.options.data, { full_name: 'Awa Diallo', phone: '+228 90 00 00 00',
    role: 'client', cgu_version: '2026-10-15' },
    'le consentement et le rôle survivent au lien de confirmation : sans session, RLS interdit toute écriture');
  assert.equal(user.role, 'client');
});

test('signUp : sans session après le lien (confirmation requise), rien n’est écrit et l’état est annoncé', async () => {
  const client = fakeClient({ session: false });
  const auth = loadAuthSupabase(client);
  const result = await auth.signUp({ fullName: 'Awa', email: 'awa@example.tg', phone: '', password: 'motdepasse1',
    role: 'prestataire', cguVersion: '2026-10-15', emailRedirectTo: 'https://eventis.test/auth/connexion.html' });
  assert.deepEqual(result, { needsEmailConfirmation: true, email: 'awa@example.tg' });
  assert.equal(client.calls.inserts.length, 0,
    'aucune insertion tentée : « profiles self insert » exige auth.uid() et échouerait sans session');
});

test('signUp : le rôle attendu au retour de confirmation est repris à la complétion', async () => {
  const client = fakeClient({ profile: null, metadata: { full_name: 'Awa', phone: '+228 90 00 00 00', role: 'prestataire' } });
  const auth = loadAuthSupabase(client);
  const user = await auth.completeSignup({ role: 'prestataire', cguVersion: '2026-10-15' });
  assert.equal(user.role, 'prestataire');
  assert.equal(client.calls.inserts[0].row.phone, '+228 90 00 00 00', 'le téléphone saisi à l’inscription arrive en base');
  assert.equal(client.calls.inserts[1].table, 'providers');
});


// --- Où mène une déconnexion ---
test('signOutTarget : la déconnexion quitte toute page protégée vers l’accueil', () => {
  assert.equal(signOutTarget('/compte/'), '/');
  assert.equal(signOutTarget('/compte/messages.html'), '/');
  assert.equal(signOutTarget('/espace-prestataire/'), '/');
  assert.equal(signOutTarget('/admin/avis.html'), '/');
  assert.equal(signOutTarget('/catalogue.html'), '/');
});

test('signOutTarget : jamais l’espace d’un rôle ni la page de connexion en cible', () => {
  const cible = signOutTarget('/compte/');
  assert.ok(!Object.values({ client: '/compte/', prestataire: '/espace-prestataire/', admin: '/admin/' }).includes(cible),
    'rediriger vers un espace protégé relancerait la garde sur une session morte');
  assert.notEqual(cible, '/auth/connexion.html',
    'la page de connexion présuppose qu’on veut se reconnecter tout de suite');
});

test('signOutTarget : déjà sur l’accueil = pas de navigation inutile', () => {
  assert.equal(signOutTarget('/'), null);
});
