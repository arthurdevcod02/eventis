// Page tableau de bord prestataire Eventis — bandeau d'attente d'approbation,
// 4 compteurs (nouvelles demandes, en cours, taux de réponse 30 j, note moyenne)
// et les 5 dernières demandes reçues.
import { auth } from '../core/auth.js';
import { db } from '../core/db.js';
import { ensureAuth } from '../core/guards.js';
import { esc, icon, formatFCFA, formatDateFR, timeAgoFR, REQUEST_STATUS, EVENT_TYPES, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = await ensureAuth(['prestataire']);
// user === null → la garde a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init(user).catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

const DAY_MS = 86400000;
const PENDING_TEXT = 'Votre fiche est en cours d’examen par l’équipe Eventis. Elle sera visible après approbation.';
const typeLabel = id => EVENT_TYPES.find(t => t.id === id)?.label ?? (id || '—');
const frNum = n => String(n).replace('.', ',');

function statCardHTML(iconName, value, label) {
  return `
    <div class="stat-card">
      <span class="stat-card__icon">${icon(iconName)}</span>
      <span class="stat-card__value">${value}</span>
      <span class="stat-card__label">${esc(label)}</span>
    </div>`;
}

function requestCardHTML(r, clientName, unread) {
  const st = REQUEST_STATUS[r.status] ?? { label: r.status, cls: '' };
  const meta = [
    typeLabel(r.eventType),
    r.eventDate ? formatDateFR(r.eventDate) : null,
    r.guests != null ? `${r.guests} invité${r.guests > 1 ? 's' : ''}` : null,
    r.budget != null ? formatFCFA(r.budget) : null,
  ].filter(Boolean).map(esc).join(' · ');
  return `
    <a class="request-card" href="/espace-prestataire/demandes.html">
      <span class="request-card__head">
        <span class="request-card__title">${esc(clientName)}</span>
        <span class="badge ${st.cls}">${esc(st.label)}</span>
      </span>
      <span class="request-card__meta"><span>${meta}</span></span>
      <span class="request-card__foot">
        <span class="muted">${esc(timeAgoFR(r.createdAt))}</span>
        ${unread > 0 ? `<span class="unread-badge">${unread} non lu${unread > 1 ? 's' : ''}</span>` : ''}
      </span>
    </a>`;
}

function renderDashboard({ user, provider, requests, clients, unreadById, responseRate, pending }) {
  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;
  const newCount = requests.filter(r => r.status === 'sent').length;
  const activeCount = requests.filter(r => r.status === 'in_progress' || r.status === 'accepted').length;

  const latest = requests.slice(0, 5);
  const listHTML = latest.length
    ? `<div class="request-list">${latest.map(r =>
        requestCardHTML(r, clients.get(r.clientId) || 'Client', unreadById.get(r.id) ?? 0)).join('')}</div>`
    : `<div class="empty">${icon('search')}
          <p>Vous n'avez pas encore reçu de demande.</p>
          <p class="muted">Vos demandes de devis reçues apparaîtront ici.</p>
        </div>`;

  const ratingValue = provider && provider.reviewsCount
    ? `${frNum(provider.avgRating)}/5`
    : '—';

  document.getElementById('dashboard').innerHTML = `
    ${pending ? `<div class="notice notice--pending" role="status">${icon('eye')}<p>${esc(PENDING_TEXT)}</p></div>` : ''}
    <div class="dashboard__welcome">
      <div>
        <h2>Bonjour, ${esc(firstName)}</h2>
        <p class="muted">Voici l'activité des demandes reçues sur Eventis.</p>
      </div>
      ${provider ? `<a class="btn btn--outline" href="/prestataire.html?id=${encodeURIComponent(provider.id)}">Voir ma fiche publique</a>` : ''}
    </div>
    <div class="dashboard__stats dashboard__stats--4">
      ${statCardHTML('mail', newCount, 'Nouvelles demandes')}
      ${statCardHTML('arrow-right', activeCount, 'En cours')}
      ${statCardHTML('check', responseRate === null ? '—' : `${responseRate} %`, 'Taux de réponse (30 jours)')}
      ${statCardHTML('star', ratingValue, 'Note moyenne')}
    </div>
    <div class="dashboard__section-head">
      <h2>Vos 5 dernières demandes</h2>
      <a class="dashboard__all" href="/espace-prestataire/demandes.html">Voir tout ${icon('arrow-right')}</a>
    </div>
    ${listHTML}`;
}

async function init(user) {
  const providerId = await auth.getProviderIdFor(user.id);
  const root = document.getElementById('dashboard');
  if (!providerId) {
    root.innerHTML = `<div class="empty">${icon('search')}
        <p>Aucune fiche prestataire n'est associée à votre compte.</p>
      </div>`;
    return;
  }

  // Fiche non visible (en attente d'approbation, ou compte suspendu) : db.getProvider
  // lève « Prestataire introuvable. » — c'est le seul signal exposé par db, on l'affiche.
  let provider = null;
  try { provider = await db.getProvider(providerId); } catch { /* fiche non visible */ }
  const pending = !provider;

  const [requests, threads] = await Promise.all([
    db.listRequestsForProvider(providerId),
    db.listThreadsFor(user.id),
  ]);
  const unreadById = new Map(threads.map(t => [t.request.id, t.unreadCount ?? 0]));

  // Nom du client par demande (getRequest joint client.fullName — cf. brief).
  const clients = new Map();
  for (const r of requests) {
    if (clients.has(r.clientId)) continue;
    try { clients.set(r.clientId, (await db.getRequest(r.id)).client.fullName); }
    catch { clients.set(r.clientId, ''); }
  }

  // Taux de réponse : part des demandes des 30 derniers jours ayant au moins un
  // message du prestataire. Aucune demande sur la période → « — » (jamais ÷ 0).
  const monthAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const recent = requests.filter(r => r.createdAt >= monthAgo);
  let responseRate = null;
  if (recent.length) {
    let answered = 0;
    for (const r of recent) {
      const msgs = await db.listMessages(r.id);
      if (msgs.some(m => m.senderId === user.id)) answered++;
    }
    responseRate = Math.round((answered / recent.length) * 100);
  }

  renderDashboard({ user, provider, requests, clients, unreadById, responseRate, pending });
}
