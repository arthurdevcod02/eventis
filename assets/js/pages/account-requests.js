// Page « Mes demandes » client Eventis — liste complète + vue détail inline.
// Actions selon le statut : accepted → « Clôturer la prestation » (confirmation) puis
// « Laisser un avis » (étoiles 1–5 + commentaire) ; « Voir les messages » → Tâche 8.
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, formatFCFA, formatDateFR, REQUEST_STATUS, EVENT_TYPES, toast, scrollIntoViewRespectful, reviewStatusBadgeHTML } from '../core/ui.js';
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

const typeLabel = id => EVENT_TYPES.find(t => t.id === id)?.label ?? (id || '—');
const statusBadge = r => {
  const st = REQUEST_STATUS[r.status] ?? { label: r.status, cls: '' };
  return `<span class="badge ${st.cls}">${esc(st.label)}</span>`;
};
const orDash = v => (v === null || v === undefined || v === '' ? '—' : v);

let requests = [];
let providers = new Map();
let reviewedIds = new Set(); // cache local : reconstruit au chargement via db.listReviewsForClient (R23), complété par un dépôt réussi
let reviewsByRequest = new Map(); // requestId → avis de ce client (état visible réel, R23)
let rating = 0;

// --- Liste --------------------------------------------------------------------
function cardHTML(r) {
  const p = providers.get(r.providerId);
  const meta = [
    typeLabel(r.eventType),
    r.eventDate ? formatDateFR(r.eventDate) : null,
    r.budget != null ? formatFCFA(r.budget) : null,
  ].filter(Boolean).map(esc).join(' · ');
  return `
    <button type="button" class="request-card" data-open="${esc(r.id)}">
      <span class="request-card__head">
        <span class="request-card__title">${esc(p?.businessName ?? 'Prestataire')}</span>
        ${statusBadge(r)}
      </span>
      <span class="request-card__meta"><span>${meta}</span></span>
    </button>`;
}

function renderList() {
  const listEl = document.getElementById('request-list');
  if (!requests.length) {
    listEl.innerHTML = `<div class="empty">${icon('search')}
        <p>Vous n'avez pas encore de demande.</p>
        <p><a class="btn btn--primary" href="/catalogue.html">Découvrir le catalogue</a></p>
      </div>`;
    return;
  }
  listEl.innerHTML = requests.map(cardHTML).join('');
  listEl.querySelectorAll('[data-open]').forEach(btn =>
    btn.addEventListener('click', () => openDetail(btn.dataset.open)));
}

// --- Détail -------------------------------------------------------------------
function messagesLink(r) {
  return `<a class="btn btn--outline" href="/compte/messages.html?demande=${encodeURIComponent(r.id)}">Voir les messages</a>`;
}

function actionsHTML(r) {
  if (r.status === 'accepted') {
    return `
      <button type="button" class="btn btn--primary" data-action="ask-close">Clôturer la prestation</button>
      ${messagesLink(r)}`;
  }
  if (r.status === 'closed') {
    return reviewedIds.has(r.id)
      ? ''
      : `<button type="button" class="btn btn--primary" data-action="ask-review">Laisser un avis</button>
         ${messagesLink(r)}`;
  }
  if (r.status === 'sent' || r.status === 'in_progress') return messagesLink(r);
  // declined : aucune action (message informatif affiché dans le détail).
  return '';
}

function noteFor(r) {
  if (r.status === 'declined') return `<p class="muted">Cette demande a été refusée par le prestataire.</p>`;
  if (r.status === 'closed' && reviewedIds.has(r.id)) {
    const rv = reviewsByRequest.get(r.id);
    // L'état affiché vient de la donnée réelle (visibilité décidée par l'admin),
    // jamais d'une supposition : pas de succès mensonger.
    return rv?.visible
      ? `<div class="review-ok"><strong>Merci pour votre avis !</strong>
          <span>${reviewStatusBadgeHTML(true)}</span>
          <span class="muted">Votre avis est en ligne sur la fiche du prestataire.</span></div>`
      : `<div class="review-ok"><strong>Merci pour votre avis !</strong>
          <span>${reviewStatusBadgeHTML(false)}</span>
          <span class="muted">Il sera publié après validation par l'équipe Eventis.</span></div>`;
  }
  return '';
}

function detailHTML(r) {
  const p = providers.get(r.providerId);
  return `
    <div class="request-detail__head">
      <h2 tabindex="-1" id="request-detail-title">Demande à ${esc(p?.businessName ?? 'Prestataire')}</h2>
      ${statusBadge(r)}
    </div>
    <dl class="request-detail__grid">
      <div class="request-detail__item"><dt>Type d'événement</dt><dd>${esc(typeLabel(r.eventType))}</dd></div>
      <div class="request-detail__item"><dt>Date de l'événement</dt><dd>${r.eventDate ? esc(formatDateFR(r.eventDate)) : '—'}</dd></div>
      <div class="request-detail__item"><dt>Invités</dt><dd>${r.guests != null ? esc(String(r.guests)) : '—'}</dd></div>
      <div class="request-detail__item"><dt>Budget</dt><dd>${r.budget != null ? esc(formatFCFA(r.budget)) : '—'}</dd></div>
      <div class="request-detail__item"><dt>Envoyée le</dt><dd>${esc(formatDateFR(r.createdAt))}</dd></div>
      <div class="request-detail__item"><dt>Prestataire</dt><dd>${p
        ? `<a href="/prestataire.html?id=${encodeURIComponent(p.id)}">${esc(p.businessName)}</a>`
        : '—'}</dd></div>
    </dl>
    <div>
      <p class="muted">Votre message</p>
      <p class="request-detail__message">${esc(orDash(r.message))}</p>
    </div>
    ${noteFor(r)}
    <div class="request-detail__actions" data-actions>${actionsHTML(r)}</div>`;
}

function openDetail(id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  rating = 0;
  const detail = document.getElementById('request-detail');
  detail.innerHTML = detailHTML(r);
  detail.hidden = false;
  bindDetail(r);
  detail.querySelector('#request-detail-title').focus({ preventScroll: true });
  scrollIntoViewRespectful(detail);
}

function bindDetail(r) {
  const detail = document.getElementById('request-detail');
  const actions = detail.querySelector('[data-actions]');
  detail.querySelector('[data-action="ask-close"]')
    ?.addEventListener('click', () => showCloseConfirm(r, actions));
  detail.querySelector('[data-action="ask-review"]')
    ?.addEventListener('click', () => showReviewForm(r, actions));
}

// --- Clôture (avec confirmation inline) -----------------------------------------
function showCloseConfirm(r, actions) {
  actions.innerHTML = `
    <div class="confirm-box">
      <p><strong>Clôturer la prestation ?</strong><br>
      <span class="muted">La demande passera au statut « Clôturée ». Vous pourrez ensuite laisser un avis.</span></p>
      <div class="confirm-box__actions">
        <button type="button" class="btn btn--primary" data-confirm-close>Confirmer la clôture</button>
        <button type="button" class="btn btn--outline" data-cancel>Annuler</button>
      </div>
    </div>`;
  actions.querySelector('[data-cancel]').addEventListener('click', () => {
    actions.innerHTML = actionsHTML(r);
    bindDetail(r);
  });
  actions.querySelector('[data-confirm-close]').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      const updated = await db.updateRequestStatus(r.id, { status: 'closed', byRole: 'client' });
      Object.assign(r, updated);
      requests = requests.map(x => (x.id === r.id ? r : x));
      toast('Prestation clôturée.', 'success');
      renderList();
      openDetail(r.id);
    } catch (err) {
      toast(err?.message || 'Clôture impossible, veuillez réessayer.', 'error');
      e.target.disabled = false;
    }
  });
}

// --- Avis (étoiles cliquables + commentaire) --------------------------------------
function renderStarsInput() {
  let out = '<div class="rating" role="radiogroup" aria-label="Votre note sur 5">';
  for (let i = 1; i <= 5; i++) {
    out += `<button type="button" class="rating__star${i <= rating ? ' is-on' : ''}"
      data-star="${i}" aria-pressed="${i <= rating}" aria-label="${i} étoile${i > 1 ? 's' : ''}">${icon('star')}</button>`;
  }
  return out + '</div>';
}

function showReviewForm(r, actions) {
  actions.innerHTML = `
    <form class="review-form" id="review-form">
      <div class="form-errors" data-review-errors role="alert" hidden></div>
      <div class="review-form__note">
        <span id="review-rating-label">Votre note</span>
        <div data-stars>${renderStarsInput()}</div>
      </div>
      <div class="field">
        <label for="review-comment">Votre commentaire</label>
        <textarea id="review-comment" rows="4" minlength="10" maxlength="1000" required
          placeholder="Racontez votre expérience avec ce prestataire…"></textarea>
      </div>
      <p class="muted">Votre avis sera publié après validation par l'équipe Eventis.</p>
      <div class="request-detail__actions">
        <button type="submit" class="btn btn--primary">Envoyer mon avis</button>
        <button type="button" class="btn btn--outline" data-cancel-review>Annuler</button>
      </div>
    </form>`;
  const form = actions.querySelector('#review-form');
  const starsBox = actions.querySelector('[data-stars]');
  starsBox.addEventListener('click', e => {
    const btn = e.target.closest('[data-star]');
    if (!btn) return;
    rating = Number(btn.dataset.star);
    starsBox.innerHTML = renderStarsInput();
  });
  actions.querySelector('[data-cancel-review]').addEventListener('click', () => {
    rating = 0;
    actions.innerHTML = actionsHTML(r);
    bindDetail(r);
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (!rating) { toast('Veuillez choisir une note en étoiles.', 'error'); return; }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const created = await db.createReview({
        requestId: r.id, clientId: user.id, rating,
        comment: form.querySelector('#review-comment').value.trim(),
      });
      reviewedIds.add(r.id);
      reviewsByRequest.set(r.id, created); // visible: false garanti par la db à la création
      toast('Merci ! Votre avis a été enregistré.', 'success');
      renderList();
      openDetail(r.id);
    } catch (err) {
      // Étape 1 : l'erreur db (« Un avis existe déjà pour cette demande. »,
      // « Impossible de déposer un avis sur cette demande. ») est remontée
      // telle quelle dans la .form-errors du formulaire, pas masquée en toast.
      const errBox = form.querySelector('[data-review-errors]');
      errBox.textContent = err?.message || 'Envoi impossible, veuillez réessayer.';
      errBox.hidden = false;
      submitBtn.disabled = false;
    }
  });
}

// --- Chargement -------------------------------------------------------------------
async function init(user) {
  requests = await db.listRequestsForClient(user.id);
  // R23 : l'état « déjà avisée » est une lecture de données, pas un souvenir de
  // session — une demande avisée ne propose plus « Laisser un avis » après
  // rechargement. Les avis historiques de graine ont requestId null : filtrés.
  const myReviews = await db.listReviewsForClient(user.id);
  reviewedIds = new Set(myReviews.map(v => v.requestId).filter(Boolean));
  reviewsByRequest = new Map(myReviews.filter(v => v.requestId).map(v => [v.requestId, v]));
  for (const r of requests) {
    if (providers.has(r.providerId)) continue;
    try { providers.set(r.providerId, await db.getProvider(r.providerId)); }
    catch { providers.set(r.providerId, null); }
  }
  renderList();
}
