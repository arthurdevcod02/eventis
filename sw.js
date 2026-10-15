// sw.js — service worker Eventis (fichier à la racine, portée « / »).
// Écrit volontairement sans imports : un service worker ne consomme pas les modules ES du site.
// Aucune donnée utilisateur ne transite ici : le mode démo écrit dans localStorage (clés
// « eventis_demo_ »), que ce worker ne lit ni n'écrit jamais. Il ne met en cache que des
// ressources statiques same-origin reçues en GET ; les appels Supabase (cross-origin, hôte
// *.supabase.co) et toute requête non-GET ne sont jamais cachés.

const CACHE = 'eventis-v2';

// Uniquement des fichiers qui existent réellement dans le dépôt (chaque URL est vérifiée en QA).
const PRECACHE = [
  '/',
  '/catalogue.html',
  '/comment-ca-marche.html',
  '/contact.html',
  '/404.html',
  '/manifest.webmanifest',
  '/assets/css/fonts.css',
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/css/components.css',
  '/assets/vendor/gsap.min.js',
  '/assets/vendor/ScrollTrigger.min.js',
  '/assets/vendor/supabase-js.min.js',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const results = await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    // Une entrée absente n'empêche pas l'activation : elle est seulement signalée en journal.
    results.forEach((result, index) => {
      if (result.status === 'rejected') console.warn('[sw] pré-cache impossible :', PRECACHE[index]);
    });
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isCacheable(request, url) {
  if (request.method !== 'GET') return false;            // jamais de cache hors GET
  if (url.origin !== self.location.origin) return false; // jamais Supabase ni CDN
  if (url.hostname.endsWith('.supabase.co')) return false; // double sécurité, explicite
  if (url.pathname === '/sw.js') return false;           // le worker lui-même n'est jamais caché
  if (url.search) return false;                          // URLs paramétrées : pas de cache
  return true;
}

function putInCache(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return Promise.resolve();
  return caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
}

// Navigation : réseau d'abord, repli sur la page demandée en cache, sinon l'accueil.
async function fromNetworkFirst(request, url) {
  try {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(url.pathname)) || (await cache.match('/'));
    if (cached) return cached;
    throw error;
  }
}

// Ressource statique : cache d'abord, mise à jour en arrière-plan.
async function fromCacheFirst(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (!cached) {
    const response = await fetch(request);
    await putInCache(request, response);
    return response;
  }
  const refreshed = fetch(request).then((response) => putInCache(request, response)).catch(() => {});
  try {
    event.waitUntil(refreshed);
  } catch (error) {
    // Événement déjà refermé : la mise à jour se fait quand même si le worker reste éveillé.
  }
  return cached;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (!isCacheable(request, url)) return;
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fromNetworkFirst(request, url));
    return;
  }
  event.respondWith(fromCacheFirst(event, request));
});
