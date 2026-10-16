// Verrous de la surface livrée : ce que le navigateur autorise à exécuter ou à charger.
// Ces propriétés ne se testent pas dans un test de rendu — elles tiennent dans netlify.toml
// et dans la façon dont les pages déclarent leurs scripts. Si l'une se perd, la
// Content-Security-Policy devient décorative : d'où ces contrôles texte, exécutés à chaque
// suite de tests. Le respect réel de la CSP par le navigateur se mesure sur le déploiement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const lire = chemin => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// Mêmes répertoires que tools/build-dist.mjs : les pages du site, et rien d'autre.
const DOSSIERS_PAGES = ['..', '../admin', '../auth', '../compte', '../espace-prestataire'];
const pages = DOSSIERS_PAGES.flatMap(d =>
  readdirSync(new URL(d, import.meta.url))
    .filter(n => n.endsWith('.html'))
    .map(n => `${d}/${n}`));

const csp = lire('../netlify.toml').match(/^[ \t]*Content-Security-Policy = "(.+)"$/m)?.[1] ?? '';
const directive = nom => csp.split(';').map(s => s.trim()).find(s => s.startsWith(`${nom} `));

test('aucune page ne porte de <script> inline — condition de script-src sans unsafe-inline', () => {
  assert.ok(pages.length >= 28, `surprise : ${pages.length} pages trouvées`);
  for (const page of pages) {
    const html = lire(page);
    // Un <script> sans src = du code dans le HTML. C'est ce qui obligerait la CSP à
    // autoriser 'unsafe-inline', c'est-à-dire à ne plus rien filtrer du tout.
    assert.doesNotMatch(html, /<script>(?!<\/script>)/, `${page} contient un script inline`);
    // Idem pour les gestionnaires écrits dans le balisage : la CSP les bloque, mais un
    // onclick= survivant dans le dépôt serait une protection qui ne marche pas en silence.
    assert.doesNotMatch(html, /\son(click|load|input|change|submit|error|mouse\w+)="/,
      `${page} contient un gestionnaire d’événement inline`);
  }
});

test('le bootstrap de thème est un fichier, chargé avant le corps et sans defer', () => {
  const chemin = new URL('../assets/js/theme-bootstrap.js', import.meta.url);
  const r = spawnSync(process.execPath, ['--check', fileURLToPath(chemin)], { encoding: 'utf8' });
  assert.equal(r.status, 0, `theme-bootstrap.js ne compile pas :\n${r.stderr}`);
  for (const page of pages) {
    const html = lire(page);
    const balise = html.match(/<script src="\/assets\/js\/theme-bootstrap\.js"([^>]*)><\/script>/);
    assert.ok(balise, `${page} ne charge plus le bootstrap de thème`);
    // `defer` ou `async` laisseraient peindre le corps avant l'application du thème.
    assert.doesNotMatch(balise[1], /defer|async/, `${page} charge le bootstrap avec defer/async`);
    assert.ok(html.indexOf(balise[0]) < html.indexOf('<body'), `${page} : le bootstrap n’est pas dans le <head>`);
  }
});

test('la CSP interdit le script qui ne vient pas du dépôt', () => {
  assert.ok(csp.length > 80, 'Content-Security-Policy absente ou tronquée dans netlify.toml');
  // script-src : 'self' nu, sans exception. C'est la ligne qui rend une injection XSS
  // inoffensive, puisque le HTML est construit avec innerHTML ailleurs dans le site.
  assert.equal(directive('script-src'), "script-src 'self'");
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-(inline|eval)/, 'script-src tolère unsafe-inline ou unsafe-eval');
  // Rien de l’extérieur ne peut être téléchargé ni exécuté : ni plugin, ni balise base
  // détournée, ni formulaire posté vers un hôte tiers.
  assert.equal(directive('object-src'), "object-src 'none'");
  assert.equal(directive('base-uri'), "base-uri 'self'");
  assert.equal(directive('form-action'), "form-action 'self'");
  assert.equal(directive('default-src'), "default-src 'self'");
  // Les requêtes réseau du site : Netlify (mêmes origines) et Supabase. Le joker
  // supabase.co est commenté dans netlify.toml — l’URL exacte du projet n’est pas dans le dépôt.
  assert.equal(directive('connect-src'), "connect-src 'self' https://*.supabase.co");
});

test('la CSP et les en-têtes refusent l’embarquement et bridèlent les droits du navigateur', () => {
  assert.equal(directive('frame-ancestors'), "frame-ancestors 'none'");
  const toml = lire('../netlify.toml');
  // Complément ancien de frame-ancestors : les très vieux navigateurs ne lisent pas la CSP.
  assert.match(toml, /^[ \t]*X-Frame-Options = "DENY"$/m);
  assert.match(toml, /^[ \t]*Referrer-Policy = "strict-origin-when-cross-origin"$/m);
  assert.match(toml, /^[ \t]*X-Content-Type-Options = "nosniff"$/m);
  // Le site n’a ni caméra, ni micro, ni géolocalisation, ni paiement, ni partage d’écran.
  const permissions = toml.match(/^[ \t]*Permissions-Policy = "(.+)"$/m)?.[1] ?? '';
  for (const droit of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'display-capture=()']) {
    assert.ok(permissions.includes(`${droit}`), `Permissions-Policy oublie de refuser ${droit}`);
  }
});

test('le style inline reste toléré, et c’est écrit pourquoi', () => {
  // style-src 'unsafe-inline' est le seul relâchement du site : le graphique de l’admin et
  // les squelettes du catalogue posent des `style="…"`. Si ce test échoue, le relâchement
  // n’a plus de raison d’être et la CSP doit être resserrée.
  assert.equal(directive('style-src'), "style-src 'self' 'unsafe-inline'");
  assert.match(lire('../assets/js/pages/admin-home.js'), /style="height:/);
});
