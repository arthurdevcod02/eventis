// Page catalogue Eventis — recherche texte (300 ms), filtres combinés, tri, URL synchronisée.
import { db } from '../core/db.js';
import { esc, initReveal, providerCardHTML } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('catalogue');
mountFooter();

// --- État initial lu depuis l'URL (les filtres sont partageables) --------------
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

const form = document.querySelector('#filters');
const qInput = document.querySelector('#f-q');
const filtersToggle = document.querySelector('#filters-toggle');

// --- Peuplement des selects : catégories + quartiers uniques du jeu de données --
const cats = await db.listCategories();
for (const c of cats) {
  form.categorie.insertAdjacentHTML('beforeend', `<option value="${esc(c.id)}">${esc(c.name)}</option>`);
}
const allProviders = await db.listProviders({});
const quarters = [...new Set(allProviders.map(p => p.quarter).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'fr'));
for (const q of quarters) {
  form.quartier.insertAdjacentHTML('beforeend', `<option value="${esc(q)}">${esc(q)}</option>`);
}

// --- Contrôles pré-remis depuis l'URL (valeur invalide → retombe sur « tout ») --
function setSelectValue(sel, value) {
  sel.value = value;
  if (sel.selectedIndex === -1) sel.value = '';
  return sel.value;
}
state.category = setSelectValue(form.categorie, state.category);
state.quarter = setSelectValue(form.quartier, state.quarter);
state.priceMax = setSelectValue(form.budget, String(state.priceMax)) ? Number(form.budget.value) : '';
state.minRating = setSelectValue(form.note, String(state.minRating)) ? Number(form.note.value) : '';
state.sort = setSelectValue(form.tri, state.sort) || 'pertinence';
qInput.value = state.q;
form.verifies.checked = state.verifiedOnly;

// --- Synchronisation de l'URL à chaque rendu (filtres partageables) ------------
function syncURL() {
  const p = new URLSearchParams();
  if (state.category) p.set('categorie', state.category);
  if (state.quarter) p.set('quartier', state.quarter);
  if (state.q) p.set('q', state.q);
  if (state.priceMax !== '') p.set('budget', String(state.priceMax));
  if (state.minRating !== '') p.set('note', String(state.minRating));
  if (state.verifiedOnly) p.set('verifies', '1');
  if (state.sort !== 'pertinence') p.set('tri', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
}

// --- Rendu : skeletons → résultats, compteur, état vide, URL -------------------
function skeletons(n = 6) {
  return Array.from({ length: n }, () => `<div class="card"><div class="skeleton" style="aspect-ratio:3/2"></div>
    <div class="card__body"><div class="skeleton" style="height:14px;width:40%"></div>
    <div class="skeleton" style="height:20px;width:70%"></div></div></div>`).join('');
}

// Filtres « propres » : db.listProviders applique priceMax/minRating dès que la clé est
// présente (même à ''), d'où l'exclusion des valeurs vides avant l'appel.
function dbFilters() {
  const f = { sort: state.sort };
  if (state.category) f.category = state.category;
  if (state.quarter) f.quarter = state.quarter;
  if (state.q) f.q = state.q;
  if (state.priceMax !== '') f.priceMax = state.priceMax;
  if (state.minRating !== '') f.minRating = state.minRating;
  if (state.verifiedOnly) f.verifiedOnly = true;
  return f;
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const grid = document.querySelector('#results');
  grid.innerHTML = skeletons(); // état de chargement
  const list = await db.listProviders(dbFilters());
  if (seq !== renderSeq) return; // un rendu plus récent a pris le relais
  document.querySelector('#results-meta').textContent =
    `${list.length} prestataire${list.length > 1 ? 's' : ''} trouvé${list.length > 1 ? 's' : ''}`;
  document.querySelector('#empty').hidden = list.length > 0;
  grid.innerHTML = list.map(providerCardHTML).join('');
  syncURL();
  initReveal(grid);
}

// --- Lecture des contrôles → état ----------------------------------------------
function readControls() {
  state.category = form.categorie.value;
  state.quarter = form.quartier.value;
  state.q = qInput.value.trim();
  state.priceMax = form.budget.value ? Number(form.budget.value) : '';
  state.minRating = form.note.value ? Number(form.note.value) : '';
  state.verifiedOnly = form.verifies.checked;
  state.sort = form.tri.value;
}

function resetFilters() {
  form.reset();  // restaure les valeurs « tout » du HTML
  readControls();
  render();
}

function debounce(fn, delay = 300) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, delay);
  };
  wrapped.cancel = () => { clearTimeout(timer); timer = null; };
  return wrapped;
}

// Recherche texte : appliquée automatiquement 300 ms après la dernière frappe.
const searchDebounced = debounce(() => {
  state.q = qInput.value.trim();
  render();
}, 300);

// Filtres repliables : repliés par défaut sur mobile, toujours ouverts au bureau.
const wideScreen = window.matchMedia('(min-width: 841px)');
if (!wideScreen.matches) filtersToggle.removeAttribute('open');
wideScreen.addEventListener('change', e => {
  if (e.matches) filtersToggle.setAttribute('open', '');
});

// --- Branchement du formulaire ---------------------------------------------------
form.addEventListener('submit', e => {
  e.preventDefault();
  searchDebounced.cancel();
  readControls();
  render();
  if (!wideScreen.matches) filtersToggle.removeAttribute('open'); // laisser voir les résultats
});
qInput.addEventListener('input', searchDebounced);
document.querySelector('#f-reset').addEventListener('click', resetFilters);
document.querySelector('#empty-reset').addEventListener('click', resetFilters);

render();
