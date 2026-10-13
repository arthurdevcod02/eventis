// Page tableau de bord client Eventis — bienvenue, 3 compteurs (demandes en cours,
// messages non lus, demandes clôturées) et les 3 dernières demandes.
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, formatDateFR, timeAgoFR, REQUEST_STATUS, EVENT_TYPES, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = requireAuth(['client']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init(user).catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

const OPEN_STATUSES = ['sent', 'in_progress', 'accepted'];
const typeLabel = id => EVENT_TYPES.find(t => t.id === id)?.label ?? (id || '—');

// Dernière activité d'une demande : dernier message du fil (ou le message initial),
// préfixé « Vous : » lorsque le client en est l'auteur.
function lastMessageHTML(userId, thread) {
  if (!thread) return '';
  const last = thread.lastMessage;
  const who = last.senderId === userId ? 'Vous : ' : '';
  return `${esc(who)}${esc(last.body)} · <span class="muted">${esc(timeAgoFR(last.createdAt))}</span>`;
}

function statCardHTML(iconName, value, label) {
  return `
    <div class="stat-card">
      <span class="stat-card__icon">${icon(iconName)}</span>
      <span class="stat-card__value">${value}</span>
      <span class="stat-card__label">${esc(label)}</span>
    </div>`;
}

function requestCardHTML(r, provider, userId, thread) {
  const st = REQUEST_STATUS[r.status] ?? { label: r.status, cls: '' };
  const where = [typeLabel(r.eventType), r.eventDate ? formatDateFR(r.eventDate) : null]
    .filter(Boolean).map(esc).join(' · ');
  return `
    <a class="request-card" href="/compte/demandes.html">
      <span class="request-card__head">
        <span class="request-card__title">${esc(provider ?? 'Prestataire')}</span>
        <span class="badge ${st.cls}">${esc(st.label)}</span>
      </span>
      <span class="request-card__meta"><span>${where}</span></span>
      <span class="request-card__last">${lastMessageHTML(userId, thread)}</span>
    </a>`;
}

function renderDashboard({ user, requests, threads, providers }) {
  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;
  const openCount = requests.filter(r => OPEN_STATUSES.includes(r.status)).length;
  const closedCount = requests.filter(r => r.status === 'closed').length;
  const unreadCount = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
  const threadsById = new Map(threads.map(t => [t.request.id, t]));

  const latest = requests.slice(0, 3);
  const listHTML = latest.length
    ? `<div class="request-list">${latest.map(r =>
        requestCardHTML(r, providers.get(r.providerId)?.businessName, user.id, threadsById.get(r.id))).join('')}</div>`
    : `<div class="empty">${icon('search')}
          <p>Vous n'avez pas encore de demande en cours.</p>
          <p><a class="btn btn--primary" href="/catalogue.html">Découvrir le catalogue</a></p>
        </div>`;

  document.getElementById('dashboard').innerHTML = `
    <div class="dashboard__welcome">
      <div>
        <h2>Bonjour, ${esc(firstName)}</h2>
        <p class="muted">Voici l'activité de vos demandes de devis sur Eventis.</p>
      </div>
      <a class="btn btn--outline" href="/catalogue.html">Nouvelle demande</a>
    </div>
    <div class="dashboard__stats">
      ${statCardHTML('mail', unreadCount, 'Messages non lus')}
      ${statCardHTML('arrow-right', openCount, 'Demandes en cours')}
      ${statCardHTML('check', closedCount, 'Demandes clôturées')}
    </div>
    <div class="dashboard__section-head">
      <h2>Vos dernières demandes</h2>
      <a class="dashboard__all" href="/compte/demandes.html">Voir tout ${icon('arrow-right')}</a>
    </div>
    ${listHTML}`;
}

async function init(user) {
  const [requests, threads] = await Promise.all([
    db.listRequestsForClient(user.id),
    db.listThreadsFor(user.id),
  ]);
  // Prestataires joints (nom affiché) — getProvider lève si non visible : on ignore.
  const providers = new Map();
  for (const r of requests) {
    if (providers.has(r.providerId)) continue;
    try { providers.set(r.providerId, await db.getProvider(r.providerId)); }
    catch { providers.set(r.providerId, null); }
  }
  renderDashboard({ user, requests, threads, providers });
}
