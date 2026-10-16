// Verrous de l'invitation à installer (install-prompt.js).
// Ce composant mentirait de deux façons : promettre une installation que le navigateur
// n'a pas proposée, ou promettre un mode hors ligne qu'Eventis n'a pas. Les deux sont
// contrôlés ici, avec l'hygiène de stockage, les pages exclues et la CSP, parce qu'une
// régression sur l'un d'eux ne se voit pas dans l'interface — elle ne se lit que sur le
// site en ligne. Les contrôles portent sur le CODE (commentaires retirés) : un commentaire
// qui explique ce qu'il ne faut pas promettre ne doit pas faire échouer le verrou.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lire = chemin => readFileSync(new URL(chemin, import.meta.url), 'utf8');
const brut = lire('../assets/js/components/install-prompt.js');
const sw = lire('../sw.js');
const code = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('copie de l’invitation : les quatre textes demandés, mot pour mot', () => {
  assert.ok(code.includes('Emportez Eventis partout avec vous'), 'titre absent');
  assert.match(code, /Retrouvez vos prestataires événementiels et préparez vos événements plus facilement depuis votre écran d.accueil\./);
  assert.ok(code.includes('>Installer Eventis</button>'), 'bouton principal absent');
  assert.ok(code.includes('>Plus tard</button>'), 'bouton secondaire absent');
});

test('aucune fausse confirmation : le clic ne déclare jamais l’installation réussie', () => {
  assert.doesNotMatch(code, /Installation réussie|installée avec succès|vient d’être installée/);
  // Seul l'événement du navigateur écrit la mémoire de l'installation.
  assert.match(code, /window\.addEventListener\('appinstalled'[\s\S]{0,120}write\(DONE_KEY\)/);
  assert.match(code, /if \(path === 'none'\) return;/,
    'un chemin inconnu afficherait un bouton qui n’installe rien');
});

test('aucune promesse hors ligne dans ce que voit le visiteur', () => {
  assert.doesNotMatch(code, /hors ligne|sans connexion|mode offline/i);
  // Et l'inverse est écrit : la bannière dit elle-même qu'elle n'apporte pas le hors ligne.
  assert.match(brut, /ne rend pas\s+'\s*\+\s*'les données consultables hors connexion/);
});

test('stockage : quatre clés connues, et une seule écriture — un horodatage', () => {
  for (const cle of ['eventis_install_later_at', 'eventis_installed_at',
    'eventis_install_pages_shown', 'eventis_visit_pages']) {
    assert.ok(brut.includes(`'${cle}'`), `clé manquante : ${cle}`);
  }
  // Le marqueur de visite est borné : ni booléen qui se fait croquer par une
  // redirection, ni invitation répétée à chaque page.
  assert.match(brut, /const MAX_PAR_VISITE = 2/);
  assert.match(code, /Number\(sessionStorageGet\(SHOWN_KEY\) \|\| '0'\) >= MAX_PAR_VISITE/);
  assert.equal(code.match(/localStorage\.setItem\(/g).length, 1);
  assert.match(code, /localStorage\.setItem\(key, String\(Date\.now\(\)\)\)/);
  // Une seule écriture, et c'est Date.now() : rien de personnel ne peut atteindre le stockage.
  assert.equal(code.match(/localStorage\.(setItem|removeItem|clear)/g).length, 1);
});

test('les pages d’administration et de passage ne reçoivent pas l’invitation', () => {
  assert.ok(brut.includes('/^\\/admin/'), 'l’admin doit être exclue');
  assert.ok(brut.includes('/^\\/auth/'), 'auth doit être exclue');
  assert.match(code, /if \(EXCLUDED\.some\(rx => rx\.test\(location\.pathname\)\)\) return;/);
});

test('le service worker ne met en cache aucune page protégée', () => {
  const bloc = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.ok(bloc.length > 0, 'PRECACHE introuvable dans sw.js');
  for (const interdit of ['/admin', '/compte', '/espace-prestataire', '/auth']) {
    assert.ok(!bloc.includes(`'${interdit}`), `${interdit} ne doit pas être pré-enregistré`);
  }
  // Les URL paramétrées (les données d'un compte) restent hors du cache.
  assert.match(sw, /if \(url\.search\) return false;/);
});

test('rien d’exécutable dans le balisage généré — script-src ne permet pas l’inline', () => {
  assert.doesNotMatch(code, /\son(click|change|input|submit|load)="/);
  assert.doesNotMatch(code, /document\.write/);
  assert.doesNotMatch(code, /<script/);
});

test('la bannière est branchée là où les vingt-huit pages montent déjà le pied de page', () => {
  const footer = lire('../assets/js/components/footer.js');
  assert.match(footer, /import \{ mountInstallPrompt \} from '\.\/install-prompt\.js';/);
  assert.match(footer, /registerServiceWorker\(\);\r?\n\s*\/\/[\s\S]*?\r?\n\s*mountInstallPrompt\(\);/);
});
