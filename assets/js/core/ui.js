// ui.js — formatage, échappement, toasts, icônes, libellés. Importable sous Node sans DOM
// (les fonctions DOM testent typeof document et deviennent des no-op sûrs).

export function formatFCFA(n) {
  // Normalisation des espaces (ICU fr-FR émet des espaces insécables fines U+202F).
  const formatted = new Intl.NumberFormat('fr-FR').format(Math.trunc(Number(n) || 0));
  return formatted.replace(/[  ]/g, ' ') + ' FCFA';
}

export function formatDateFR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function timeAgoFR(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return `il y a ${Math.floor(d / 30)} mois`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const REQUEST_STATUS = {
  sent: { label: 'Envoyée', cls: 'badge--sent' },
  in_progress: { label: 'En cours', cls: 'badge--progress' },
  accepted: { label: 'Acceptée', cls: 'badge--accepted' },
  declined: { label: 'Refusée', cls: 'badge--declined' },
  closed: { label: 'Clôturée', cls: 'badge--closed' },
};

export const EVENT_TYPES = [
  { id: 'mariage', label: 'Mariage' },
  { id: 'anniversaire', label: 'Anniversaire' },
  { id: 'bapteme', label: 'Baptême' },
  { id: 'corporate', label: 'Corporate / Séminaire' },
  { id: 'autre', label: 'Autre' },
];

// --- Icônes SVG inline 24×24 (traits simples) -------------------------------
const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const ICONS = {
  fork: '<path d="M7 3v5"/><path d="M10 3v5"/><path d="M13 3v5"/><path d="M7 8h6"/><path d="M10 8v13"/>',
  flower: '<circle cx="12" cy="7" r="2.5"/><circle cx="17" cy="10.5" r="2.5"/><circle cx="15" cy="16.5" r="2.5"/><circle cx="9" cy="16.5" r="2.5"/><circle cx="7" cy="10.5" r="2.5"/><circle cx="12" cy="12" r="1.6"/>',
  camera: '<path d="M8.5 7L10 4.5h4L15.5 7"/><rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/>',
  music: '<path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10.5 21v-3h3v3"/>',
  chair: '<path d="M5 10h14"/><path d="M5 10V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v5"/><path d="M6.5 10v10M17.5 10v10"/><path d="M6.5 14h11"/>',
  rings: '<circle cx="9" cy="14" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="M10.5 4.5L12 6l1.5-1.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M9 21h6"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
  'star-half': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/><path d="M12 3.5v13.4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  'arrow-right': '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  phone: '<path d="M5 4h4l1.5 4-2 1.5a11 11 0 0 0 6 6L16 13.5l4 1.5v4a1.5 1.5 0 0 1-1.6 1.5C10 20 4 14 3.5 5.6A1.5 1.5 0 0 1 5 4z"/>',
  whatsapp: '<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.2-1.1A8.5 8.5 0 1 0 12 3.5z"/><path d="M9 8.5c-.3 2.5 3.5 6.5 6.5 6.5l.8-1.7-2-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-2z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M2.5 12S6 5.5 12 5.5c2 0 3.7.8 5.2 2M21.5 12S18 18.5 12 18.5c-2 0-3.7-.8-5.2-2"/><path d="M4 20L20 4"/>',
};

export function icon(name) {
  const body = ICONS[name];
  if (!body) throw new Error(`Icône inconnue : ${name}`);
  return SVG_OPEN + body + '</svg>';
}

export function renderStars(avg) {
  const value = Number(avg) || 0;
  const full = Math.round(value);
  let out = `<span class="stars" role="img" aria-label="Note ${value} sur 5">`;
  for (let i = 1; i <= 5; i++) {
    out += `<span class="${i <= full ? '' : 'off'}">${icon('star')}</span>`;
  }
  return out + '</span>';
}

// --- État de publication d'un avis ---------------------------------------------
// Libellé du badge, source unique (consommé par « Mes avis » et par la fiche de
// demande) : l'état est porté par du TEXTE, jamais par la couleur seule.
export function reviewStatusBadgeHTML(visible) {
  return visible
    ? '<span class="badge badge--accepted">Publié</span>'
    : '<span class="badge badge--progress">En attente de modération</span>';
}

// --- Carte prestataire (source unique partagée par l'accueil et le catalogue) --
export function providerCardHTML(p) {
  return `
  <a class="card provider-card" href="/prestataire.html?id=${p.id}">
    <div class="provider-card__media"><img class="card__media" src="${esc(p.coverUrl)}" alt="${esc(p.businessName)}" loading="lazy">
      ${p.isVerified ? `<span class="badge badge--verified">${icon('check')} Vérifié</span>` : ''}</div>
    <div class="card__body">
      <span class="card__meta">${esc(p.categoryName)} · ${esc(p.quarter)}</span>
      <h3 class="card__title">${esc(p.businessName)}</h3>
      <span class="stars">${renderStars(p.avgRating)} <span class="muted">(${p.reviewsCount})</span></span>
      <span class="provider-card__price">À partir de ${formatFCFA(p.priceFrom)}</span>
    </div>
  </a>`;
}

// --- Toasts ------------------------------------------------------------------
export function toast(message, type = 'info') {
  if (typeof document === 'undefined') return;
  let container = document.getElementById('toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toasts';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'success' ? ' toast--success' : type === 'error' ? ' toast--error' : '');
  el.setAttribute('role', 'status');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// --- Révélations au scroll (GSAP) --------------------------------------------
// Appliquée une fois par page sur le document : les grilles re-rendues (catalogue)
// ne portent volontairement pas data-reveal, leurs cartes ne se ré-animent donc
// pas à chaque filtre.
export function initReveal() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; // contenu laissé visible tel quel
  const gsap = window.gsap;
  if (!gsap) return;
  let ScrollTrigger = window.ScrollTrigger;
  try { if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger); } catch { /* ScrollTrigger indisponible */ }
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (!els.length) return;
  gsap.set(els, { opacity: 0, y: 24 });
  els.forEach(el => {
    if (ScrollTrigger) {
      gsap.to(el, { opacity: 1, y: 0, duration: .7, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' } });
    } else {
      gsap.to(el, { opacity: 1, y: 0, duration: .7, ease: 'power2.out', delay: .1 });
    }
  });
}

// --- Défilement vers un élément (repli instantané si mouvement réduit) ---------
// `scroll-behavior: auto` de base.css ne s'applique pas à scrollIntoView explicite :
// le `behavior:` doit donc être choisi ici, sinon l'ouverture d'un détail demandait
// un défilement animé malgré prefers-reduced-motion.
export function scrollIntoViewRespectful(el) {
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
