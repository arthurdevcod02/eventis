// Page tableau de bord admin Eventis — 4 compteurs réels (db.getStats), panneau
// « à traiter » (comptes depuis la db, jamais des liens décoratifs) et graphique
// CSS des inscriptions sur 30 jours (.bar-chart : hauteur % du max de la série).
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, formatDateFR, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = requireAuth(['admin']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init().catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function statCardHTML(iconName, value, label) {
  return `
    <div class="stat-card">
      <span class="stat-card__icon">${icon(iconName)}</span>
      <span class="stat-card__value">${value}</span>
      <span class="stat-card__label">${esc(label)}</span>
    </div>`;
}

// --- Graphique : 30 colonnes, hauteur = part du maximum de la série. ---------
// Les jours sans inscription gardent une piste visible (state vide honnête,
// pas une barre fantôme) ; chaque barre porte date + nombre en title ET aria-label.
function chartHTML(series) {
  const total = series.reduce((s, d) => s + d.count, 0);
  const max = series.reduce((m, d) => Math.max(m, d.count), 0);
  const head = `
    <div class="chart-card__head">
      <h2>Inscriptions — 30 derniers jours</h2>
      <span class="chart-card__total">${total > 0 ? plural(total, 'nouvelle inscription', 'nouvelles inscriptions') : 'Aucune inscription'}</span>
    </div>`;
  const scale = series.length
    ? `<p class="bar-chart__scale"><span>${esc(formatDateFR(series[0].date))}</span><span>${esc(formatDateFR(series[series.length - 1].date))}</span></p>`
    : '';
  if (max === 0) {
    return `<div class="chart-card">${head}
        <div class="empty">${icon('search')}<p>Aucune inscription sur les 30 derniers jours.</p></div>
        ${scale}</div>`;
  }
  const bars = series.map(d => {
    const label = `${formatDateFR(d.date)} : ${plural(d.count, 'nouvelle inscription', 'nouvelles inscriptions')}`;
    // Plancher à 8 % pour qu'un jour à 1 inscription reste visible quand le max est grand.
    const pct = d.count ? Math.max(8, Math.round((d.count / max) * 100)) : 0;
    return `<span class="bar-chart__col"><span class="bar-chart__bar${d.count ? '' : ' is-empty'}"`
      + ` role="img" aria-label="${esc(label)}" title="${esc(label)}" style="height:${pct}%"></span></span>`;
  }).join('');
  return `<div class="chart-card">${head}
      <div class="bar-chart" role="group" aria-label="Inscriptions par jour, 30 derniers jours">${bars}</div>
      ${scale}</div>`;
}

// --- File « à traiter » : uniquement des compteurs calculés depuis la db ------
function todoHTML(pendingProviders, pendingReviews) {
  const links = [];
  if (pendingProviders > 0) {
    links.push({ href: '/admin/prestataires.html?statut=pending',
      label: 'Prestataires à approuver', count: plural(pendingProviders, 'fiche en attente', 'fiches en attente') });
  }
  if (pendingReviews > 0) {
    links.push({ href: '/admin/avis.html',
      label: 'Avis à modérer', count: plural(pendingReviews, 'avis caché', 'avis cachés') });
  }
  const body = links.length
    ? `<ul class="admin-todo__list">${links.map(l => `
        <li><a class="admin-todo__link" href="${esc(l.href)}">
          <span>${esc(l.label)}</span><span class="admin-todo__count">${esc(l.count)}</span>
        </a></li>`).join('')}</ul>`
    : '<p class="admin-todo__empty">Rien à traiter pour le moment : aucune fiche en attente, aucun avis caché.</p>';
  return `<section class="admin-todo" aria-labelledby="todo-title">
      <h2 id="todo-title">À traiter</h2>${body}
    </section>`;
}

function renderHome(stats, pendingReviews) {
  document.getElementById('admin-home').innerHTML = `
    <div class="dashboard__stats">
      ${statCardHTML('building', stats.providersActive, 'Prestataires en ligne')}
      ${statCardHTML('eye', stats.providersPending, 'Fiches en attente d’approbation')}
      ${statCardHTML('star', stats.clients, 'Clients actifs')}
      ${statCardHTML('mail', stats.requestsMonth, 'Demandes sur 30 jours')}
    </div>
    ${todoHTML(stats.providersPending, pendingReviews)}
    ${chartHTML(stats.signupsSeries)}`;
}

async function init() {
  const [stats, reviews] = await Promise.all([db.getStats(), db.listReviewsAdmin()]);
  renderHome(stats, reviews.filter(v => !v.visible).length);
}
