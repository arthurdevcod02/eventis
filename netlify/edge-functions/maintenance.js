// maintenance.js — edge function Netlify : le seul morceau d'Eventis qui décide si une
// page est servie. Le réglage vit dans Supabase (table `site_settings`, écriture
// réservée à un administrateur par le RLS) ; ce fichier le LIT et ferme le site.
// Pendant une maintenance, aucune page du dépôt ne peut être rendue sans passer ici.
//
// FAIL-OPEN assumé : si la plateforme de données ne répond pas, le site reste normal.
// Une panne de Supabase ne doit pas inventer une panne d'Eventis. Le corollaire, à ne pas
// découvrir un jour de coupure : si Netlify n'arrive pas à joindre Supabase, la
// maintenance peut ne pas s'appliquer pendant quelques secondes.
//
// Ce que cette page NE fait PAS : elle n'a aucun moyen de savoir qui est connecté.
// La session d'Eventis vit dans le localStorage du navigateur, jamais dans un cookie,
// donc Netlify ne reçoit aucun identifiant avec la demande. Le panneau /admin/ et les
// pages /auth/ restent donc atteignables — c'est ce qui permet à un administrateur de
// venir désactiver la maintenance, même déconnecté. Les DONNEES, elles, restent
// verrouillées par le RLS : la coquille d'une page admin se charge, elle ne montre rien.

const TTL_DRAPEAU_MS = 10_000;
const DELAI_RESEAU_MS = 800;

// Préfixes jamais filtrés — chaque exception a une raison, pas une convenance.
// /assets/ : la page de maintenance a besoin de sa feuille de style et de son logo.
// /admin/ : c'est là que se trouve l'interrupteur.
// /auth/ : sans page de connexion, plus aucun administrateur ne peut se connecter pour
// rouvrir le site ; la maintenance deviendrait irréversible depuis le site lui-même.
const EXEMPTES_PREFIXES = ['/assets/', '/admin/', '/auth/'];
const EXEMPTS_CHEMINS = new Set([
  '/maintenance.html',   // la page du filtre elle-même : sinon, boucle de réécriture
  '/contact.html',       // le lien « Nous écrire » de cette page doit conduire quelque part
  '/sw.js',              // le service worker : bloquer le worker casserait le site après la reprise
  '/manifest.webmanifest',
]);

function doitEtreFiltre(chemin) {
  if (EXEMPTES_PREFIXES.some((prefixe) => chemin.startsWith(prefixe))) return false;
  if (EXEMPTS_CHEMINS.has(chemin)) return false;
  // Le filtre ne porte que sur des pages : un nom de fichier avec extension (.css, .png,
  // .svg…) n'est jamais une page. Cette règle évite de facturer et de retarder chaque
  // ressource, même si la déclaration `path` ci-dessous laisse arriver la demande.
  const derniere = chemin.split('/').pop() ?? '';
  return !derniere.includes('.') || derniere.endsWith('.html');
}

// Une maintenance ne se déclenche pas 200 fois par visite : le drapeau est gardé en
// mémoire dans l'isolat, le temps que l'administrateur voie l'effet de son enregistrement.
let memoire = { expire: 0, actif: false };

async function litDrapeau() {
  const maintenant = Date.now();
  if (maintenant < memoire.expire) return memoire;

  const url = Netlify.env.get('SUPABASE_URL');
  const cle = Netlify.env.get('SUPABASE_ANON_KEY');
  if (!url || !cle) {
    // Silencieusement en surface, mais visible dans Logs & Metrics > Edge Functions.
    console.warn('[maintenance] SUPABASE_URL ou SUPABASE_ANON_KEY absente du contexte '
      + 'd’exécution — variable d’environnement sans la portée « Functions » ? filtre non appliqué');
    memoire = { expire: maintenant + TTL_DRAPEAU_MS, actif: false };
    return memoire;
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_RESEAU_MS);
  try {
    const reponse = await fetch(`${url}/rest/v1/site_settings?select=maintenance_enabled&id=eq.1`, {
      headers: { apikey: cle, Authorization: `Bearer ${cle}`, Accept: 'application/json' },
      signal: controleur.signal,
    });
    // Statut non 200 = table absente, réseau cassé, projet en pause : site normal.
    if (!reponse.ok) {
      console.warn(`[maintenance] lecture du drapeau en échec (statut ${reponse.status}) — filtre non appliqué`);
      memoire = { expire: maintenant + TTL_DRAPEAU_MS, actif: false };
      return memoire;
    }
    const lignes = await reponse.json();
    memoire = { expire: maintenant + TTL_DRAPEAU_MS, actif: lignes?.[0]?.maintenance_enabled === true };
    return memoire;
  } catch (erreur) {
    memoire = { expire: maintenant + TTL_DRAPEAU_MS, actif: false };
    return memoire;
  } finally {
    clearTimeout(minuteur);
  }
}

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return;
  const url = new URL(request.url);
  if (!doitEtreFiltre(url.pathname)) return;
  if (!(await litDrapeau()).actif) return;

  // Le corps vient du fichier du dépôt : un seul endroit où le texte de la page est écrit,
  // en français, avec son CSS et son bouton. 503 = « indisponible, repassez », et
  // `no-store` pour qu'aucun cache (CDN, navigateur, service worker) ne rejoue la page
  // après la reprise.
  try {
    const ressource = await fetch(new URL('/maintenance.html', url), { headers: { Accept: 'text/html' } });
    if (!ressource.ok) throw new Error(`statut ${ressource.status}`);
    return new Response(ressource.body, {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-eventis-maintenance': 'active',
      },
    });
  } catch (erreur) {
    // Repli : réécriture même-site, statut 200. Le visiteur voit bien la page de
    // maintenance ; seul le code 503 se perd. Cette page mal codée vaut mieux qu'une
    // erreur Netlify nue.
    return new URL('/maintenance.html', url);
  }
};

// Déclarée ici et pas dans netlify.toml : une edge function sans route se déploie sans
// erreur, sans avertissement, et ne s'exécute JAMAIS. `excludedPath` tient les ressources
// hors du compteur d'appels ; la garde dans le code reste la seconde protection.
export const config = {
  path: ['/*'],
  excludedPath: [
    '/assets/*',
    '/admin/*',
    '/auth/*',
    '/maintenance.html',
    '/contact.html',
    '/sw.js',
    '/manifest.webmanifest',
  ],
  // Une exception dans ce fichier ne doit jamais fermer le site : on continue la chaîne.
  onError: 'bypass',
};
