# Eventis — Phase 1 : plateforme événementielle — Plan d'implémentation

> **Pour les agents d'exécution :** sous-skill REQUIS : utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe de cases à cocher (`- [ ]`) pour le suivi.

**Objectif :** construire la plateforme complète Eventis (site public, comptes client/prestataire, messagerie, administration, avis, PWA) en HTML/CSS/JS sur mesure, fonctionnant d'abord en mode démo puis branchable sur Supabase.

**Architecture :** application multi-pages sans build. Une couche de données unique (`db.js`) avec deux adaptateurs (démo localStorage / Supabase) et une authentification interchangeable (`auth.js`). Toutes les pages ne parlent qu'à ces interfaces. Design system complet par tokens CSS. Tests unitaires Node (`node --test`) pour la logique ; QA navigateur pour les pages.

**Stack :** HTML5, CSS3 (variables natives), JavaScript ES modules, GSAP 3.12 (local), supabase-js 2 (local, inactif en démo), Node ≥ 18 (serveur de dev + tests). Aucune dépendance npm.

**Spec :** `docs/superpowers/specs/2026-10-13-eventis-design.md` (à lire — ce plan en découle).

## Contraintes globales

(Chaque tâche hérite implicitement de ces règles.)

- Palette exacte : blanc `#FFFFFF`, noir `#111111`, orange `#F97316`, orange survol `#EA580C`, vert `#16A34A`, vert foncé `#166534`, gris `#F5F5F5` / `#E5E7EB` / `#6B7280`. **Aucun violet ni jaune.**
- Typographie : **Syne** (titres), **Plus Jakarta Sans** (UI). UI **100 % en français**.
- Montants en FCFA, entiers ; formatage `"150 000 FCFA"`.
- Badge vert « Vérifié » uniquement si `isVerified === true`. Statuts : demandes `sent|in_progress|accepted|declined|closed` ; prestataires `pending|approved|suspended`.
- Mode démo : indicateur « Mode démonstration » permanent ; **aucune fonctionnalité simulée présentée comme réelle** (pas de paiement ; mot de passe oublié en démo = consigne explicite).
- Préfixe de stockage démo : `eventis_demo_`. Comptes démo (affichés sur la page de connexion en mode démo uniquement) : `client@demo.tg` / `prestataire@demo.tg` / `admin@demo.tg`, mot de passe `demo1234`.
- Accessibilité : contraste AA, focus visibles, navigation clavier, cibles tactiles ≥ 44 px, `prefers-reduced-motion` respecté, testé à 360 px de large.
- Budget JS initial < 200 Ko hors vendor par page. Aucune requête réseau en mode démo (fonts locales, vendors locaux).
- `git init` au démarrage ; un commit propre à la fin de chaque tâche.

---

## Structure des fichiers (créée au fil des tâches)

```
eventis/                      ← racine du projet (= racine du workspace)
├── index.html · catalogue.html · prestataire.html
├── comment-ca-marche.html · contact.html · mentions-legales.html · 404.html
├── auth/connexion.html · auth/inscription.html
├── compte/index.html · compte/demandes.html · compte/messages.html · compte/profil.html
├── espace-prestataire/index.html · demandes.html · messages.html · services.html · profil.html
├── admin/index.html · prestataires.html · utilisateurs.html · avis.html · categories.html
├── assets/
│   ├── css/tokens.css · base.css · components.css · fonts.css · pages/*.css
│   ├── js/core/config.js · seed.js · db.js · auth.js · auth-demo.js · auth-supabase.js · ui.js · guards.js
│   ├── js/components/navbar.js · footer.js · messaging.js · stars.js
│   ├── js/pages/<un module par page>.js
│   ├── vendor/gsap.min.js · ScrollTrigger.min.js · supabase-js.min.js
│   ├── fonts/*.woff2 · icons/icon-512.png · img/hero.jpg · img/providers/*.jpg
├── manifest.webmanifest · sw.js
├── supabase/schema.sql · rls.sql · seed.sql
├── tools/serve.js · tools/export-seed.mjs
├── tests/helpers/memory-storage.js · tests/*.test.js
└── README.md
```

**Rôles des fichiers clés :** `seed.js` = source unique des données démo (génère aussi le SQL). `db.js` = interface de données + `createDb()`. `auth.js` = interface d'authentification + sélection d'adaptateur. `ui.js` = formatage, échappement, toasts, icônes, libellés de statuts. `guards.js` = protection des pages par rôle. `components/messaging.js` = messagerie partagée client/prestataire. `tools/serve.js` = serveur statique de développement (port 4173).

**Patron HTML partagé (chaque page le suit exactement) :**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>… — Eventis</title>
  <meta name="description" content="…">
  <script>try{document.documentElement.dataset.theme=localStorage.getItem('eventis_theme')||''}catch(e){}</script>
  <link rel="stylesheet" href="/assets/css/fonts.css">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
  <!-- css spécifique de la page -->
  <script src="/assets/vendor/gsap.min.js" defer></script>
  <script src="/assets/vendor/ScrollTrigger.min.js" defer></script>
  <script src="/assets/vendor/supabase-js.min.js" defer></script>
</head>
<body>
  <header id="site-header"></header>
  <main id="main">…contenu…</main>
  <footer id="site-footer"></footer>
  <script type="module" src="/assets/js/pages/<page>.js"></script>
</body>
</html>
```

---

## Tâche 1 : Fondations — projet, design system, couche de données démo, auth démo

**Livrable testable :** le serveur de dev tourne, une page coquille affiche navbar/footer/bannière mode démo, `node --test tests/` est entièrement vert, Supabase SQL généré.

**Fichiers :**
- Créer : tous les dossiers de l'arborescence ci-dessus, `tools/serve.js`, `tools/export-seed.mjs`
- Créer : `assets/css/tokens.css`, `base.css`, `components.css`, `fonts.css`
- Créer : `assets/js/core/config.js`, `seed.js`, `db.js`, `auth-demo.js`, `auth.js`, `ui.js`, `guards.js`
- Créer : `assets/js/components/navbar.js`, `footer.js`
- Créer : `tests/helpers/memory-storage.js`, `tests/db.test.js`, `tests/auth.test.js`, `tests/ui.test.js`
- Créer : `supabase/schema.sql`, `supabase/rls.sql`, `index.html` (coquille, remplacée en Tâche 2)
- Modifier : `.gitignore` (créer : `node_modules/`, `.DS_Store`, `Thumbs.db`)

**Interfaces produites (consommées par toutes les tâches suivantes) :**

```js
// config.js
export const CONFIG = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', APP_NAME: 'Eventis' };
export function isDemoMode();            // true si l'une des deux clés est vide

// db.js — toutes les méthodes sont async et retournent des objets plain JSON
export const db = createDb();
db.listCategories()                      // → [{id,slug,name,icon,active}]
db.listProviders(f)                      // f = {category,quarter,q,minRating,verifiedOnly,priceMax,sort}
                                         // sort = 'pertinence'|'note'|'prix-asc'|'prix-desc'
                                         // → [{id,businessName,categoryId,categoryName,city,quarter,phone,whatsapp,
                                         //     priceFrom,priceTo,coverUrl,isVerified,avgRating,reviewsCount,status}]
db.getProvider(id)                       // → idem + {description,gallery,services:[{id,label,description,price}],createdAt}
db.createProvider(profileId, data)       // data: {businessName,categoryId,description,city,quarter,phone,whatsapp,priceFrom,priceTo}
db.updateProvider(id, patch)             // champs publics éditables du prestataire
db.saveServices(providerId, services)    // services: [{id?,label,description,price}] — remplace la liste
db.createRequest({clientId,providerId,eventType,eventDate,guests,budget,message})
db.getRequest(id)                        // → + {client:{id,fullName}, provider:{id,businessName}}
db.listRequestsForClient(clientId)       // tri createdAt desc
db.listRequestsForProvider(providerId)
db.updateRequestStatus(id, {status, byRole}) // transitions: provider: sent→in_progress|accepted|declined|closed ;
                                             // client: accepted→closed. 'declined' exige d'abord un message du prestataire.
db.listMessages(requestId)               // tri createdAt asc
db.sendMessage({requestId, senderId, body})  // émetteur = partie de la demande ; passe le statut sent→in_progress
db.markRequestRead(requestId, readerId)  // readAt=maintenant sur les messages des autres
db.listThreadsFor(userId)                // → [{request, counterparty:{name,role}, lastMessage, unreadCount}]
db.createReview({requestId, clientId, rating, comment})
                                         // exige request closed + client de la demande ; visible=false par défaut
db.listReviewsForProvider(providerId)    // visibles uniquement → [{id,rating,comment,clientName,createdAt}]
db.listProvidersAdmin({status})          // tous statuts + owner {fullName,email}
db.setProviderStatus(id, status)         // pending|approved|suspended
db.setProviderVerified(id, isVerified)
db.listUsersAdmin()                      // → [{id,fullName,email,phone,role,suspended,createdAt}]
db.setUserSuspended(id, suspended)
db.listCategoriesAdmin()                 // toutes, y compris inactives
db.saveCategory({id?, slug, name, icon, active})
db.getStats()                            // → {providersActive,providersPending,clients,requestsMonth,signupsSeries:[{date,count}]}
db.saveContactMessage({name,email,message})
db.resetDemo()                           // efface et re-seed le stockage démo (tests/dev uniquement)

// auth.js
export const auth = createAuth();
auth.current()                           // → {id,fullName,email,phone,role,suspended} | null
auth.signUp({fullName,email,phone,password,role}) // role 'client'|'prestataire' ; lève Error('Cet e-mail est déjà utilisé.')
                                         // prestataire → crée un provider status 'pending' vide
auth.signIn(email, password)             // lève Error('Identifiants invalides.') / Error('Compte suspendu.')
auth.signOut()
auth.onChange(cb)                        // → unsubscribe ; cb(user|null) après chaque changement
auth.requestPasswordReset(email)         // démo: toast consigne ; réel: supabase.auth.resetPasswordForEmail
auth.getProviderIdFor(userId)            // → providerId | null (propriétaire)

// ui.js
export function formatFCFA(n)            // 250000 → "250 000 FCFA"
export function formatDateFR(iso)        // → "12 oct. 2026"
export function timeAgoFR(iso)           // → "il y a 3 j"
export function esc(s)                   // échappement HTML
export function toast(message, type = 'info') // type: info|success|error ; conteneur #toasts créé si absent
export function icon(name)               // svg inline string ; noms: fork,flower,camera,music,building,chair,rings,mic,
                                         // check,star,star-half,search,menu,close,arrow-right,mail,phone,whatsapp,eye,eye-off
export function renderStars(avg)         // → html svg 5 étoiles (pleines/vides selon arrondi)
export const REQUEST_STATUS = { sent:{label:'Envoyée',cls:'badge--sent'}, in_progress:{label:'En cours',cls:'badge--progress'},
  accepted:{label:'Acceptée',cls:'badge--accepted'}, declined:{label:'Refusée',cls:'badge--declined'}, closed:{label:'Clôturée',cls:'badge--closed'} }
export const EVENT_TYPES = [{id:'mariage',label:'Mariage'},{id:'anniversaire',label:'Anniversaire'},{id:'bapteme',label:'Baptême'},
  {id:'corporate',label:'Corporate / Séminaire'},{id:'autre',label:'Autre'}]
export function initReveal(scope = document) // révélations au scroll GSAP ; no-op si prefers-reduced-motion

// guards.js
export function requireAuth(roles = [])  // redirige vers /auth/connexion.html?next=<chemin> si non connecté ;
                                         // vers la home du bon espace si rôle non autorisé. Accepte roles: [] (tout utilisateur)
export const HOME_FOR = { client:'/compte/', prestataire:'/espace-prestataire/', admin:'/admin/' }
```

- [ ] **Étape 1 — Initialiser le dépôt et l'arborescence**

```bash
git init
mkdir -p assets/css/pages assets/js/core assets/js/components assets/js/pages assets/vendor assets/fonts assets/icons assets/img/providers tools tests/helpers supabase auth compte espace-prestataire admin
printf 'node_modules/\n.DS_Store\nThumbs.db\n' > .gitignore
```

- [ ] **Étape 2 — Serveur de dev `tools/serve.js`**

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = process.env.PORT || 4173;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.ico':'image/x-icon', '.sql':'text/plain' };

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    try { res.writeHead(200, {'Content-Type': MIME['.html']}); res.end(await readFile(join(ROOT, '404.html'))); }
    catch { res.writeHead(404); res.end('Not found'); }
  }
}).listen(PORT, () => console.log(`Eventis → http://localhost:${PORT}`));
```

Vérifier : `node tools/serve.js` répond 200 sur `http://localhost:4173/` (404.html n'existe pas encore → « Not found », c'est normal).

- [ ] **Étape 3 — Bibliothèques vendors locales**

```bash
curl -sL -o assets/vendor/gsap.min.js https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js
curl -sL -o assets/vendor/ScrollTrigger.min.js https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js
curl -sL -o assets/vendor/supabase-js.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js
```

Vérifier : les 3 fichiers existent et commencent par `!` ou `(` (JS minifié). Si le réseau est indisponible, réessayer plus tard — rien ne les charge tant que les pages ne sont pas créées.

- [ ] **Étape 4 — Polices locales `assets/css/fonts.css` + `assets/fonts/`**

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
curl -sL -A "$UA" "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" -o /tmp/fonts.css
grep -o 'https://[^)]*\.woff2' /tmp/fonts.css | sort -u > /tmp/font-urls.txt
i=0; while read -r u; do i=$((i+1)); curl -sL "$u" -o "assets/fonts/f$i.woff2"; done < /tmp/font-urls.txt
ls assets/fonts/   # noter le nombre de fichiers N
```

Écrire `assets/css/fonts.css` avec une déclaration `@font-face` par fichier téléchargé, en ordonnant les polices (les URL de la css2 sont groupées par famille/poids dans l'ordre de la requête — familles par ordre alphabétique de l'URL : Jakarta avant Syne). Format pour chaque fichier :

```css
@font-face {
  font-family: 'Plus Jakarta Sans';
  src: url('/assets/fonts/f1.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

Si le téléchargement échoue (hors-ligne) : écrire `fonts.css` avec un commentaire indiquant le fallback et passer à l'étape 5 — le fallback système (`system-ui, sans-serif`) garantit un rendu correct.

- [ ] **Étape 5 — `assets/css/tokens.css` (design tokens + mode sombre)**

```css
:root {
  --color-white: #FFFFFF;
  --color-black: #111111;
  --color-orange: #F97316;
  --color-orange-hover: #EA580C;
  --color-green: #16A34A;
  --color-green-dark: #166534;
  --color-gray-bg: #F5F5F5;
  --color-gray-border: #E5E7EB;
  --color-gray-text: #6B7280;
  --bg: var(--color-white);
  --bg-alt: var(--color-gray-bg);
  --surface: var(--color-white);
  --text: var(--color-black);
  --text-muted: var(--color-gray-text);
  --border: var(--color-gray-border);
  --font-title: 'Syne', system-ui, sans-serif;
  --font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 22px;
  --shadow-sm: 0 1px 2px rgba(17,17,17,.06);
  --shadow-md: 0 8px 24px rgba(17,17,17,.08);
  --shadow-lg: 0 16px 48px rgba(17,17,17,.12);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;
  --nav-h: 72px;
}
[data-theme="dark"] {
  --bg: #111111;
  --bg-alt: #181818;
  --surface: #1F1F1F;
  --text: #F5F5F5;
  --text-muted: #9CA3AF;
  --border: #2E2E2E;
  --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --shadow-md: 0 8px 24px rgba(0,0,0,.5);
  --shadow-lg: 0 16px 48px rgba(0,0,0,.6);
}
```

- [ ] **Étape 6 — `assets/css/base.css` et `components.css`**

`base.css` : reset minimal (`*,*::before,*::after{box-sizing:border-box;margin:0}`), `html{scroll-behavior:smooth}`, `body{font-family:var(--font-body);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}`, titres `h1..h3{font-family:var(--font-title);line-height:1.1;font-weight:700}`, `h1{font-size:clamp(2rem,5vw,3.5rem)}`, `a{color:inherit}`, `img{max-width:100%;display:block}`, `:focus-visible{outline:3px solid var(--color-orange);outline-offset:2px}`, `button{font:inherit;cursor:pointer;min-height:44px}`, `.container{width:min(1120px,100% - 2*var(--space-5));margin-inline:auto}`, `.section{padding-block:var(--space-8)}`, utilitaires `.muted`, `.grid`, `.hidden`.

`components.css` : boutons, badges, cartes, formulaires, nav, footer, skeletons, toasts, tables, modales, états vides. Contenu exact :

```css
/* Boutons */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:var(--space-2); padding:12px 22px;
  border-radius:var(--radius-sm); border:1px solid transparent; font-weight:600; text-decoration:none;
  transition:background .2s, color .2s, border-color .2s, transform .15s; }
.btn:active { transform:translateY(1px); }
.btn--primary { background:var(--color-orange); color:#fff; }
.btn--primary:hover { background:var(--color-orange-hover); }
.btn--outline { background:transparent; color:var(--text); border-color:var(--border); }
.btn--outline:hover { border-color:var(--color-orange); color:var(--color-orange); }
.btn--ghost { background:transparent; color:var(--text); }
.btn--ghost:hover { background:var(--bg-alt); }
.btn--success { background:var(--color-green); color:#fff; }
.btn--success:hover { background:var(--color-green-dark); }
.btn--sm { padding:8px 14px; min-height:36px; font-size:.875rem; }
.btn--block { width:100%; }
.btn[disabled] { opacity:.5; cursor:not-allowed; }

/* Badges */
.badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px;
  font-size:.75rem; font-weight:600; background:var(--bg-alt); color:var(--text-muted); }
.badge--verified { background:rgba(22,163,74,.12); color:var(--color-green-dark); }
[data-theme="dark"] .badge--verified { color:#4ADE80; }
.badge--sent { background:rgba(107,114,128,.12); color:var(--text-muted); }
.badge--progress { background:rgba(249,115,22,.12); color:var(--color-orange-hover); }
.badge--accepted { background:rgba(22,163,74,.12); color:var(--color-green-dark); }
[data-theme="dark"] .badge--accepted { color:#4ADE80; }
.badge--declined { background:rgba(220,38,38,.12); color:#B91C1C; }
.badge--closed { background:rgba(17,17,17,.08); color:var(--text-muted); }

/* Cartes */
.card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);
  overflow:hidden; transition:box-shadow .25s, transform .25s; }
.card:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); }
.card__media { aspect-ratio:3/2; object-fit:cover; width:100%; }
.card__body { padding:var(--space-5); display:grid; gap:var(--space-2); }
.card__title { font-family:var(--font-title); font-size:1.125rem; font-weight:700; }
.card__meta { color:var(--text-muted); font-size:.875rem; }

/* Formulaires */
.field { display:grid; gap:6px; margin-bottom:var(--space-4); }
.field label { font-weight:600; font-size:.9rem; }
.field input, .field select, .field textarea { font:inherit; color:var(--text); background:var(--surface);
  border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px 14px; min-height:44px; }
.field input:focus, .field select:focus, .field textarea:focus { border-color:var(--color-orange); outline:none;
  box-shadow:0 0 0 3px rgba(249,115,22,.18); }
.field .error { color:#DC2626; font-size:.8rem; }
.form-errors { background:rgba(220,38,38,.08); color:#B91C1C; border-radius:var(--radius-sm);
  padding:var(--space-3) var(--space-4); margin-bottom:var(--space-4); font-size:.9rem; }

/* Skeletons */
.skeleton { position:relative; overflow:hidden; background:var(--bg-alt); border-radius:var(--radius-sm); }
.skeleton::after { content:''; position:absolute; inset:0; transform:translateX(-100%);
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
  animation:shimmer 1.4s infinite; }
@keyframes shimmer { to { transform:translateX(100%); } }

/* Toasts */
#toasts { position:fixed; bottom:var(--space-5); left:50%; transform:translateX(-50%);
  display:grid; gap:var(--space-2); z-index:100; width:min(420px, calc(100vw - 32px)); }
.toast { background:var(--color-black); color:#fff; padding:14px 18px; border-radius:var(--radius-sm);
  box-shadow:var(--shadow-lg); font-size:.9rem; }
.toast--success { background:var(--color-green); }
.toast--error { background:#DC2626; }

/* Tableaux (admin) */
.table { width:100%; border-collapse:collapse; font-size:.9rem; }
.table th, .table td { text-align:left; padding:12px 14px; border-bottom:1px solid var(--border); }
.table th { color:var(--text-muted); font-weight:600; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; }

/* États vides */
.empty { text-align:center; padding:var(--space-7) var(--space-5); color:var(--text-muted); }
.empty svg { margin-inline:auto; margin-bottom:var(--space-3); }

/* Bannière mode démo */
.demo-banner { background:var(--color-black); color:#fff; text-align:center; font-size:.8rem;
  padding:6px var(--space-4); position:sticky; top:0; z-index:60; }
.demo-banner strong { color:var(--color-orange); }

/* Étoiles */
.stars { display:inline-flex; gap:2px; color:var(--color-orange); }
.stars .off { color:var(--border); }
```

- [ ] **Étape 7 — `assets/js/core/config.js`**

```js
export const CONFIG = {
  SUPABASE_URL: '',        // ex. 'https://xyz.supabase.co' — vide = mode démo
  SUPABASE_ANON_KEY: '',   // clé anonyme (public) — jamais la clé service
  APP_NAME: 'Eventis',
  DEMO_PASSWORD: 'demo1234',
};

export function isDemoMode() {
  return !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
}
```

- [ ] **Étape 8 — `assets/js/core/seed.js` (source unique des données démo)**

```js
const DAY = 86400000;
const daysAgo = n => new Date(Date.now() - n * DAY).toISOString();

export const SEED_CATEGORIES = [
  { id: 'cat-traiteur', slug: 'traiteur', name: 'Traiteur & Restauration', icon: 'fork' },
  { id: 'cat-decoration', slug: 'decoration', name: 'Décoration', icon: 'flower' },
  { id: 'cat-photo', slug: 'photo-video', name: 'Photo & Vidéo', icon: 'camera' },
  { id: 'cat-dj', slug: 'dj-sonorisation', name: 'DJ & Sonorisation', icon: 'music' },
  { id: 'cat-salle', slug: 'salles-lieux', name: 'Salles & Lieux', icon: 'building' },
  { id: 'cat-location', slug: 'location-materiel', name: 'Location de matériel', icon: 'chair' },
  { id: 'cat-wedding', slug: 'wedding-planner', name: 'Wedding Planner', icon: 'rings' },
  { id: 'cat-animation', slug: 'animation', name: 'Animation & MC', icon: 'mic' },
];

export const SEED_USERS = [
  { id: 'u-client', fullName: 'Afi Mensah', email: 'client@demo.tg', phone: '+228 90 11 22 33', role: 'client', createdAt: daysAgo(45) },
  { id: 'u-kossi', fullName: 'Kossi Amevor', email: 'kossi@example.tg', phone: '+228 91 44 55 66', role: 'client', createdAt: daysAgo(38) },
  { id: 'u-ayaba', fullName: 'Ayaba Kpodar', email: 'ayaba@example.tg', phone: '+228 92 77 88 99', role: 'client', createdAt: daysAgo(21) },
  { id: 'u-presta', fullName: 'Kokou Aïvodji', email: 'prestataire@demo.tg', phone: '+228 90 55 66 77', role: 'prestataire', createdAt: daysAgo(60) },
  { id: 'u-admin', fullName: 'Équipe Eventis', email: 'admin@demo.tg', phone: '+228 70 00 00 00', role: 'admin', createdAt: daysAgo(90) },
];

// 10 prestataires — 3 vérifiés (isVerified). MC rattaché à la catégorie animation.
export const SEED_PROVIDERS = [
  { id: 'p-saveurs', ownerId: 'u-presta', businessName: 'Saveurs d’Atakpamé', categoryId: 'cat-traiteur',
    description: 'Cuisine togolaise et internationale pour mariages, baptêmes et séminaires. Menus sur mesure, service traiteur complet de la préparation au dressage.',
    city: 'Lomé', quarter: 'Bè', phone: '+228 90 55 66 77', whatsapp: '+228 90 55 66 77',
    priceFrom: 250000, priceTo: 2500000, coverUrl: '/assets/img/providers/saveurs-d-atakpame.jpg',
    gallery: [], status: 'approved', isVerified: true, createdAt: daysAgo(58) },
  { id: 'p-fiore', ownerId: 'u-own-fiore', businessName: 'Élégance & Fiore', categoryId: 'cat-decoration',
    description: 'Scénographie florale et décoration d’événements : arches, tables d’honneur, éclairage d’ambiance et art de la table.',
    city: 'Lomé', quarter: 'Agbalépédogan', phone: '+228 93 12 34 56', whatsapp: '+228 93 12 34 56',
    priceFrom: 150000, priceTo: 1800000, coverUrl: '/assets/img/providers/elegance-fiore.jpg',
    gallery: [], status: 'approved', isVerified: true, createdAt: daysAgo(41) },
  { id: 'p-lumen', ownerId: 'u-own-lumen', businessName: 'Lumen Studio', categoryId: 'cat-photo',
    description: 'Photographie et vidéo d’événements : reportage mariage, drone, livre photo et même-minute. Équipe de 4 photographes.',
    city: 'Lomé', quarter: 'Tokoin', phone: '+228 96 22 44 88', whatsapp: '+228 96 22 44 88',
    priceFrom: 180000, priceTo: 900000, coverUrl: '/assets/img/providers/lumen-studio.jpg',
    gallery: [], status: 'approved', isVerified: true, createdAt: daysAgo(35) },
  { id: 'p-kroll', ownerId: 'u-own-kroll', businessName: 'DJ K-Roll Sound', categoryId: 'cat-dj',
    description: 'DJ professionnel, sonorisation et éclairage scénique pour soirées privées, mariages et événements corporate.',
    city: 'Lomé', quarter: 'Adidogomé', phone: '+228 97 33 55 11', whatsapp: '+228 97 33 55 11',
    priceFrom: 120000, priceTo: 600000, coverUrl: '/assets/img/providers/dj-kroll.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(30) },
  { id: 'p-baobab', ownerId: 'u-own-baobab', businessName: 'Espace Le Baobab', categoryId: 'cat-salle',
    description: 'Salle des fêtes climatisée de 300 places avec parking, cuisine équipée et espace extérieur pour cérémonies laïques.',
    city: 'Lomé', quarter: 'Agoè', phone: '+228 91 66 22 44', whatsapp: '+228 91 66 22 44',
    priceFrom: 400000, priceTo: 1200000, coverUrl: '/assets/img/providers/espace-baobab.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(26) },
  { id: 'p-loca', ownerId: 'u-own-loca', businessName: 'LocaFête', categoryId: 'cat-location',
    description: 'Location de chaises, tables, barnums, nappes et vaisselle pour tous vos événements. Livraison dans tout Grand Lomé.',
    city: 'Lomé', quarter: 'Hédzranawoé', phone: '+228 92 88 44 22', whatsapp: '+228 92 88 44 22',
    priceFrom: 50000, priceTo: 800000, coverUrl: '/assets/img/providers/locafete.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(22) },
  { id: 'p-nkonou', ownerId: 'u-own-nkonou', businessName: 'N’Konou Events', categoryId: 'cat-wedding',
    description: 'Wedding planner : coordination du jour J, recherche de prestataires, budget et planning. Mariages clés en main.',
    city: 'Lomé', quarter: 'Agoè', phone: '+228 94 11 33 77', whatsapp: '+228 94 11 33 77',
    priceFrom: 300000, priceTo: 2000000, coverUrl: '/assets/img/providers/nkonou-events.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(18) },
  { id: 'p-agbe', ownerId: 'u-own-agbe', businessName: 'Agbé Animation', categoryId: 'cat-animation',
    description: 'Animation de soirées : jeux, danse traditionnelle et moderne, mascottes et shows pour enfants.',
    city: 'Lomé', quarter: 'Bè', phone: '+228 95 44 88 22', whatsapp: '+228 95 44 88 22',
    priceFrom: 100000, priceTo: 500000, coverUrl: '/assets/img/providers/agbe-animation.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(15) },
  { id: 'p-voix', ownerId: 'u-own-voix', businessName: 'Voix d’Or MC', categoryId: 'cat-animation',
    description: 'Maître de cérémonie bilingue français-ewé, animation de mariages, galas et conférences.',
    city: 'Lomé', quarter: 'Tokoin', phone: '+228 98 55 11 99', whatsapp: '+228 98 55 11 99',
    priceFrom: 80000, priceTo: 400000, coverUrl: '/assets/img/providers/voix-d-or.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(10) },
  { id: 'p-gourmand', ownerId: 'u-own-gourmand', businessName: 'Le Gourmand d’Or', categoryId: 'cat-traiteur',
    description: 'Pâtisserie de cérémonie : pièces montées, gâteaux d’anniversaire personnalisés et buffets sucrés.',
    city: 'Lomé', quarter: 'Adidogomé', phone: '+228 90 99 88 77', whatsapp: '+228 90 99 88 77',
    priceFrom: 60000, priceTo: 700000, coverUrl: '/assets/img/providers/gourmand-or.jpg',
    gallery: [], status: 'approved', isVerified: false, createdAt: daysAgo(6) },
];

export const SEED_SERVICES = [
  { id: 's1', providerId: 'p-saveurs', label: 'Buffet mariage (par personne)', description: 'Entrée, plat, dessert, boissons', price: 4500 },
  { id: 's2', providerId: 'p-saveurs', label: 'Cocktail d’entreprise (par personne)', description: 'Bouchées salées et sucrées', price: 3500 },
  { id: 's3', providerId: 'p-saveurs', label: 'Dîner de gala (par personne)', description: 'Service à table, 3 plats', price: 6000 },
  { id: 's4', providerId: 'p-fiore', label: 'Décoration florale complète', description: 'Arche, tables d’honneur, allée centrale', price: 450000 },
  { id: 's5', providerId: 'p-fiore', label: 'Art de la table', description: 'Nappage, vaisselle, centres de table', price: 180000 },
  { id: 's6', providerId: 'p-lumen', label: 'Reportage photo journée', description: '2 photographes, 300 photos retouchées', price: 350000 },
  { id: 's7', providerId: 'p-lumen', label: 'Vidéo + drone', description: 'Film 10 min + séquences drone', price: 500000 },
  { id: 's8', providerId: 'p-kroll', label: 'Prestation DJ soirée', description: 'DJ + enceintes + micros, 6 h', price: 250000 },
  { id: 's9', providerId: 'p-baobab', label: 'Location salle (journée)', description: '300 places, climatisation, parking', price: 800000 },
  { id: 's10', providerId: 'p-loca', label: 'Chaise pliante (unité)', description: 'Livraison incluse dès 50 unités', price: 500 },
  { id: 's11', providerId: 'p-nkonou', label: 'Coordination jour J', description: 'Accompagnement complet du mariage', price: 650000 },
  { id: 's12', providerId: 'p-agbe', label: 'Animation soirée (4 h)', description: 'Jeux, danse, animation micro', price: 200000 },
  { id: 's13', providerId: 'p-voix', label: 'Maître de cérémonie', description: 'Cérémonie laïque + soirée', price: 150000 },
  { id: 's14', providerId: 'p-gourmand', label: 'Pièce montée', description: 'À partir de, sur devis selon étages', price: 120000 },
];

export const SEED_REQUESTS = [
  { id: 'r1', clientId: 'u-client', providerId: 'p-lumen', eventType: 'mariage', eventDate: daysAgo(-20), guests: 250,
    budget: 600000, message: 'Bonjour, nous cherchons un photographe pour notre mariage le 2 novembre à Agoè.', status: 'closed', createdAt: daysAgo(12), updatedAt: daysAgo(2) },
  { id: 'r2', clientId: 'u-client', providerId: 'p-fiore', eventType: 'mariage', eventDate: daysAgo(-35), guests: 250,
    budget: 500000, message: 'Nous souhaiterions un devis pour la décoration florale de notre cérémonie.', status: 'in_progress', createdAt: daysAgo(8), updatedAt: daysAgo(1) },
  { id: 'r3', clientId: 'u-client', providerId: 'p-kroll', eventType: 'anniversaire', eventDate: daysAgo(-10), guests: 80,
    budget: 250000, message: 'Soirée anniversaire le 24 octobre, recherche DJ avec sono et lumières.', status: 'sent', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  { id: 'r4', clientId: 'u-kossi', providerId: 'p-saveurs', eventType: 'bapteme', eventDate: daysAgo(-15), guests: 120,
    budget: 800000, message: 'Baptême le 18 octobre à Bè, buffet pour 120 personnes. Merci de nous faire un devis.', status: 'sent', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
];

export const SEED_MESSAGES = [
  { id: 'm1', requestId: 'r1', senderId: 'u-client', body: 'Bonjour, nous cherchons un photographe pour notre mariage le 2 novembre à Agoè.', readAt: daysAgo(11), createdAt: daysAgo(12) },
  { id: 'm2', requestId: 'r1', senderId: 'u-own-lumen', body: 'Bonjour ! Nous sommes disponibles. Reportage photo + drone : 750 000 FCFA. Nous pouvons nous rencontrer cette semaine.', readAt: daysAgo(10), createdAt: daysAgo(11) },
  { id: 'm3', requestId: 'r1', senderId: 'u-client', body: 'Parfait, nous acceptons. Rendez-vous jeudi 18 h à notre domicile.', readAt: daysAgo(9), createdAt: daysAgo(10) },
  { id: 'm4', requestId: 'r2', senderId: 'u-client', body: 'Nous souhaiterions un devis pour la décoration florale de notre cérémonie.', readAt: daysAgo(7), createdAt: daysAgo(8) },
  { id: 'm5', requestId: 'r2', senderId: 'u-own-fiore', body: 'Bonjour, merci pour votre demande. Nous vous envoyons notre catalogue fleurs et un devis sous 48 h.', readAt: daysAgo(1), createdAt: daysAgo(7) },
  { id: 'm6', requestId: 'r3', senderId: 'u-client', body: 'Soirée anniversaire le 24 octobre, recherche DJ avec sono et lumières.', readAt: null, createdAt: daysAgo(2) },
  { id: 'm7', requestId: 'r4', senderId: 'u-kossi', body: 'Baptême le 18 octobre à Bè, buffet pour 120 personnes. Merci de nous faire un devis.', readAt: null, createdAt: daysAgo(1) },
];

export const SEED_REVIEWS = [
  { id: 'v1', requestId: 'r1', clientId: 'u-client', providerId: 'p-lumen', rating: 5,
    comment: 'Travail remarquable, photos magnifiques et livrées rapidement. Équipe discrète et professionnelle.', visible: true, createdAt: daysAgo(2) },
  { id: 'v2', requestId: null, clientId: 'u-ayaba', providerId: 'p-saveurs', rating: 5,
    comment: 'Buffet excellent pour notre séminaire, ponctuels et très organisés.', visible: true, createdAt: daysAgo(9) },
  { id: 'v3', requestId: null, clientId: 'u-kossi', providerId: 'p-saveurs', rating: 4,
    comment: 'Très bon traiteur, seul bémol : un léger retard de livraison des chaises.', visible: true, createdAt: daysAgo(20) },
  { id: 'v4', requestId: null, clientId: 'u-ayaba', providerId: 'p-fiore', rating: 5,
    comment: 'Une décoration de rêve, nos invités en parlent encore !', visible: true, createdAt: daysAgo(5) },
  { id: 'v5', requestId: null, clientId: 'u-client', providerId: 'p-fiore', rating: 5,
    comment: 'Écoute et conseils excellents, devis clair et respecté.', visible: true, createdAt: daysAgo(3) },
];

// Profils synthétiques des propriétaires de prestataires (pas de compte de connexion).
export function seedState() {
  const owners = SEED_PROVIDERS.map((p, i) => ({
    id: p.ownerId, fullName: `Gérant·e ${p.businessName}`, email: `contact${i}@example.tg`,
    phone: p.phone, role: 'prestataire', createdAt: p.createdAt,
  }));
  return {
    users: [...SEED_USERS, ...owners],
    providers: SEED_PROVIDERS.map(p => ({ ...p })),
    services: SEED_SERVICES.map(s => ({ ...s })),
    requests: SEED_REQUESTS.map(r => ({ ...r })),
    messages: SEED_MESSAGES.map(m => ({ ...m })),
    reviews: SEED_REVIEWS.map(v => ({ ...v })),
    contactMessages: [],
    seededAt: new Date().toISOString(),
  };
}
```

- [ ] **Étape 9 — Tests d'abord : `tests/helpers/memory-storage.js` + `tests/db.test.js` (échoue)**

```js
// tests/helpers/memory-storage.js
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: k => void map.delete(k),
    clear: () => map.clear(),
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
  };
}
```

```js
// tests/db.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage } from './helpers/memory-storage.js';
import { DemoAdapter } from '../assets/js/core/db.js';

const makeDb = () => new DemoAdapter(memoryStorage());

test('seed: 8 catégories, 10 prestataires publics approuvés', async () => {
  const db = makeDb();
  assert.equal((await db.listCategories()).length, 8);
  const list = await db.listProviders();
  assert.equal(list.length, 10);
  assert.ok(list.every(p => p.status === 'approved'));
});

test('listProviders: filtre catégorie + quartier + vérifiés + tri prix', async () => {
  const db = makeDb();
  const traiteurs = await db.listProviders({ category: 'cat-traiteur' });
  assert.equal(traiteurs.length, 2);
  const be = await db.listProviders({ quarter: 'Bè' });
  assert.ok(be.length >= 2 && be.every(p => p.quarter === 'Bè'));
  const verified = await db.listProviders({ verifiedOnly: true });
  assert.equal(verified.length, 3);
  assert.ok(verified.every(p => p.isVerified));
  const asc = await db.listProviders({ sort: 'prix-asc' });
  for (let i = 1; i < asc.length; i++) assert.ok(asc[i].priceFrom >= asc[i - 1].priceFrom);
});

test('listProviders: recherche texte et note minimale', async () => {
  const db = makeDb();
  const found = await db.listProviders({ q: 'gourmand' });
  assert.equal(found.length, 1);
  assert.equal(found[0].businessName, 'Le Gourmand d’Or');
  const rated = await db.listProviders({ minRating: 4.5 });
  assert.ok(rated.every(p => p.avgRating >= 4.5));
});

test('getProvider: services et note moyenne', async () => {
  const db = makeDb();
  const p = await db.getProvider('p-saveurs');
  assert.equal(p.services.length, 3);
  assert.equal(p.isVerified, true);
  assert.ok(p.avgRating >= 4);
});

test('cycle demande: création → message passe en cours → acceptée → clôturée', async () => {
  const db = makeDb();
  const r = await db.createRequest({ clientId: 'u-client', providerId: 'p-baobab', eventType: 'mariage',
    eventDate: '2026-12-01', guests: 200, budget: 900000, message: 'Test' });
  assert.equal(r.status, 'sent');
  await db.sendMessage({ requestId: r.id, senderId: 'u-own-baobab', body: 'Nous vérifions la date.' });
  assert.equal((await db.getRequest(r.id)).status, 'in_progress');
  await db.updateRequestStatus(r.id, { status: 'accepted', byRole: 'prestataire' });
  await db.updateRequestStatus(r.id, { status: 'closed', byRole: 'client' });
  assert.equal((await db.getRequest(r.id)).status, 'closed');
});

test('un tiers ne peut pas écrire dans les messages d'une demande', async () => {
  const db = makeDb();
  await assert.rejects(() => db.sendMessage({ requestId: 'r1', senderId: 'u-kossi', body: 'intrus' }),
    /Non autorisé/);
});

test('refus exige un message du prestataire', async () => {
  const db = makeDb();
  await assert.rejects(() => db.updateRequestStatus('r3', { status: 'declined', byRole: 'prestataire' }));
  await db.sendMessage({ requestId: 'r3', senderId: 'u-own-kroll', body: 'Malheureusement indisponible.' });
  await db.updateRequestStatus('r3', { status: 'declined', byRole: 'prestataire' });
  assert.equal((await db.getRequest('r3')).status, 'declined');
});

test('messagerie: fils, non-lus, marqué lu', async () => {
  const db = makeDb();
  const threadsKroll = await db.listThreadsFor('u-own-kroll');
  const t = threadsKroll.find(x => x.request.id === 'r3');
  assert.equal(t.unreadCount, 1);
  assert.equal(t.counterparty.name, 'Afi Mensah');
  await db.markRequestRead('r3', 'u-own-kroll');
  assert.equal((await db.listThreadsFor('u-own-kroll')).find(x => x.request.id === 'r3').unreadCount, 0);
});

test('avis: visible=false par défaut, publication par admin, un seul avis par demande', async () => {
  const db = makeDb();
  const v = await db.createReview({ requestId: 'r1', clientId: 'u-client', rating: 5, comment: 'Super !' });
  assert.equal(v.visible, false);
  await db.setReviewVisible(v.id, true);
  const pub = await db.listReviewsForProvider('p-lumen');
  assert.ok(pub.some(x => x.id === v.id));
  await assert.rejects(() => db.createReview({ requestId: 'r1', clientId: 'u-client', rating: 4, comment: 'doublon' }));
  await assert.rejects(() => db.createReview({ requestId: 'r2', clientId: 'u-client', rating: 4, comment: 'pas clôturée' }));
});

test('admin: suspendre masque du public ; vérifier accorde le badge', async () => {
  const db = makeDb();
  await db.setProviderStatus('p-kroll', 'suspended');
  const pub = await db.listProviders();
  assert.ok(!pub.some(p => p.id === 'p-kroll'));
  await db.setProviderVerified('p-kroll', true);
  const admin = await db.listProvidersAdmin({});
  assert.equal(admin.find(p => p.id === 'p-kroll').isVerified, true);
});

test('stats et contact', async () => {
  const db = makeDb();
  const s = await db.getStats();
  assert.equal(s.providersPending, 0);
  assert.ok(s.signupsSeries.length === 30);
  await db.saveContactMessage({ name: 'Test', email: 't@t.tg', message: 'Bonjour' });
});
```

Exécuter : `node --test tests/`
Attendu : **ÉCHEC** — `DemoAdapter` n'existe pas encore (`Cannot find module`).

- [ ] **Étape 10 — `assets/js/core/db.js` : `DemoAdapter` complet + `SupabaseAdapter` + `createDb()`**

`DemoAdapter` : stocke l'état seedé sous `eventis_demo_state` dans le stockage injecté (préfixe constant `const PREFIX = 'eventis_demo_'`). Chaque méthode recharge l'état, le modifie, le réécrit. IDs : `crypto.randomUUID()`. Règles métier à implémenter exactement comme les tests ci-dessus l'attendent :

- `listProviders(f={})` : part de `state.providers` filtrés `status==='approved'` **et** propriétaire non suspendu ; joint `categoryName` (depuis catégories), `avgRating`/`reviewsCount` (reviews `visible:true`), applique les filtres `category`, `quarter` (insensible à la casse), `q` (dans businessName+description, insensible), `verifiedOnly`, `priceMax` (`priceFrom <= priceMax`), `minRating` ; trie (`pertinence` : vérifiés d'abord, puis note, puis `createdAt` desc ; `note` : note desc ; `prix-asc`/`prix-desc` sur `priceFrom`). Retourne des objets sans `ownerId`.
- `getProvider(id)` : idem + `description`, `gallery`, `services` triés par prix. Lève `Error('Prestataire introuvable.')` si absent/non approuvé/propriétaire suspendu.
- `createProvider(profileId, data)` : crée `{id: uuid(), ownerId: profileId, gallery: [], status: 'pending', isVerified: false, createdAt: now, ...data}`.
- `updateProvider(id, patch)` : fusionne uniquement les clés publiques éditables (`businessName, categoryId, description, city, quarter, phone, whatsapp, priceFrom, priceTo, coverUrl, gallery`).
- `saveServices(providerId, services)` : remplace par des objets `{id: s.id ?? uuid(), providerId, label, description, price}`.
- `createRequest` : `{id: uuid(), status: 'sent', createdAt: now, updatedAt: now, ...}` ; vérifie que le provider existe et est approuvé.
- `updateRequestStatus(id, {status, byRole})` : transitions autorisées — prestataire : `sent|in_progress → in_progress|accepted|declined|closed` ; client : `accepted → closed`. `declined` exige un message dont l'émetteur est le propriétaire du prestataire. Met à jour `updatedAt`.
- `sendMessage` : émetteur = client de la demande ou propriétaire du prestataire (sinon `Error('Non autorisé.')`) ; passe `sent → in_progress` ; met à jour `updatedAt` de la demande.
- `markRequestRead` : `readAt = now` sur les messages de la demande dont `senderId !== readerId` et `readAt` nul.
- `listThreadsFor(userId)` : demandes où l'utilisateur est client ou propriétaire du prestataire ; pour chacune : `counterparty` = l'autre partie (`fullName` du client ou `businessName` du prestataire, `role`), `lastMessage` (dernier message ou le message initial de la demande), `unreadCount` (messages `senderId !== userId`, `readAt` nul).
- `createReview` : la demande existe, `status === 'closed'`, `clientId` = client de la demande, pas d'avis existant avec le même `requestId` ; sinon `Error(...)`. Retourne `{visible: false, ...}`.
- `listReviewsForProvider` : `visible === true`, joint `clientName`.
- Admin : `listProvidersAdmin({status})` (joint owner `fullName,email`, tous les statuts), `setProviderStatus`, `setProviderVerified`, `listUsersAdmin`, `setUserSuspended` (un admin ne peut pas se suspendre lui-même), `listCategoriesAdmin`, `saveCategory` (création avec `id: slug préfixé 'cat-'` si absent), `getStats` (`providersActive`, `providersPending`, `clients` = rôle client non suspendus, `requestsMonth` = demandes des 30 derniers jours, `signupsSeries` : 30 entrées `YYYY-MM-DD` → nombre de `users.createdAt` ce jour-là).
- `resetDemo()` : `storage.removeItem(PREFIX + 'state')` puis re-seed au prochain accès.
- Charge l'état paresseusement : si `storage.getItem(PREFIX + 'state')` est nul → `seedState()` écrit.

`SupabaseAdapter` (mapping 1:1, non testable hors-ligne — code soigneux, appels `window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)`) :

- `listProviders` : `from('providers').select('*, services(*), reviews(visible)')` avec `eq('status','approved')`, puis filtre/tri en JS comme l'adaptateur démo (les jointures owner-suspendus : `select('*, profiles!providers_profile_id_fkey(suspended)')`). `getProvider` : `eq('id', id).single()` + services + `reviews` visibles avec `profiles(full_name)`.
- Écritures : `createRequest`/`sendMessage`/`createReview` passent par les politiques RLS (pas de vérif côté client au-delà des required fields) ; `updateRequestStatus` via `update({status}).eq('id', id)`.
- `auth.getProviderIdFor` : `from('providers').select('id').eq('profile_id', userId).single()`.
- `getStats` : compteurs par requêtes `select('id', {count:'exact', head:true})`, série des inscriptions par `from('profiles').select('created_at').gte('created_at', il y a 30 jours)` agrégée en JS.

`createDb()` : `return isDemoMode() ? new DemoAdapter(globalThis.localStorage) : new SupabaseAdapter();` + `export { DemoAdapter }` pour les tests. En haut du fichier : `import { isDemoMode } from './config.js';` et `import { seedState } from './seed.js';`.

- [ ] **Étape 11 — Faire passer les tests db**

Run : `node --test tests/db.test.js`
Attendu : **PASS** (10 tests verts). Corriger l'adaptateur jusqu'au vert, sans toucher aux tests.

- [ ] **Étape 12 — `tests/auth.test.js` (échoue) puis `assets/js/core/auth-demo.js` + `auth.js`**

```js
// tests/auth.test.js
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
```

`auth-demo.js` : `new DemoAuth(storage)` ; expose `this.storage = storage` (utilisé par les tests pour brancher un `DemoAdapter` sur le même état). État dans `PREFIX + 'auth'` (`{users}` partagé avec la db démo — **important : DemoAuth et DemoAdapter doivent partager le même état**). Pour cela, `db.js` expose `export function getSharedState(storage)` / `saveSharedState(storage, state)` utilisés par les deux. Au démarrage, `DemoAuth` s'assure que l'état seedé existe (même lazy-seed que la db). `signUp` : e-mail normalisé (minuscules) déjà pris → `Error('Cet e-mail est déjà utilisé.')` ; mot de passe ≥ 8 caractères → sinon `Error('Le mot de passe doit contenir au moins 8 caractères.')` ; crée le user `{id: uuid(), suspended: false, createdAt: now, ...}` ; si rôle prestataire → `createProvider` via l'état partagé. Session : `PREFIX + 'session'` = userId. `signIn` : vérifie e-mail + mot de passe en clair (stockage local marqué non sécurisé — commentaire dans le code), vérifie `suspended` → `Error('Compte suspendu.')`. `requestPasswordReset` : lève `Error('Mode démo : aucun e-mail ne peut être envoyé. Utilisez les comptes de démonstration.')`. `suspendForTest(email)` (utilitaire interne, préfixé commentaire // tests uniquement).

`auth.js` :

```js
import { isDemoMode } from './config.js';
import { DemoAuth } from './auth-demo.js';
// AuthSupabase chargé dynamiquement uniquement en mode réel
export function createAuth() {
  if (isDemoMode()) return new DemoAuth(globalThis.localStorage);
  const { AuthSupabase } = window.EventisAuthSupabase; // défini par auth-supabase.js (script classique)
  return new AuthSupabase();
}
export const auth = createAuth();
```

`auth-supabase.js` (script classique attachant `window.EventisAuthSupabase`) : `AuthSupabase` enveloppe `supabase.auth` ; `current()` depuis `getSession()` + table `profiles` ; `signUp` = `supabase.auth.signUp` puis insert `profiles` (+ provider vide si prestataire) ; `signIn` = `signInWithPassword` (erreurs mappées en français : « Identifiants invalides. ») ; `requestPasswordReset` = `resetPasswordForEmail` avec message de succès ; `getProviderIdFor` via `db.getProviderIdFor` (import de db.js) ; `onChange` via `supabase.auth.onAuthStateChange`.

Run : `node --test tests/auth.test.js` → attendu **PASS** (5 tests). Note : les tests n'exécutent que `DemoAuth` — l'adaptateur Supabase sera validé manuellement à la Tâche 13.

- [ ] **Étape 13 — `tests/ui.test.js` (échoue) puis `assets/js/core/ui.js`**

```js
// tests/ui.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFCFA, esc, timeAgoFR, REQUEST_STATUS } from '../assets/js/core/ui.js';

test('formatFCFA', () => {
  assert.equal(formatFCFA(250000), '250 000 FCFA');
  assert.equal(formatFCFA(60), '60 FCFA');
});

test('esc neutralise le HTML', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('"guillemets" & ampersand'), '&quot;guillemets&quot; &amp; ampersand');
});

test('timeAgoFR', () => {
  const threeDays = new Date(Date.now() - 3 * 86400000).toISOString();
  assert.equal(timeAgoFR(threeDays), 'il y a 3 j');
  assert.equal(timeAgoFR(new Date().toISOString()), 'à l’instant');
});

test('REQUEST_STATUS couvre les 5 statuts en français', () => {
  assert.deepEqual(Object.keys(REQUEST_STATUS).sort(),
    ['accepted', 'closed', 'declined', 'in_progress', 'sent']);
  assert.equal(REQUEST_STATUS.sent.label, 'Envoyée');
});
```

`ui.js` doit être importable sous Node **sans DOM** (les fonctions DOM comme `toast`/`initReveal` testent `typeof document === 'undefined'` et deviennent des no-op sûrs). `esc` : `String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))`. `formatFCFA` : `new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'`. `timeAgoFR` : minutes/hours/jours/months en français (`à l’instant`, `il y a 5 min`, `il y a 2 h`, `il y a 3 j`, `il y a 2 mois`). `icon(name)` : dictionnaire de SVG inline 24×24 (traits simples, `stroke="currentColor"`, `fill="none"`, `stroke-width="1.8"`) — dessiner les 20 icônes listées dans les interfaces. `toast` : crée `#toasts`, auto-suppression 4 s. `initReveal` : si `matchMedia('(prefers-reduced-motion: reduce)')` ou gsap absent → rendre tout visible directement ; sinon `gsap.utils.toArray('[data-reveal]', scope).forEach(...)` avec `ScrollTrigger` (enregistrer `gsap.registerPlugin(ScrollTrigger)` dans un try/catch).

Run : `node --test tests/ui.test.js` → attendu **PASS** (4 tests).

- [ ] **Étape 14 — `assets/js/core/guards.js`**

```js
import { auth } from './auth.js';

export const HOME_FOR = { client: '/compte/', prestataire: '/espace-prestataire/', admin: '/admin/' };

export function requireAuth(roles = []) {
  const user = auth.current();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/auth/connexion.html?next=${next}`);
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    location.replace(HOME_FOR[user.role] ?? '/');
    return null;
  }
  return user;
}
```

- [ ] **Étape 15 — `assets/js/components/navbar.js` et `footer.js`**

`navbar.js` : `export function mountNavbar(active = '')` — injecte dans `#site-header` : `.demo-banner` (si `isDemoMode()` : « Mode démonstration — données fictives, aucune donnée réelle ») + `<nav>` sticky : logo « Eventis » (Syne, lien `/`), liens Accueil/Catalogue/Comment ça marche/Contact, à droite : bouton thème (soleil/lune basculant `data-theme` + `localStorage.eventis_theme`), puis selon `auth.current()` : « Se connecter » + « Devenir prestataire » (btn primary sm), ou menu du compte (lien vers HOME_FOR[role] + « Déconnexion »). Menu mobile : bouton hamburger ouvrant un panneau plein écran (fermeture Échap + lien cliqué). Met à jour l'état actif sur `auth.onChange`. Marque le lien actif via le paramètre `active`.

`footer.js` : `export function mountFooter()` — 3 colonnes (marque + slogan, navigation, contact), rappel mode démo si actif, bas de page : « © 2026 Eventis — L'excellence événementielle, connectée et sécurisée. » + lien mentions légales.

- [ ] **Étape 16 — `index.html` coquille (sera remplacée en Tâche 2)**

Suivre le patron HTML partagé, contenu `<main>` : `<section class="section"><div class="container"><h1>Fondations Eventis</h1><p class="muted">Coquille temporaire — remplacée à la Tâche 2.</p><a class="btn btn--primary" href="/catalogue.html">Catalogue</a></div></section>`. Module page : créer `assets/js/pages/home.js` minimal : `import { mountNavbar } from '../components/navbar.js'; import { mountFooter } from '../components/footer.js'; mountNavbar('accueil'); mountFooter();` (le contenu riche arrive en Tâche 2).

- [ ] **Étape 17 — SQL Supabase : `supabase/schema.sql`, `rls.sql`, `tools/export-seed.mjs` → `seed.sql`**

`schema.sql` (Postgres/Supabase) :

```sql
create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('client','prestataire','admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  icon text not null default 'star',
  active boolean not null default true
);

create table public.providers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id),
  business_name text not null,
  description text not null default '',
  city text not null default 'Lomé',
  quarter text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  price_from integer not null default 0,
  price_to integer not null default 0,
  cover_url text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  label text not null,
  description text not null default '',
  price integer not null default 0
);

create table public.requests (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.providers(id),
  event_type text not null,
  event_date date,
  guests integer,
  budget integer,
  message text not null,
  status text not null default 'sent' check (status in ('sent','in_progress','accepted','declined','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references public.requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid unique references public.requests(id),
  client_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.providers(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null, email text not null, message text not null,
  created_at timestamptz not null default now()
);

create index on public.providers(category_id);
create index on public.providers(status);
create index on public.services(provider_id);
create index on public.requests(client_id);
create index on public.requests(provider_id);
create index on public.messages(request_id);
create index on public.reviews(provider_id);
```

`rls.sql` : `alter table … enable row level security;` sur les 7 tables, puis helpers et politiques :

```sql
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not suspended) $$;

create or replace function public.is_provider_owner(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.providers where id = p_provider and profile_id = auth.uid()) $$;

create or replace function public.is_request_party(p_request uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.requests r where r.id = p_request
   and (r.client_id = auth.uid() or is_provider_owner(r.provider_id))) $$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;

create policy "profiles read all" on public.profiles for select using (true);
create policy "profiles update self" on public.profiles for update using (auth.uid() = id);
create policy "profiles admin all" on public.profiles for all using (is_admin());

create policy "categories public read" on public.categories for select using (active or is_admin());
create policy "categories admin write" on public.categories for all using (is_admin());

create policy "providers public read approved" on public.providers for select
  using (status = 'approved' or profile_id = auth.uid() or is_admin());
create policy "providers owner insert" on public.providers for insert with check (profile_id = auth.uid());
create policy "providers owner update" on public.providers for update using (profile_id = auth.uid());
create policy "providers admin all" on public.providers for all using (is_admin());

create policy "services public read" on public.services for select using (true);
create policy "services owner write" on public.services for all using (is_provider_owner(provider_id));

create policy "requests party read" on public.requests for select using (is_request_party(id) or is_admin());
create policy "requests client insert" on public.requests for insert with check (client_id = auth.uid());
create policy "requests party update" on public.requests for update using (is_request_party(id) or is_admin());

create policy "messages party read" on public.messages for select using (is_request_party(request_id) or is_admin());
create policy "messages party insert" on public.messages for insert with check (is_request_party(request_id));

create policy "reviews read" on public.reviews for select using (visible or client_id = auth.uid() or is_admin());
create policy "reviews client insert" on public.reviews for insert with check (client_id = auth.uid());
create policy "reviews admin update" on public.reviews for update using (is_admin());

create policy "contact insert" on public.contact_messages for insert with check (true);
```

`tools/export-seed.mjs` : importe `seedState` depuis `../assets/js/core/seed.js`, imprime sur stdout un SQL d'insert idempotent (`insert into public.categories … on conflict (slug) do nothing`, etc. ; pour `profiles` démo, utiliser des UUID fixes du seed) avec les dates converties en `timestamptz`. Générer : `node tools/export-seed.mjs > supabase/seed.sql`, puis vérifier visuellement le fichier produit (colonnes snake_case conformes au schéma).

- [ ] **Étape 18 — QA Tâche 1**

1. `node tools/serve.js` en arrière-plan ; ouvrir `http://localhost:4173/` → coquille visible, navbar (liens + bouton thème), bannière « Mode démonstration », footer.
2. Bascule thème clair/sombre → persistée après rechargement.
3. `node --test tests/` → **tous verts**.
4. Redémarrer le serveur → la page charge sans erreur console (vérifier la console navigateur).

- [ ] **Étape 19 — Commit**

```bash
git add -A
git commit -m "feat: fondations Eventis — design tokens, couche données démo, auth démo, tests, SQL Supabase"
```

---

## Tâche 2 : Accueil (`index.html` + home.js)

**Fichiers :**
- Modifier : `index.html` (remplacer la coquille)
- Créer : `assets/css/pages/home.css`, `assets/js/pages/home.js`
- Créer : `assets/img/hero.jpg` + `assets/img/providers/*.jpg` (10 visuels, Étape 1)

**Interfaces :** Consomme `db.listCategories()`, `db.listProviders()`, `ui.*`, `components/navbar|footer`. Ne produit rien de nouveau.

- [ ] **Étape 1 — Générer les visuels (ImageGen)**

- `hero.jpg` (16:9) : « salle de réception africaine moderne élégante décorée pour un mariage, tables dressées, fleurs blanches et oranges, lumière chaleureuse, photographie professionnelle, sans texte ».
- 10 couvertures de prestataires (3:2), une par slug du seed, style photographie événementielle professionnelle, sans texte, en phase avec la réalité togolaise : traiteur (buffet africain garni), pâtisserie (pièce montée), décoration florale (arche de fleurs), studio photo (appareil photo + couple), DJ (platines + lumières), salle des fêtes (grande salle climatisée vide dressée), location (chaises et barnum empilés), wedding planner (tableau de planning + échantillons tissus), animation (groupe costumé enjoué), MC (micro sur scène habillée).
- Enregistrer sous `assets/img/` avec les noms exacts de `coverUrl` du seed.

- [ ] **Étape 2 — `index.html`**

Structure `<main>` (français, attributs `data-reveal` sur les sections animées) :

```html
<section class="hero">
  <div class="container hero__inner">
    <p class="hero__eyebrow">Togo & Afrique de l'Ouest</p>
    <h1 class="hero__title">L'excellence événementielle,<br>connectée et sécurisée.</h1>
    <p class="hero__sub">Trouvez les meilleurs prestataires pour votre mariage, baptême, anniversaire ou événement d'entreprise.</p>
    <form id="hero-search" class="hero__search" role="search">
      <select id="hs-category" aria-label="Catégorie"><option value="">Toutes les catégories</option></select>
      <input id="hs-quarter" type="text" placeholder="Quartier (ex. Bè)" aria-label="Quartier">
      <button class="btn btn--primary" type="submit">Rechercher</button>
    </form>
    <div class="hero__stats"><span><strong id="stat-providers">—</strong> prestataires</span><span><strong id="stat-categories">—</strong> catégories</span><span><strong>100 %</strong> gratuite</span></div>
  </div>
</section>
<section class="section" id="categories"><div class="container"><h2>Parcourir par catégorie</h2><div id="category-grid" class="category-grid" data-reveal></div></div></section>
<section class="section section--alt" id="steps"><div class="container"><h2>Comment ça marche</h2><ol class="steps">
  <li data-reveal><strong>1. Cherchez</strong><p>Filtrez par catégorie, quartier et budget pour trouver le prestataire idéal.</p></li>
  <li data-reveal><strong>2. Comparez</strong><p>Consultez les tarifs, galeries et avis vérifiés pour choisir en confiance.</p></li>
  <li data-reveal><strong>3. Contactez</strong><p>Envoyez une demande de devis et échangez directement avec le prestataire.</p></li>
</ol></div></section>
<section class="section" id="featured"><div class="container"><div class="section__head"><h2>Prestataires à la une</h2><a class="btn btn--outline" href="/catalogue.html">Tout voir</a></div><div id="featured-grid" class="provider-grid"></div></div></section>
<section class="section section--alt" id="testimonials"><div class="container"><h2>Ils nous font confiance</h2><div id="testimonial-grid" class="testimonial-grid" data-reveal></div><p class="demo-note muted" hidden id="demo-note">Témoignages issus des données de démonstration.</p></div></section>
<section class="section cta"><div class="container cta__inner" data-reveal><h2>Vous êtes prestataire ?</h2><p>Rejoignez Eventis et recevez des demandes de clients qualifiés.</p><a class="btn btn--primary" href="/auth/inscription.html?role=prestataire">Devenir prestataire</a></div></section>
```

- [ ] **Étape 3 — `assets/css/pages/home.css`**

`.hero` (fond `url(/assets/img/hero.jpg)` cover, overlay dégradé noir 55 % vers transparent gauche, min-height 88vh, contenu blanc aligné bas-gauche), `.hero__search` (barre blanche arrondie radius-lg, flex, ombre lg, select+input sans bordure interne, bouton primary à droite ; en mobile : colonne pleine largeur), `.category-grid` (grid auto-fit minmax(220px,1fr), cartes avec icône orange, hover translateY), `.steps` (grid 3 colonnes, numéros Syne orange), `.provider-grid` (auto-fit minmax(280px,1fr)), carte prestataire réutilisant `.card` + `.badge--verified` positionné sur la photo, `.testimonial-grid` (cartes avec guillemets Syne, étoiles orange), `.cta` (fond noir, texte blanc, bouton orange), `.section--alt` (fond `var(--bg-alt)`), `.section__head` (flex space-between align-center).

- [ ] **Étape 4 — `assets/js/pages/home.js`**

```js
import { db } from '../core/db.js';
import { isDemoMode } from '../core/config.js';
import { esc, icon, renderStars, formatFCFA, initReveal } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('accueil');
mountFooter();

const cats = await db.listCategories();
const providers = await db.listProviders({ sort: 'pertinence' });

// recherche hero : options catégories
const sel = document.querySelector('#hs-category');
for (const c of cats) sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`);
document.querySelector('#hero-search').addEventListener('submit', e => {
  e.preventDefault();
  const p = new URLSearchParams();
  if (sel.value) p.set('categorie', sel.value);
  if (document.querySelector('#hs-quarter').value.trim()) p.set('quartier', document.querySelector('#hs-quarter').value.trim());
  location.href = '/catalogue.html?' + p.toString();
});

// compteurs
document.querySelector('#stat-providers').textContent = providers.length;
document.querySelector('#stat-categories').textContent = cats.length;

// catégories
document.querySelector('#category-grid').innerHTML = cats.map(c => `
  <a class="category-card card" href="/catalogue.html?categorie=${c.id}">
    <span class="category-card__icon">${icon(c.icon)}</span>
    <span class="category-card__name">${esc(c.name)}</span>
  </a>`).join('');

// prestataires à la une : vérifiés d'abord, puis top note — max 6
const featured = providers.slice(0, 6);
document.querySelector('#featured-grid').innerHTML = featured.map(p => `
  <a class="card provider-card" href="/prestataire.html?id=${p.id}">
    <div class="provider-card__media"><img class="card__media" src="${esc(p.coverUrl)}" alt="${esc(p.businessName)}" loading="lazy">
      ${p.isVerified ? `<span class="badge badge--verified">${icon('check')} Vérifié</span>` : ''}</div>
    <div class="card__body">
      <span class="card__meta">${esc(p.categoryName)} · ${esc(p.quarter)}</span>
      <h3 class="card__title">${esc(p.businessName)}</h3>
      <span class="stars">${renderStars(p.avgRating)} <span class="muted">(${p.reviewsCount})</span></span>
      <span class="provider-card__price">À partir de ${formatFCFA(p.priceFrom)}</span>
    </div>
  </a>`).join('');

// témoignages : avis visibles des prestataires affichés
const reviews = (await Promise.all(featured.map(p => db.listReviewsForProvider(p.id)))).flat();
document.querySelector('#testimonial-grid').innerHTML = reviews.slice(0, 3).map(v => `
  <figure class="card testimonial"><blockquote>« ${esc(v.comment)} »</blockquote>
  <figcaption><span class="stars">${renderStars(v.rating)}</span><span class="muted">${esc(v.clientName)}</span></figcaption></figure>`).join('');
if (isDemoMode()) document.querySelector('#demo-note').hidden = false;

initReveal();
```

- [ ] **Étape 5 — QA navigateur**

`http://localhost:4173/` : hero avec image + recherche fonctionnelle (soumettre → arrive sur `/catalogue.html?categorie=…&quartier=…` — le catalogue n'existe pas encore, le serveur renvoie 404.html générique, attendu à ce stade), 8 cartes catégories, 6 prestataires avec badges vérifiés corrects (3), témoignages + mention démo visible, animations au scroll douces (vérifier `prefers-reduced-motion: reduce` dans les outils dev → pas d'animation mais contenu visible), aucune erreur console, mobile 360 px : recherche en colonne, cartes empilées.

- [ ] **Étape 6 — Commit**

```bash
git add -A && git commit -m "feat: page d'accueil Eventis — hero, catégories, prestataires à la une, témoignages"
```

---

## Tâche 3 : Catalogue (`catalogue.html`)

**Fichiers :**
- Créer : `catalogue.html`, `assets/css/pages/catalogue.css`, `assets/js/pages/catalogue.js`

**Interfaces :** Consomme `db.listCategories()`, `db.listProviders(f)`, `ui.*`. Ne produit rien de nouveau (les paramètres d'URL `categorie`, `quartier`, `q`, `budget`, `note`, `verifies`, `tri` sont lus par cette page — aucune autre page ne dépend d'eux).

- [ ] **Étape 1 — `catalogue.html`**

`<main>` : en-tête de page (h1 « Trouver un prestataire », compteur de résultats), disposition 2 colonnes desktop : `<aside>` filtres + `<div>` grille. Filtres : catégorie (select), quartier (select peuplé dynamiquement des quartiers uniques du jeu de données), budget max (select : 100 000 / 250 000 / 500 000 / 1 000 000 / 2 000 000 FCFA « et plus »), note min (select : 3+, 4+, 4,5+), case à cocher « Vérifiés uniquement », recherche texte (input), boutons « Appliquer » (primary) et « Réinitialiser » (ghost). Grille : `<div id="results" class="provider-grid">` + `<div id="results-meta">`. Zone état vide : `<div id="empty" class="empty" hidden>` avec icône search et bouton « Élargir ma recherche ».

- [ ] **Étape 2 — `assets/css/pages/catalogue.css`**

`.catalog-layout` (grid `280px 1fr`, gap space-6 ; mobile : une colonne, filtres dans un `<details>` repliable « Filtres »), `.filter-panel` (carte sticky top `calc(var(--nav-h) + space-4)`), `.provider-grid` (réutilisation des classes de la Tâche 2 — déplacer `.provider-grid`, `.provider-card` dans `components.css` si pas déjà fait, et supprimer les doublons de `home.css`).

- [ ] **Étape 3 — `assets/js/pages/catalogue.js`**

```js
import { db } from '../core/db.js';
import { esc, icon, renderStars, formatFCFA, initReveal } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('catalogue');
mountFooter();

const params = new URLSearchParams(location.search);
const state = {
  category: params.get('categorie') ?? '',
  quarter: params.get('quartier') ?? '',
  q: params.get('q') ?? '',
  priceMax: params.get('budget') ? Number(params.get('budget')) : '',
  minRating: params.get('note') ? Number(params.get('note')) : '',
  verifiedOnly: params.get('verifies') === '1',
  sort: params.get('tri') ?? 'pertinence',
};

// peupler selects (catégories + quartiers distincts)
// brancher le formulaire → met à jour `state` + relance render()
// lire les contrôles depuis l'URL au chargement

function skeletons(n = 6) {
  return Array.from({ length: n }, () => `<div class="card"><div class="skeleton" style="aspect-ratio:3/2"></div>
    <div class="card__body"><div class="skeleton" style="height:14px;width:40%"></div>
    <div class="skeleton" style="height:20px;width:70%"></div></div></div>`).join('');
}

async function render() {
  const grid = document.querySelector('#results');
  grid.innerHTML = skeletons();                    // état de chargement
  const list = await db.listProviders({ ...state });
  document.querySelector('#results-meta').textContent = `${list.length} prestataire${list.length > 1 ? 's' : ''} trouvé${list.length > 1 ? 's' : ''}`;
  document.querySelector('#empty').hidden = list.length > 0;
  grid.innerHTML = list.map(providerCardHTML).join('');
  initReveal(grid);
}
render();
```

**Ruling R2 (anti-duplication, obligatoire) :** créer dans `assets/js/core/ui.js` la fonction exportée `providerCardHTML(p)` (le HTML exact de la carte prestataire présent dans `assets/js/pages/home.js`, qui doit utiliser `esc`, `icon`, `renderStars`, `formatFCFA`) et la brancher ici. Réusinage immédiat : remplacer le template inline de `home.js` par un appel à `providerCardHTML` et importer la fonction. Les deux pages partagent désormais une seule source de vérité pour la carte.
```

Synchroniser l'URL (`history.replaceState`) à chaque rendu pour que les filtres soient partageables. Débattre la recherche texte (input « 300 ms ») pour éviter un appel par frappe.

- [ ] **Étape 4 — QA**

Filtres combinés (catégorie + quartier + vérifiés) justes ; tri prix croissant correct ; état vide avec bouton réinitialisant les filtres ; URL pré-remplie depuis l'accueil (`?categorie=cat-traiteur`) ; 360 px : le panneau de filtres est repliable ; skeletons visibles < 300 ms en mode démo.

- [ ] **Étape 5 — Commit**

```bash
git add -A && git commit -m "feat: catalogue avec recherche, filtres et tri"
```

---

## Tâche 4 : Fiche prestataire (`prestataire.html`)

**Fichiers :**
- Créer : `prestataire.html`, `assets/css/pages/prestataire.css`, `assets/js/pages/prestataire.js`

**Interfaces :** Consomme `db.getProvider(id)`, `db.createRequest(...)`, `auth.current()`, `ui.EVENT_TYPES`, `ui.REQUEST_STATUS`, `guards`. Produit : les demandes créées ici sont lues par les Tâches 7, 8 et 10.

- [ ] **Étape 1 — `prestataire.html`**

Structure : bouton retour catalogue ; galerie (image couverture + miniatures `gallery` si présentes) ; en-tête fiche (h1 nom, badge vérifié, catégorie · quartier · ville, note + nombre d'avis, téléphone/WhatsApp avec icônes) ; onglets ou sections empilées : « Services & tarifs » (tableau stylé `.table`), « À propos », « Avis » (`#reviews-list`), formulaire « Demander un devis » (`#quote-form`) : select type d'événement (EVENT_TYPES), date (input date, min = aujourd'hui), invités (number min 1), budget (number, min 0, pas 5000), message (textarea 10–1000 caractères). État déconnecté : le formulaire est remplacé par un encart « Connectez-vous pour contacter ce prestataire » + lien connexion (avec `?next=` retour vers cette fiche).

- [ ] **Étape 2 — `assets/css/pages/prestataire.css`**

`.provider-hero` (image 16:9 max-height 440 px, overlay), `.provider-head` (flex, wrap), `.price-table` (réutiliser `.table`, colonne prix alignée droite en Syne), `.quote-form` (carte surface, radius-lg, ombre md).

- [ ] **Étape 3 — `assets/js/pages/prestataire.js`**

```js
import { db } from '../core/db.js';
import { auth } from '../core/auth.js';
import { esc, icon, renderStars, formatFCFA, formatDateFR, toast, initReveal, EVENT_TYPES, isDemoMode } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('');
mountFooter();

const id = new URLSearchParams(location.search).get('id');
let provider;
try { provider = await db.getProvider(id); }
catch { location.replace('/404.html'); }

// rendu fiche (galerie, services via formatFCFA, infos, avis via db.listReviewsForProvider)
// formulaire : si auth.current() → rendu formulaire ; sinon encart connexion
// EVENT_TYPES → options du select
// soumission : validations HTML5 + contrôle date ≥ aujourd'hui ;
//   db.createRequest({ clientId: user.id, providerId: provider.id, ... })
//   → toast('Votre demande a été envoyée.') → redirection /compte/demandes.html
```

- [ ] **Étape 4 — QA**

Fiche complète (p-saveurs) : 3 services tarifés, badge vérifié vert présent, avis visibles avec noms clients. Fiche p-kroll : pas de badge. Formulaire : validation bloquante sur date passée et message < 10 caractères ; soumission connectée crée la demande et redirige ; en déconnecté, l'encart s'affiche. `prestataire.html?id=inconnu` → 404. Pas d'erreur console.

- [ ] **Étape 5 — Commit**

```bash
git add -A && git commit -m "feat: fiche prestataire avec demande de devis"
```

---

## Tâche 5 : Pages statiques

**Fichiers :**
- Créer : `comment-ca-marche.html` (+ `assets/js/pages/static-steps.js`, css inline minimal réutilisant composants), `contact.html` (+ `contact.js`), `mentions-legales.html`, `404.html`

**Interfaces :** Consomme `db.saveContactMessage`, `isDemoMode`, `ui.*`. Ne produit rien.

- [ ] **Étape 1 — `comment-ca-marche.html`** : 3 colonnes (Vous cherchez / Vous êtes prestataire / Sécurité & confiance) réutilisant `.steps` ; CTA vers inscription client et prestataire ; mention honnête : « Le paiement se fait directement entre vous et le prestataire (Flooz, TMoney, espèces). Eventis ne gère aucun paiement pour le moment. »

- [ ] **Étape 2 — `contact.html`** : formulaire nom/e-mail/message → `db.saveContactMessage` + toast ; en mode démo : « Mode démonstration : votre message est enregistré localement et ne sera pas transmis. » ; sinon « Message envoyé. »

- [ ] **Étape 3 — `mentions-legales.html`** : texte français générique (éditeur Eventis, contact, hébergement à compléter, confidentialité des données, propriété intellectuelle).

- [ ] **Étape 4 — `404.html`** : titre Syne « Cette page s'est égarée », lien retour accueil + catalogue.

- [ ] **Étape 5 — QA + commit** : les 4 pages servent, lien mentions légales présent dans le footer, URL invalide → 404 stylée.

```bash
git add -A && git commit -m "feat: pages statiques (comment ça marche, contact, mentions légales, 404)"
```

---

## Tâche 6 : Authentification (connexion / inscription)

**Fichiers :**
- Créer : `auth/connexion.html`, `auth/inscription.html`, `assets/css/pages/auth.css`, `assets/js/pages/auth-login.js`, `auth-register.js`

**Interfaces :** Consomme `auth.*`, `guards.HOME_FOR`, `CONFIG.DEMO_PASSWORD`. Produit : sessions utilisées par toutes les pages protégées.

- [ ] **Étape 1 — `auth/connexion.html`** : carte centrée (max-width 420 px) : e-mail, mot de passe (bouton œil `icon('eye')`), case « Afficher les identifiants démo » visible **uniquement si `isDemoMode()`** listant les 3 comptes démo + mot de passe ( bouton « Remplir » par compte), lien « Mot de passe oublié » → `auth.requestPasswordReset(email)` (toast selon mode), lien vers inscription. Bouton « Retour à l'accueil ».

- [ ] **Étape 2 — `auth/inscription.html`** : sélecteur de rôle en 2 grandes cartes cliquables (client / prestataire, icônes, pré-sélection via `?role=prestataire`), puis champs nom complet, e-mail, téléphone, mot de passe + confirmation. Validation : e-mail valide, téléphone ≥ 8 chiffres, mots de passe identiques ≥ 8. Soumission → `auth.signUp` → `toast('Compte créé !')` → redirection : prestataire → `/espace-prestataire/profil.html` (compléter sa fiche), client → `/compte/`. Gestion des erreurs affichées en `.form-errors` (ex. « Cet e-mail est déjà utilisé. »).

- [ ] **Étape 3 — `assets/js/pages/auth-login.js` / `auth-register.js`** + `auth.css` (carte centrée, carte de sélection de rôle `.role-card` avec état sélectionné bordure orange).

- [ ] **Étape 4 — QA** : créer un compte client (nouveau e-mail) → arrive sur `/compte/` (protégé — la page n'existe pas encore avant la Tâche 7 ; vérifier seulement la redirection et le message d'interdiction d'accès aux admins pour ce rôle), compte prestataire → `/espace-prestataire/profil.html`, doublon d'e-mail → erreur visible, identifiants démo affichés et fonctionnels, mot de passe oublié → consigne mode démo claire, rôle prestataire présélectionné via l'URL de la home.

- [ ] **Étape 5 — Commit**

```bash
git add -A && git commit -m "feat: authentification — connexion, inscription client/prestataire, démo"
```

---

## Tâche 7 : Compte client

**Fichiers :**
- Créer : `compte/index.html` + `assets/js/pages/account-home.js`, `compte/demandes.html` + `account-requests.js`, `compte/profil.html` + `account-profile.js`
- Créer : `assets/css/pages/account.css`

**Interfaces :** Consomme `guards.requireAuth(['client'])`, `db.listRequestsForClient`, `db.getRequest`, `db.updateRequestStatus`, `db.createReview`, `ui.REQUEST_STATUS`, `ui.EVENT_TYPES`. Produit : rien de nouveau (la messagerie arrive Tâche 8).

- [ ] **Étape 1 — `assets/css/pages/account.css`** : `.dashboard` (bandeau de bienvenue + 3 cartes stats compteurs), `.tabs`/sous-navigation d'espace (liens actifs), liste `.request-list` (cartes avec badge statut, prestataire, date, dernier message), `.request-detail`.

- [ ] **Étape 2 — `compte/index.html`** (`account-home.js`) : `requireAuth(['client'])` ; bienvenue « Bonjour, {prénom} » ; 3 cartes : demandes en cours (statuts sent/in_progress/accepted), messages non lus (somme `unreadCount` de `db.listThreadsFor`), demandes clôturées. Liste des 3 dernières demandes avec lien « Voir tout ».

- [ ] **Étape 3 — `compte/demandes.html`** (`account-requests.js`) : liste complète (statut, prestataire, type d'événement, date, budget) ; clic → vue détail inline (remplace la liste ou section dessous) : détails + boutons d'action selon statut : `accepted` → « Clôturer la prestation » (demande confirmation) → `updateRequestStatus(id,{status:'closed',byRole:'client'})` puis proposition « Laisser un avis » (formulaire note 1–5 étoiles cliquables + commentaire → `db.createReview`) ; statuts `declined`/`closed` sans action. Bouton « Voir les messages » → `compte/messages.html?demande=<id>`.

- [ ] **Étape 4 — `compte/profil.html`** (`account-profile.js`) : affichage + édition nom/téléphone (e-mail en lecture seule). En mode démo : sauvegarde locale + toast « Profil mis à jour (mode démo). » ; en mode réel : `updateProfile` via `auth`/Supabase. Section danger : « Mode démo : la suppression de compte n'est pas disponible. »

- [ ] **Étape 5 — QA** : connexion `client@demo.tg` → 3 demandes listées (clôturée lumen, en cours fiore, envoyée kroll) ; clôturer une acceptée → créer un avis (invisible tant que non publié — vérifier via admin Tâche 11) ; accès direct à `/admin/` avec ce compte → redirection vers `/compte/` ; compteurs du dashboard cohérents.

- [ ] **Étape 6 — Commit**

```bash
git add -A && git commit -m "feat: espace client — dashboard, demandes, avis, profil"
```

---

## Tâche 8 : Messagerie partagée + messagerie client

**Fichiers :**
- Créer : `compte/messages.html`, `assets/js/pages/account-messages.js`
- Créer : `assets/js/components/messaging.js` (module partagé)

**Interfaces :** Consomme `db.listThreadsFor`, `db.listMessages`, `db.sendMessage`, `db.markRequestRead`, `db.getRequest`. **Produit** (utilisé par la Tâche 10 côté prestataire) :

```js
// components/messaging.js
export function mountMessaging(rootEl, { currentUserId, getRequestIdFromUrl = true })
// rend dans rootEl : colonne fils (.thread-list) + colonne conversation (.thread-view)
// sélectionne le fil demandé par ?demande= ou le plus récent ; marque lu au chargement
// et après envoi ; auto-scroll bas ; émet db.sendMessage ; rafraîchit les fils.
```

- [ ] **Étape 1 — `components/messaging.js`** : layout 2 colonnes (mobile : fils plein écran, conversation avec bouton retour) ; entête de conversation : `counterparty.name` + contexte de la demande (type, date) ; bulles : émises à droite fond orange blanc, reçues à gauche fond gris ; heure `timeAgoFR` ; champ de saisie + bouton envoyer (Entrée envoie, Shift+Entrée saute ligne) ; état vide : « Sélectionnez une conversation. » ; verrou si demande `declined`/`closed` : saisie désactivée + mention « Cette demande est clôturée. »

- [ ] **Étape 2 — `compte/messages.html` + `account-messages.js`** : `requireAuth(['client'])`, `mountMessaging(document.querySelector('#messaging'), { currentUserId: user.id })`.

- [ ] **Étape 3 — QA** : `client@demo.tg` voit 3 fils ; le fil DJ K-Roll affiche 1 message non lu qui passe à lu après ouverture ; envoyer un message passe la demande r3 `sent → in_progress` (visible dans l'espace demandes) ; conversation clôturée (r1) en lecture seule ; après envoi depuis la fiche prestataire (Tâche 4) un nouveau fil apparaît en tête.

- [ ] **Étape 4 — Commit**

```bash
git add -A && git commit -m "feat: messagerie par fils — module partagé et interface client"
```

---

## Tâche 9 : Espace prestataire

**Fichiers :**
- Créer : `espace-prestataire/index.html` + `assets/js/pages/provider-home.js`, `demandes.html` + `provider-requests.js`, `services.html` + `provider-services.js`, `profil.html` + `provider-profile.js`

**Interfaces :** Consomme `auth.getProviderIdFor`, `db.listRequestsForProvider`, `db.updateRequestStatus`, `db.sendMessage`, `db.saveServices`, `db.updateProvider`, `db.getProvider`, `guards.requireAuth(['prestataire'])`. Produit : les mêmes demandes/messages que les Tâches 7/8, côté prestataire.

- [ ] **Étape 1 — `espace-prestataire/index.html`** (`provider-home.js`) : `requireAuth(['prestataire'])` ; `providerId = await auth.getProviderIdFor(user.id)` ; si provider `status === 'pending'` → bandeau orange « Votre fiche est en cours d'examen par l'équipe Eventis. Elle sera visible après approbation. » ; 4 cartes stats : nouvelles demandes (statut sent), en cours, taux de réponse (réponses prestataires / demandes reçues sur 30 jours — arrondi %), note moyenne ; liste des 5 dernières demandes.

- [ ] **Étape 2 — `demandes.html`** (`provider-requests.js`) : liste des demandes reçues (client, type, date événement, invités, budget, statut, non-lus) ; détail : message initial + boutons « Accepter » (primary) / « Refuser » (outline) avec modale de confirmation ; refus → textarea message obligatoire (passe `declined` via `updateRequestStatus` après envoi du message) ; acceptation → statut `accepted` + toast ; répondre par message → `sendMessage` (passe `sent → in_progress`). Depuis le détail, lien « Voir la conversation » → `messages.html?demande=<id>`.

- [ ] **Étape 3 — `services.html`** (`provider-services.js`) : liste des services (libellé, description, prix FCFA) avec édition inline et suppression ; bouton « Ajouter un service » (modale ou ligne éditable) ; sauvegarde → `db.saveServices(providerId, services)` + toast. Validation : libellé requis, prix entier ≥ 0.

- [ ] **Étape 4 — `profil.html`** (`provider-profile.js`) : formulaire fiche publique : nom commercial, catégorie (select), description (textarea), ville, quartier, téléphone, WhatsApp, fourchette de prix (`price_from`/`price_to`), photo de couverture (URL en démo ; en réel : upload Supabase Storage — en mode démo afficher « Upload disponible après connexion à Supabase. » si non branché, avec champ URL fonctionnel). Aperçu « ce que voit le client » (réutilise le rendu de carte).

- [ ] **Étape 5 — QA** : `prestataire@demo.tg` → dashboard avec la demande r4 « Baptême » non lue ; accepter → statut acceptée côté client (revérifier en `client@demo.tg`) ; refuser la demande r3 sans message → refusé par la validation ; ajouter un service → visible sur la fiche publique après rechargement ; profil mis à jour → reflété sur `/prestataire.html?id=p-saveurs`.

- [ ] **Étape 6 — Commit**

```bash
git add -A && git commit -m "feat: espace prestataire — dashboard, demandes, services, profil"
```

---

## Tâche 10 : Messagerie prestataire

**Fichiers :**
- Créer : `espace-prestataire/messages.html`, `assets/js/pages/provider-messages.js`

**Interfaces :** Consomme le module produit en Tâche 8 (`mountMessaging`) — zéro nouveau code de conversation.

- [ ] **Étape 1 — `provider-messages.js`** : `requireAuth(['prestataire'])`, récupérer `providerId`, `mountMessaging(el, { currentUserId: user.id })` — le module déduit les fils via `db.listThreadsFor(user.id)`.

- [ ] **Étape 2 — QA** : le prestataire voit ses fils (r4, et r1/r2/r3 selon les interactions) ; écrire au client → non-lu côté client ; les deux espaces affichent la même conversation avec les bonnes bulles gauche/droite.

- [ ] **Étape 3 — Commit**

```bash
git add -A && git commit -m "feat: messagerie prestataire via le module partagé"
```

---

## Tâche 11 : Administration

**Fichiers :**
- Créer : `admin/index.html` + `assets/js/pages/admin-home.js`, `prestataires.html` + `admin-providers.js`, `utilisateurs.html` + `admin-users.js`, `avis.html` + `admin-reviews.js`, `categories.html` + `admin-categories.js`

**Interfaces :** Consomme `guards.requireAuth(['admin'])`, `db.getStats`, `db.listProvidersAdmin`, `db.setProviderStatus`, `db.setProviderVerified`, `db.listUsersAdmin`, `db.setUserSuspended`, `db.listReviewsAdmin`, `db.setReviewVisible`, `db.listCategoriesAdmin`, `db.saveCategory`. Ne produit rien.

- [ ] **Étape 1 — `admin/index.html`** (`admin-home.js`) : 4 compteurs (`getStats`) + graphique CSS des inscriptions sur 30 jours : `.bar-chart` (divs hauteur % sur max de la série, `title` avec date + nombre, aria-label). 

- [ ] **Étape 2 — `prestataires.html`** (`admin-providers.js`) : table (nom, propriétaire, e-mail, catégorie, statut badge, vérifié badge) + filtres par statut ; actions par ligne selon statut : pending → « Approuver » ; approved → « Vérifier »/`« Retirer la vérification »`, « Suspendre » ; suspended → « Réactiver ». Confirmations en modale.

- [ ] **Étape 3 — `utilisateurs.html`** (`admin-users.js`) : table (nom, e-mail, rôle, inscription, statut) ; « Suspendre » / « Réactiver » (jamais sur soi-même).

- [ ] **Étape 4 — `avis.html`** (`admin-reviews.js`) : file de modération : avis `visible=false` d'abord ; chaque avis (prestataire, client, note, commentaire, date) avec « Publier » / « Masquer ».

- [ ] **Étape 5 — `categories.html`** (`admin-categories.js`) : table des catégories (nom, slug, icône, actif) ; ajouter (nom → slug généré : minuscules, accents supprimés, espaces → tirets ; icône choisie dans une liste déroulée des icônes disponibles) ; renommer ; activer/désactiver (une catégorie désactivée disparaît du catalogue public).

- [ ] **Étape 6 — QA** : `admin@demo.tg` → suspendre p-kroll → disparaît du catalogue public ; vérifier p-nkonou → badge vert visible sur sa fiche publique ; publier l'avis déposé en Tâche 7 → visible sur la fiche du prestataire ; un client connecté qui ouvre `/admin/` → redirection ; graphique des inscriptions non vide.

- [ ] **Étape 7 — Commit**

```bash
git add -A && git commit -m "feat: administration — stats, modération prestataires/utilisateurs/avis, catégories"
```

---

## Tâche 12 : Avis — affinage de la boucle complète

**Fichiers :**
- Modifier : `assets/js/pages/prestataire.js` (liste des avis déjà présente — ajouter l'état vide « Aucun avis pour le moment »), `assets/js/pages/account-requests.js` (vérifier la proposition d'avis après clôture)

**Interfaces :** Aucune nouvelle.

- [ ] **Étape 1 — États et garde-fous** : fiche sans avis → état vide ; un client ne peut déposer qu'un avis par demande (l'adaptateur lève déjà l'erreur — afficher le message proprement en `.form-errors`) ; un avis déposé mais non encore publié s'affiche pour son auteur avec mention « En attente de modération » (via `listReviewsForProvider` côté public : non — afficher dans l'espace client uniquement, section « Mes avis » de `compte/profil.html` : liste des avis du client avec leur état).

- [ ] **Étape 2 — `compte/profil.html`** : ajouter la section « Mes avis » (avis du client connecté, avec statut Publié / En attente de modération).

- [ ] **Étape 3 — QA bout-en-bout** : scénario complet — client envoie une demande → prestataire accepte → client clôture → client dépose un avis → admin publie → avis visible sur la fiche publique avec le bon compte d'avis et la note moyenne recalculée.

- [ ] **Étape 4 — Commit**

```bash
git add -A && git commit -m "feat: boucle avis complète — dépôt, modération, publication, affichage"
```

---

## Tâche 13 : PWA, mode sombre, finition, QA finale

**Fichiers :**
- Créer : `manifest.webmanifest`, `sw.js`, `assets/icons/icon-512.png`
- Modifier : chaque `<head>` (lien manifest + meta theme-color), `tokens.css` (vérifier la couverture sombre), `README.md` (créer)

**Interfaces :** Aucune nouvelle.

- [ ] **Étape 1 — Icône + manifeste** : générer `icon-512.png` (ImageGen 1:1 : logo Eventis minimaliste, lettre E orange dans un carré noir arrondi, fond blanc, sans texte additionnel). `manifest.webmanifest` :

```json
{
  "name": "Eventis — L'excellence événementielle",
  "short_name": "Eventis",
  "description": "Trouvez et contactez les meilleurs prestataires événementiels du Togo.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#F97316",
  "lang": "fr",
  "icons": [
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/assets/icons/icon-512.png", "sizes": "192x192", "type": "image/png", "purpose": "any" }
  ]
}
```

- [ ] **Étape 2 — `sw.js`** : `CACHE = 'eventis-v1'` ; `PRECACHE` : `/`, `/catalogue.html`, `/comment-ca-marche.html`, `/contact.html`, `/404.html`, css globaux, vendors, icône. Stratégie : navigation → network-first avec repli cache (hors ligne : page demandée si en cache sinon `/`) ; `/assets/` → cache-first avec maj en arrière-plan ; jamais de cache pour `eventis_demo_` (données). `skipWaiting` + `clientsClaim`. Enregistrement : snippet dans `footer.js` (`if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost')`).

- [ ] **Étape 3 — Meta + liens** : ajouter dans chaque page : `<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color" content="#F97316">`, favicon SVG inline (data URI, E orange sur noir).

- [ ] **Étape 4 — Mode sombre** : parcours complet en sombre (accueil, catalogue, fiche, connexion, espace client, espace prestataire, admin) ; corriger les contrastes défaillants (texte-muted en sombre, badges, champs, tableaux, skeletons).

- [ ] **Étape 5 — Pass animations** : `initReveal` actif sur toutes les sections publiques ; vérifier l'absence d'animation en `prefers-reduced-motion`.

- [ ] **Étape 6 — `README.md`** : présentation, lancement (`node tools/serve.js`), comptes démo, bascule Supabase (1. créer un projet Supabase, 2. exécuter `supabase/schema.sql` puis `rls.sql` puis `seed.sql` dans le SQL Editor, 3. renseigner `SUPABASE_URL` + `SUPABASE_ANON_KEY` dans `assets/js/core/config.js`, 4. recharger), déploiement (tout hébergeur statique : Netlify/Vercel/Cloudflare Pages + HTTPS requis pour la PWA).

- [ ] **Étape 7 — QA finale multi-écrans** (checklist complète, à cocher) :

  - **Parcours visiteur** : accueil → catalogue (filtres) → fiche → connexion → envoi de demande.
  - **Parcours client** : demandes → messagerie → clôture → avis.
  - **Parcours prestataire** : dashboard → acceptation → messagerie → services → profil public.
  - **Parcours admin** : stats → approbation → vérification → publication d'avis.
  - **Mobile 360 px** : navigation, formulaires, tableaux admin scrollables horizontalement.
  - **Navigateurs** : Chrome, Firefox, Edge (Safari si disponible — vérifier `Intl.NumberFormat('fr-FR')`).
  - **Accessibilité** : navigation clavier complète (Tab/Échap), focus visibles, contrastes AA.
  - **PWA** : onglet Application → manifeste valide, service worker actif, « Installer » proposé, rechargement hors ligne (DevTools → Offline) : accueil/catalogue servis depuis le cache.
  - **Mode démo** : bannière visible sur toutes les pages, aucun appel réseau externe (onglet Network) hors fonts si non locales.
  - **Sécurité** : aucune clé service ; tentatives d'accès directs aux espaces protégés redirigent ; `esc()` appliqué partout où du contenu utilisateur est rendu (test : s'inscrire avec `<img onerror>` dans le nom → rendu inerte).
  - **Tests** : `node --test tests/` → tous verts.

- [ ] **Étape 8 — Commit final**

```bash
git add -A && git commit -m "feat: PWA, mode sombre, README et QA finale"
```

---

## Revue du plan (auto-contrôle)

- **Couverture du spec :** §1–3 contexte/périmètre → Tâches 1–13 ; §4 architecture → Tâche 1 ; §5 pages → Tâches 2–11 ; §6 données/RLS → Tâche 1 (seed, adaptateurs, SQL) ; §7 design system → Tâche 1 (+ sombre Tâche 13) ; §8 sécurité → Tâches 1, 13 ; §9 PWA/perf → Tâche 13 ; §10 contenu démo → Tâche 1 + Tâche 2 (visuels) ; §11 ordre → ordre des tâches ; §12 critères d'acceptation → QA des Tâches 2–13. Aucun trou.
- **Placeholders :** aucun « à compléter » ; chaque étape contient le code ou la liste exacte des actions.
- **Cohérence des interfaces :** noms de méthodes `db.*`/`auth.*` identiques dans les sections Interfaces, le code des tests et les consommations des Tâches 2–13 ; statuts et clés de seed identiques partout ; `mountMessaging` produit en Tâche 8, consommé en Tâche 10.
