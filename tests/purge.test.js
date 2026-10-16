// Verrous statiques des fichiers de purge (supabase/purge-*.sql).
//
// Pourquoi des tests sur du SQL que nous ne pouvons PAS exécuter ici : la purge se joue
// dans l'éditeur SQL du projet en ligne, une fois, sans retour en arrière, et sous la
// main d'un non-développeur à qui l'on demande de coller un fichier entier. Ce qui peut
// casser après coup n'est pas la syntaxe — elle sera validée par l'éditeur au moment de
// l'exécution — mais une retouche future qui inverserait l'ordre des suppressions,
// oublierait le garde-fou d'administrateur, ferait disparaître les catégories, ou
// transformerait le fichier de lecture seule en fichier d'écriture. Chacune de ces
// erreurs est détectable en lisant le texte, donc testable ici.
//
// Ce que ces tests ne prouvent PAS : que les fichiers s'exécutent, que les comptes visés
// existent réellement, ni que le réattachage laisse le catalogue consultable. Ça se mesure
// dans l'éditeur SQL (purge-etat-des-lieux.sql d'abord, puis le select de preuve en fin de
// chaque fichier de purge).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = chemin => readFileSync(new URL(chemin, import.meta.url), 'utf8');

const ETAT = '../supabase/purge-etat-des-lieux.sql';
const QA = '../supabase/purge-sondes-qa.sql';
const INTACT = '../supabase/purge-demo-catalogue-intact.sql';
const VIDE = '../supabase/purge-demo-catalogue-vide.sql';

// Les 14 identifiants créés par le seed, lu à la source : c'est la liste de référence.
const idsComptesSeed = [...lire('../supabase/seed.sql')
  .matchAll(/^  \('([0-9a-f-]{36})', 'authenticated'/gm)].map(m => m[1]);

const horsCommentaires = sql =>
  sql.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');

// Un fichier de purge = un bloc « do » atomique + un select de preuve. Deux instructions
// d'écriture séparées voudraient dire deux transactions : la seconde pourrait réussir
// après un échec de la première et laisser la base à moitié vidée.
const blocDo = sql => {
  const corps = sql.match(/^do \$\$\n([\s\S]*?)\nend \$\$;$/m);
  assert.ok(corps, 'un unique bloc « do $$ … end $$; » attendu');
  assert.equal((sql.match(/^do \$\$/gm) || []).length, 1);
  return corps[1];
};

test('la liste des comptes de démo vient du seed, et rien d\'autre', () => {
  assert.equal(idsComptesSeed.length, 14, 'le seed crée 14 comptes');
  for (const fichier of [ETAT, INTACT, VIDE]) {
    const sql = lire(fichier);
    for (const id of idsComptesSeed) {
      assert.ok(sql.includes(id), `${fichier} doit nommer le compte ${id}`);
    }
    // Aucun identifiant non prévu ne doit se glisser dans une purge : un uuid inconnu du
    // seed dans ces fichiers signale une cible ajoutée à la main, donc non vérifiée.
    for (const m of sql.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)) {
      assert.ok(idsComptesSeed.includes(m[0]), `${fichier} cite un uuid absent du seed : ${m[0]}`);
    }
  }
  // Les purges qui détruisent des lignes ne doivent pas non plus coder en dur des ids de
  // demandes, messages ou avis : tout est dérivé par requête, sinon la liste pourrit.
  for (const fichier of [QA, INTACT, VIDE]) {
    assert.match(lire(fichier), /array_agg/, `${fichier} doit dériver ses cibles par requête`);
  }
});

test('purge-etat-des-lieux est strictement en lecture', () => {
  const sql = horsCommentaires(lire(ETAT));
  for (const mot of ['delete from', 'update ', 'insert into', 'truncate', 'drop ', 'alter ']) {
    assert.ok(!sql.toLowerCase().includes(mot), `le fichier de lecture seule contient « ${mot.trim()} »`);
  }
  assert.ok((sql.match(/^select/gim) || []).length >= 5, 'l\'état des lieux doit rendre plusieurs grilles');
});

test('les fichiers de purge suppriment dans l ordre des clés étrangères', () => {
  // Paires imposées par schema.sql, et par rien d'autre : requests.client_id,
  // messages.sender_id, reviews.client_id et reviews.request_id n'ont PAS de cascade, donc
  // supprimer la racine avant la feuille fait échouer la transaction en cours de route ;
  // et providers est en cascade pour services, donc une suppression directe des prestations
  // emporterait des lignes que le fichier ne cite pas.
  const paires = [
    ['public.reviews', 'public.requests'],
    ['public.messages', 'public.profiles'],
    ['public.requests', 'public.providers'],
    ['public.requests', 'public.profiles'],
    ['public.providers', 'public.profiles'],
    ['public.contact_messages', 'auth.users'],
    ['public.profiles', 'auth.users'],
  ];
  for (const fichier of [QA, INTACT, VIDE]) {
    const corps = blocDo(lire(fichier));
    const effaces = [...corps.matchAll(/delete from ([a-z_.]+)/g)].map(m => m[1]);
    for (const [a, b] of paires) {
      if (!effaces.includes(a) || !effaces.includes(b)) continue;
      assert.ok(effaces.indexOf(a) < effaces.indexOf(b),
        `${fichier} : « delete from ${a} » doit précéder « delete from ${b} »`);
    }
    assert.ok(effaces.includes('auth.users'), `${fichier} doit supprimer les comptes, pas seulement les profils`);
    assert.equal(effaces[effaces.length - 1], 'auth.users', `${fichier} : les comptes doivent partir en dernier`);
    for (const table of ['public.services', 'public.categories', 'public.site_settings']) {
      assert.ok(!effaces.includes(table), `${fichier} ne doit pas supprimer ${table}`);
    }
  }
});

test('les trois gardes-fous administrateurs sont écrits dans les fichiers qui suppriment', () => {
  // Le verrou est écrit fichier par fichier, avec la condition exacte : un test qui se
  // contenterait de « raise exception » et « role = 'admin' » quelque part dans le bloc
  // resterait vert après suppression du garde-fou (vérifié par contrôle négatif — les deux
  // expressions survivent de toute façon dans les requêtes de comptage).
  const gardesFous = {
    [QA]: /if n_admins_total - n_admins_cibles < 1 then\s*\n\s*raise exception/,
    [INTACT]: /if n_admins_hors_demo = 0 then\s*\n\s*raise exception/,
    [VIDE]: /if n_admins_hors_demo = 0 then\s*\n\s*raise exception/,
  };
  for (const fichier of [QA, INTACT, VIDE]) {
    const corps = blocDo(lire(fichier));
    // Une cible vide ne doit jamais tourner en « purge réussie de rien » : le fichier
    // s'arrête, sinon un motif d'e-mail mal orthographié passe inaperçu.
    assert.match(corps, /is null then\s*\n\s*raise exception/, `${fichier} doit refuser une cible absente`);
    assert.match(corps, gardesFous[fichier], `${fichier} doit refuser plutôt que verrouiller /admin`);
    assert.match(corps, /role = 'admin'/, `${fichier} doit compter les administrateurs avant d'écrire`);
  }
});

test('catalogue-intact réattache au lieu de détruire, catalogue-vide détruit', () => {
  const intact = blocDo(lire(INTACT));
  const vide = blocDo(lire(VIDE));
  assert.ok(!intact.includes('delete from public.providers'),
    'la variante « catalogue intact » ne supprime aucune fiche');
  assert.match(intact, /update public\.providers pr set profile_id = v_admin/);
  assert.match(intact, /select p\.id into v_admin from public\.profiles p/,
    'le destinataire des contenus doit être un administrateur survivant, choisi explicitement');
  // Les avis de démo sont conservés dans cette variante : sans détachement de leur
  // demande, la suppression des demandes échoue (reviews.request_id n'a pas de cascade).
  assert.match(intact, /update public\.reviews rv set request_id = null/);
  assert.match(vide, /delete from public\.providers pr/);
  assert.ok(!vide.includes('set profile_id'), 'la variante « catalogue vide » ne réattache rien');
  // La variante destructrice supprime six tables dans l'ordre : avis, messages, demandes,
  // fiches, profils, comptes. Un chiffre de moins veut dire une clé étrangère sans cascade
  // qui fera échouer la purge en cours de route.
  assert.equal((vide.match(/delete from/g) || []).length, 6,
    'avis, messages, demandes, fiches, profils, comptes');
});

test('chaque purge se termine par une preuve lisible dans l éditeur', () => {
  for (const fichier of [QA, INTACT, VIDE]) {
    const sql = lire(fichier);
    const fin = sql.slice(sql.lastIndexOf('end $$;'));
    assert.match(fin, /^end \$\$;\n+\(?.*-- [A-Z]/s, 'un select de preuve commenté suit le bloc');
    assert.match(fin, /^select$/m);
    assert.ok((horsCommentaires(fin).match(/as /g) || []).length >= 3, 'la preuve doit nommer ses compteurs');
  }
});

test('aucune clé de service ni jeton n\'apparaît dans les fichiers de purge', () => {
  // Le mot de passe de démo est déjà publié (seed.sql + README) : c'est précisément pour
  // ça que la purge existe. Ce fichier-ci, en revanche, ne doit charrier aucune credential.
  for (const fichier of [ETAT, QA, INTACT, VIDE]) {
    const sql = lire(fichier);
    for (const motif of ['service_role', 'eyJ', 'sb_secret', 'sb_publishable', 'postgres://']) {
      assert.ok(!sql.includes(motif), `${fichier} contient « ${motif} »`);
    }
  }
});
