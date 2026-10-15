// Page « Demandes reçues » prestataire Eventis — liste complète + vue détail inline.
// Actions selon le statut : sent/in_progress → « Accepter » (modale de confirmation)
// ou « Refuser » (modale avec message OBLIGATOIRE envoyé avant le refus) ; réponse
// libre → sendMessage (passe la demande en in_progress automatiquement).
import { auth } from '../core/auth.js';
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, formatFCFA, formatDateFR, timeAgoFR, REQUEST_STATUS, EVENT_TYPES, toast, scrollIntoViewRespectful } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { openModal } from '../components/modal.js';

const user = requireAuth(['prestataire']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init(user).catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

const typeLabel = id => EVENT_TYPES.find(t => t.id === id)?.label ?? (id || '—');
const statusBadge = r => {
  const st = REQUEST_STATUS[r.status] ?? { label: r.status, cls: '' };
  return `<span class="badge ${st.cls}">${esc(st.label)}</span>`;
};

let requests = [];
let clients = new Map();
let unreadById = new Map();

// --- Liste ---------------------------------------------------------------------
function cardHTML(r) {
  const meta = [
    typeLabel(r.eventType),
    r.eventDate ? formatDateFR(r.eventDate) : null,
    r.guests != null ? `${r.guests} invité${r.guests > 1 ? 's' : ''}` : null,
    r.budget != null ? formatFCFA(r.budget) : null,
  ].filter(Boolean).map(esc).join(' · ');
  const unread = unreadById.get(r.id) ?? 0;
  return `
    <button type="button" class="request-card" data-open="${esc(r.id)}">
      <span class="request-card__head">
        <span class="request-card__title">${esc(clients.get(r.clientId) || 'Client')}</span>
        ${statusBadge(r)}
      </span>
      <span class="request-card__meta"><span>${meta}</span></span>
      <span class="request-card__foot">
        <span class="muted">${esc(timeAgoFR(r.createdAt))}</span>
        ${unread > 0 ? `<span class="unread-badge">${unread} non lu${unread > 1 ? 's' : ''}</span>` : ''}
      </span>
    </button>`;
}

function renderList() {
  const listEl = document.getElementById('request-list');
  if (!requests.length) {
    listEl.innerHTML = `<div class="empty">${icon('search')}
        <p>Vous n'avez pas encore reçu de demande.</p>
        <p class="muted">Les demandes de devis des clients apparaîtront ici.</p>
      </div>`;
    return;
  }
  listEl.innerHTML = requests.map(cardHTML).join('');
  listEl.querySelectorAll('[data-open]').forEach(btn =>
    btn.addEventListener('click', () => openDetail(btn.dataset.open)));
}

// --- Détail ----------------------------------------------------------------------
function conversationLink(r) {
  return `<a class="btn btn--outline" href="/espace-prestataire/messages.html?demande=${encodeURIComponent(r.id)}">Voir la conversation</a>`;
}

function actionsHTML(r) {
  if (r.status === 'sent' || r.status === 'in_progress') {
    return `
      <button type="button" class="btn btn--primary" data-action="ask-accept">Accepter</button>
      <button type="button" class="btn btn--outline" data-action="ask-decline">Refuser</button>
      ${conversationLink(r)}`;
  }
  return conversationLink(r);
}

function noteFor(r) {
  if (r.status === 'declined') return `<p class="muted">Vous avez refusé cette demande.</p>`;
  if (r.status === 'closed') return `<p class="muted">Cette prestation est clôturée par le client.</p>`;
  return '';
}

function replyHTML(r) {
  if (!['sent', 'in_progress', 'accepted'].includes(r.status)) return '';
  return `
    <form id="reply-form">
      <div class="field">
        <label for="reply-message">Répondre au client</label>
        <textarea id="reply-message" rows="3" minlength="2" maxlength="2000" required
          placeholder="Ex. Bonjour, merci pour votre demande…"></textarea>
      </div>
      <div class="request-detail__actions">
        <button type="submit" class="btn btn--primary">Envoyer la réponse</button>
      </div>
    </form>`;
}

function detailHTML(r) {
  return `
    <div class="request-detail__head">
      <h2 tabindex="-1" id="request-detail-title">Demande de ${esc(clients.get(r.clientId) || 'Client')}</h2>
      ${statusBadge(r)}
    </div>
    <dl class="request-detail__grid">
      <div class="request-detail__item"><dt>Type d'événement</dt><dd>${esc(typeLabel(r.eventType))}</dd></div>
      <div class="request-detail__item"><dt>Date de l'événement</dt><dd>${r.eventDate ? esc(formatDateFR(r.eventDate)) : '—'}</dd></div>
      <div class="request-detail__item"><dt>Invités</dt><dd>${r.guests != null ? esc(String(r.guests)) : '—'}</dd></div>
      <div class="request-detail__item"><dt>Budget</dt><dd>${r.budget != null ? esc(formatFCFA(r.budget)) : '—'}</dd></div>
      <div class="request-detail__item"><dt>Envoyée le</dt><dd>${esc(formatDateFR(r.createdAt))}</dd></div>
      <div class="request-detail__item"><dt>Client</dt><dd>${esc(clients.get(r.clientId) ?? '—')}</dd></div>
    </dl>
    <div>
      <p class="muted">Message du client</p>
      <p class="request-detail__message">${esc(r.message || '—')}</p>
    </div>
    ${noteFor(r)}
    <div class="request-detail__actions" data-actions>${actionsHTML(r)}</div>
    ${replyHTML(r)}`;
}

function syncRequest(updated) {
  requests = requests.map(x => (x.id === updated.id ? { ...x, ...updated } : x));
}

function renderDetail(r) {
  const detail = document.getElementById('request-detail');
  detail.innerHTML = detailHTML(r);
  detail.hidden = false;
  bindDetail(r);
}

function openDetail(id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  renderDetail(r);
  detailEl().querySelector('#request-detail-title').focus({ preventScroll: true });
  scrollIntoViewRespectful(detailEl());
}

const detailEl = () => document.getElementById('request-detail');

function bindDetail(r) {
  const detail = detailEl();
  detail.querySelector('[data-action="ask-accept"]')
    ?.addEventListener('click', () => showAcceptModal(r));
  detail.querySelector('[data-action="ask-decline"]')
    ?.addEventListener('click', () => showDeclineModal(r));
  detail.querySelector('#reply-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const body = form.querySelector('#reply-message').value.trim();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await db.sendMessage({ requestId: r.id, senderId: user.id, body });
      const fresh = await db.getRequest(r.id);
      syncRequest(fresh);
      toast('Message envoyé.', 'success');
      renderList();
      renderDetail(requests.find(x => x.id === r.id));
    } catch (err) {
      toast(err?.message || "Envoi impossible, veuillez réessayer.", 'error');
      btn.disabled = false;
    }
  });
}

// --- Acceptation (modale de confirmation) ------------------------------------------
function showAcceptModal(r) {
  openModal('Accepter cette demande ?', `
    <p>La demande passera au statut « Acceptée ». Vous pourrez continuer à échanger avec le client.</p>
    <div class="request-detail__actions">
      <button type="button" class="btn btn--primary" data-confirm>Confirmer l'acceptation</button>
      <button type="button" class="btn btn--outline" data-cancel>Annuler</button>
    </div>`, (overlay, close) => {
    overlay.querySelector('[data-confirm]').addEventListener('click', async e => {
      e.target.disabled = true;
      try {
        const updated = await db.updateRequestStatus(r.id, { status: 'accepted', byRole: 'prestataire' });
        syncRequest(updated);
        close();
        toast('Demande acceptée.', 'success');
        renderList();
        renderDetail(requests.find(x => x.id === r.id));
      } catch (err) {
        toast(err?.message || 'Action impossible, veuillez réessayer.', 'error');
        e.target.disabled = false;
      }
    });
  });
}

// --- Refus (modale : message OBLIGATOIRE, envoyé avant le passage à declined) ------
function showDeclineModal(r) {
  openModal('Refuser cette demande', `
    <p>Un message est obligatoire : il sera envoyé au client pour expliquer le refus.</p>
    <div class="field">
      <label for="decline-message">Message au client</label>
      <textarea id="decline-message" rows="4" maxlength="1000" required aria-describedby="decline-error"></textarea>
      <p class="error" id="decline-error" hidden></p>
    </div>
    <div class="request-detail__actions">
      <button type="button" class="btn btn--primary" data-confirm>Confirmer le refus</button>
      <button type="button" class="btn btn--outline" data-cancel>Annuler</button>
    </div>`, (overlay, close) => {
    const textarea = overlay.querySelector('#decline-message');
    const errEl = overlay.querySelector('#decline-error');
    textarea.addEventListener('input', () => { errEl.hidden = true; });
    overlay.querySelector('[data-confirm]').addEventListener('click', async e => {
      // Validation locale NON VIDE d'abord — la base exige un message du prestataire
      // avant le refus, il faut donc envoyer avant de changer le statut.
      const body = textarea.value.trim();
      if (!body) {
        errEl.textContent = 'Un message est requis pour refuser la demande.';
        errEl.hidden = false;
        textarea.focus();
        return;
      }
      e.target.disabled = true;
      try {
        await db.sendMessage({ requestId: r.id, senderId: user.id, body });
        const updated = await db.updateRequestStatus(r.id, { status: 'declined', byRole: 'prestataire' });
        syncRequest(updated);
        close();
        toast('Demande refusée. Votre message a été envoyé au client.', 'success');
        renderList();
        renderDetail(requests.find(x => x.id === r.id));
      } catch (err) {
        toast(err?.message || 'Action impossible, veuillez réessayer.', 'error');
        e.target.disabled = false;
      }
    });
  });
}

// --- Chargement ---------------------------------------------------------------------
async function init(user) {
  const providerId = await auth.getProviderIdFor(user.id);
  if (!providerId) {
    document.getElementById('request-list').innerHTML = `<div class="empty">${icon('search')}
        <p>Aucune fiche prestataire n'est associée à votre compte.</p>
      </div>`;
    return;
  }
  requests = await db.listRequestsForProvider(providerId);
  const [threads, ...joined] = await Promise.all([
    db.listThreadsFor(user.id),
    ...requests.map(r => db.getRequest(r.id).catch(() => null)),
  ]);
  unreadById = new Map(threads.map(t => [t.request.id, t.unreadCount ?? 0]));
  for (const r of requests) {
    const j = joined.shift();
    clients.set(r.clientId, j?.client?.fullName ?? '');
  }
  renderList();
}
