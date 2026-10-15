// Page d'accueil Eventis — hero + recherche, catégories, prestataires à la une, témoignages.
import { db } from '../core/db.js';
import { isDemoMode } from '../core/config.js';
import { esc, icon, renderStars, initReveal, providerCardHTML } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('accueil');
mountFooter();

const cats = await db.listCategories();
const providers = await db.listProviders({ sort: 'pertinence' });

// Recherche hero : options de catégories + soumission vers le catalogue.
const sel = document.querySelector('#hs-category');
for (const c of cats) sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`);
document.querySelector('#hero-search').addEventListener('submit', e => {
  e.preventDefault();
  const p = new URLSearchParams();
  if (sel.value) p.set('categorie', sel.value);
  if (document.querySelector('#hs-quarter').value.trim()) p.set('quartier', document.querySelector('#hs-quarter').value.trim());
  location.href = '/catalogue.html?' + p.toString();
});

// Compteurs du hero.
document.querySelector('#stat-providers').textContent = providers.length;
document.querySelector('#stat-categories').textContent = cats.length;

// Cartes catégories (une carte cliquable vers le catalogue pré-filtré).
document.querySelector('#category-grid').innerHTML = cats.map(c => `
  <a class="category-card card" href="/catalogue.html?categorie=${c.id}">
    <span class="category-card__icon">${icon(c.icon)}</span>
    <span class="category-card__name">${esc(c.name)}</span>
  </a>`).join('');

// Prestataires à la une : vérifiés d'abord, puis mieux notés — 6 maximum.
// Carte rendue par la source unique providerCardHTML (core/ui.js), partagée avec le catalogue.
const featured = providers.slice(0, 6);
document.querySelector('#featured-grid').innerHTML = featured.map(providerCardHTML).join('');

// Témoignages : avis visibles des prestataires mis en avant (3 max).
const reviews = (await Promise.all(featured.map(p => db.listReviewsForProvider(p.id)))).flat();
document.querySelector('#testimonial-grid').innerHTML = reviews.slice(0, 3).map(v => `
  <figure class="card testimonial"><blockquote>« ${esc(v.comment)} »</blockquote>
  <figcaption><span class="stars">${renderStars(v.rating)}</span><span class="muted">${esc(v.clientName || 'Client·e Eventis')}</span></figcaption></figure>`).join('');
if (isDemoMode()) document.querySelector('#demo-note').hidden = false;

initReveal();
