// tools/build-dist.mjs — assemble le site publiable dans dist/.
//
// Le dépôt contient des choses qui n'ont rien à faire en ligne : node_modules (32 Mo),
// les SQL de schéma et de RLS, les tests, les documents d'agent, les captures du README.
// La liste est donc un **allowlist** : tout ce qui n'y figure pas est exclu, y compris un
// dossier ajouté plus tard. Le script vérifie après coup qu'aucun fichier interdit n'a
// été copié, et échoue si c'est le cas.
//
// Usage : node tools/build-dist.mjs
// Mode réel : SUPABASE_URL et SUPABASE_ANON_KEY dans l'environnement de la machine de build.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Pages HTML : racine + quatre espaces protégés, uniquement des fichiers .html.
const PAGE_DIRS = ['.', 'admin', 'auth', 'compte', 'espace-prestataire'];
// Ressources du site. `assets/screenshots` est volontairement absent : images du README,
// jamais référencées par une page.
const ASSET_DIRS = ['assets/css', 'assets/fonts', 'assets/icons', 'assets/img', 'assets/js', 'assets/vendor'];
const ROOT_FILES = ['manifest.webmanifest', 'sw.js'];

// Ce qui ne doit jamais se retrouver en ligne (contrôle final, pas le mode de sélection).
const FORBIDDEN = [/^node_modules\//, /^\.git\//, /^\.superpowers\//, /^docs\//, /^tests\//,
  /^tools\//, /^supabase\//, /^README\.md$/, /^package\.json$/, /(^|\/)\.env/, /\.(sql|log|pem|key)$/];

async function htmlFilesIn(dir) {
  const entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  return entries.filter(e => e.isFile() && e.name.endsWith('.html')).map(e => `${dir}/${e.name}`.replace(/^(\.)\//, ''));
}

async function copy(rel) {
  await cp(join(ROOT, rel), join(DIST, rel), { recursive: true });
}

const pages = (await Promise.all(PAGE_DIRS.map(htmlFilesIn))).flat();
const sources = [...pages, ...ASSET_DIRS, ...ROOT_FILES];

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
for (const rel of sources) await copy(rel);

// Mode réel : Netlify fournit ces deux variables à la machine de build. Elles n'écrivent
// que dans la copie publiée de config.js, jamais dans le dépôt. Une seule des deux est une
// erreur : le site afficherait une interface « réelle » branchée sur rien.
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY ?? '').trim();
if (SUPABASE_URL || SUPABASE_ANON_KEY) {
  const die = (msg) => { console.error(`injection config.js : ${msg}`); process.exit(1); };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    die('SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies ensemble — '
      + 'l\'une sans l\'autre publierait un demi-mode réel.');
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)) {
    die(`SUPABASE_URL doit ressembler à https://<référence>.supabase.co (reçu : ${SUPABASE_URL}).`);
  }
  if (!/^[A-Za-z0-9._-]{20,}$/.test(SUPABASE_ANON_KEY)) {
    // JWT = trois segments base64url séparés par des points ; le point doit donc passer,
    // mais ni l'apostrophe ni l'espace, qui casseraient le littéral ou trahiraient une copie.
    die('SUPABASE_ANON_KEY a un format inattendu (clé tronquée ou espace parasite).');
  }
  const inject = (text, key, value) => {
    const re = new RegExp(`^(\\s*${key}:\\s*)''`, 'm');
    if (!re.test(text)) die(`gabarit inattendu : ${key} introuvable dans config.js.`);
    return text.replace(re, `$1'${value}'`);
  };
  const configPath = join(DIST, 'assets/js/core/config.js');
  const src = await readFile(configPath, 'utf8');
  await writeFile(configPath, inject(inject(src, 'SUPABASE_URL', SUPABASE_URL), 'SUPABASE_ANON_KEY', SUPABASE_ANON_KEY));
}

// Inventaire de ce qui a été produit.
const found = [];
async function walk(dir) {
  for (const entry of await readdir(join(DIST, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(rel);
    else found.push(rel);
  }
}
await walk('');

const violations = found.filter(f => FORBIDDEN.some(re => re.test(f)));
if (violations.length) {
  console.error(`dist/ contient ${violations.length} fichier(s) interdit(s) :\n  ${violations.slice(0, 10).join('\n  ')}`);
  process.exit(1);
}

// Le site appelle ses ressources en chemins absolus (/assets/…) et ses espaces en
// répertoires (/compte/, /admin/) : chaque cible doit exister dans dist/.
function resolveTarget(target) {
  const clean = target.replace(/^\//, '').split('?')[0].split('#')[0];
  if (clean === '') return 'index.html';
  if (clean.endsWith('/')) return `${clean}index.html`;
  return clean;
}

const missing = new Set();
for (const f of found.filter(f => f.endsWith('.html'))) {
  const html = await readFileOrEmpty(join(DIST, f));
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    if (/^\/\//.test(m[1])) continue; // protocole absolu (//hôte), hors périmètre
    if (!(await exists(join(DIST, resolveTarget(m[1]))))) missing.add(`${f} → ${m[1]}`);
  }
}
if (missing.size) {
  console.error(`Références absolues sans cible dans dist/ :\n  ${[...missing].slice(0, 15).join('\n  ')}`);
  process.exit(1);
}

const sizes = await Promise.all(found.map(async f => (await stat(join(DIST, f))).size));
const bytes = sizes.reduce((a, b) => a + b, 0);
await writeFile(join(DIST, 'BUILD.txt'),
  `Assemblé par tools/build-dist.mjs\nfichiers: ${found.length}\n`
  + `poids: ${(bytes / 1048576).toFixed(2)} MiB\n`);

console.log(`dist/ — ${found.length} fichiers, ${(bytes / 1048576).toFixed(2)} MiB, ${pages.length} pages HTML`);

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
async function readFileOrEmpty(p) {
  try { return await readFile(p, 'utf8'); } catch { return ''; }
}
