// Verrous statiques du mode maintenance. Le blocage réel des pages publiques se
// mesure sur le déploiement (edge function Netlify) et ne peut pas être exécuté ici :
// ces tests verrouillent donc les deux propriétés qui, si elles se perdent, cassent le
// site ou ouvrent la porte — qui a le droit d'écrire le drapeau, et ce que le filtre
// laisse passer. Le contrat de lecture/écriture du drapeau, lui, est testé pour de vrai
// dans tests/db.test.js (allers-retours DemoAdapter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const lire = chemin => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// Les politiques de site_settings telles qu'écrites dans les deux fichiers SQL :
// supabase/rls.sql (chemin propre, nouveau déploiement) et supabase/maintenance.sql
// (migration à coller dans le projet en ligne). L'une ne doit pas oublier ce que
// l'autre garantit : les deux sont vérifiées séparément.
const politiques = (sql, table = 'site_settings') =>
  [...sql.matchAll(/create policy[^;]*on public\.[a-z_]+[^;]*;/gis)]
    .map(m => m[0]).filter(p => p.includes(`public.${table}`));

for (const [nom, chemin] of [['rls.sql', '../supabase/rls.sql'], ['maintenance.sql', '../supabase/maintenance.sql']]) {
  test(`site_settings : écriture réservée aux administrateurs authentifiés (${nom})`, () => {
    const sql = lire(chemin);
    const list = politiques(sql);
    const ecritures = list.filter(p => /\bfor (insert|update|delete)\b/.test(p));
    assert.equal(ecritures.length, 3, `${nom} doit borner insert, update et delete`);
    for (const p of ecritures) {
      // `to authenticated` : sans session, PostgREST ne choisit aucun rôle → la
      // politique ne s'applique même pas. `is_admin()` : la session doit porter le
      // rôle admin en base. Les deux ensemble = un visiteur non connecté ne peut pas
      // toucher au drapeau, même avec la seule clé publique `anon`.
      assert.match(p, /to authenticated/, `${nom} : écriture ouverte à un rôle anonyme`);
      assert.match(p, /is_admin\(\)/, `${nom} : écriture sans contrôle du rôle admin`);
    }
    const lectures = list.filter(p => /for select/.test(p));
    assert.equal(lectures.length, 1);
    assert.match(lectures[0], /using \(true\)/, `${nom} : le drapeau doit rester lisible publiquement`);
    assert.doesNotMatch(lectures[0], /to authenticated/, `${nom} : la edge function (clé anon) ne pourrait plus le lire`);
    assert.match(sql, /alter table public\.site_settings enable row level security;/);
  });
}

test('site_settings : drapeau booléen, ligne unique, message plafonné à 500', () => {
  const sql = lire('../supabase/schema.sql');
  assert.match(sql, /maintenance_enabled boolean not null default false/);
  assert.match(sql, /constraint site_settings_single_row check \(id = 1\)/);
  assert.match(sql, /length\(maintenance_message\) <= 500/);
  // `do nothing`, jamais `do update` : relancer le schéma ne doit jamais rouvrir le
  // site en cachette pendant une maintenance en cours.
  assert.match(sql, /insert into public\.site_settings \(id\) values \(1\) on conflict \(id\) do nothing;/);
});

test('la edge function ne filtre ni l’admin, ni la connexion, ni sa propre page', () => {
  const code = lire('../netlify/edge-functions/maintenance.js');
  const exclus = code.match(/excludedPath: \[([\s\S]*?)\]/)?.[1] ?? '';
  // Boucle de réécriture : /maintenance.html doit être exclu du filtre.
  // Irréversibilité : sans /auth/, plus aucun admin ne peut se connecter pour rouvrir.
  // /admin et /auth SANS barre finale : `/admin/*` ne couvre pas l'URL `/admin` que l'on
  // obtient en tapant l'adresse courte — l'administrateur aurait été renvoyé sur la page de
  // coupure, donc privé de l'interrupteur qui sert à la rouvrir.
  for (const chemin of ["'/assets/*'", "'/admin/*'", "'/auth/*'", "'/maintenance.html'", "'/admin'", "'/auth'"]) {
    assert.ok(exclus.includes(chemin), `excludedPath doit contenir ${chemin}`);
  }
  assert.match(code, /EXEMPTES_PREFIXES = \[[^\]]*\/admin\/[^\]]*\/auth\//);
  assert.match(code, /EXEMPTS_CHEMINS = new Set\(\[[\s\S]*'\/admin',[\s\S]*'\/auth',/);
  // La réponse 503 est fabriquée par la fonction : Netlify n'y applique pas les en-têtes
  // personnalisés du dépôt. Sans report depuis le fichier statique, la page de maintenance
  // serait la seule page en ligne sans Content-Security-Policy.
  assert.match(code, /new Headers\(ressource\.headers\)/);
  assert.match(code, /onError: 'bypass'/);
  assert.match(code, /status: 503/);
  // Le drapeau se lit avec les variables du site, jamais en dur dans le dépôt.
  assert.match(code, /Netlify\.env\.get\('SUPABASE_URL'\)/);
  assert.doesNotMatch(code, /https:\/\/[a-z]+\.supabase\.co/);
});

// Verrou ajouté APRÈS coup : Netlify *compile* la edge function pendant le build, alors
// que le navigateur ne la charge jamais et que les verrous ci-dessus la lisaient en
// texte. Une chaîne collée à une autre sans `+` (maintenance.js:56) a donc fait échouer
// tout le déploiement (« exit code 2 ») avec 76 tests au vert.
test('les edge functions sont des modules JavaScript valides (Netlify les compile au build)', () => {
  const dossier = new URL('../netlify/edge-functions/', import.meta.url);
  const fichiers = readdirSync(dossier).filter(nom => nom.endsWith('.js'));
  assert.ok(fichiers.length > 0, 'aucune edge function trouvée : le mode maintenance n’a plus de filtre');
  for (const nom of fichiers) {
    const chemin = fileURLToPath(new URL(nom, dossier));
    const r = spawnSync(process.execPath, ['--check', chemin], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${nom} ne compile pas :\n${r.stderr}`);
  }
});

test('la page de maintenance porte le texte du brief, sans date de retour inventée', () => {
  const page = lire('../maintenance.html');
  assert.match(page, /<h1>Eventis est temporairement en maintenance<\/h1>/);
  assert.match(page, /Nous améliorons actuellement la plateforme afin de vous offrir une meilleure expérience\. Nous serons de retour très bientôt\. Merci pour votre patience !/);
  assert.match(page, /id="maint-retry"/);
  assert.match(page, /href="\/contact\.html"/);
  assert.match(page, /name="robots" content="noindex"/);
  // Rien ne promet une heure ni un jour de reprise, et aucun minuteur n'est monté.
  assert.doesNotMatch(page, /compte à rebours|countdown|setInterval/i);
  assert.doesNotMatch(page, /\b\d{1,2}h\d{2}\b/);
  assert.doesNotMatch(page, /\d{2}\/\d{2}\/\d{4}/);
});
