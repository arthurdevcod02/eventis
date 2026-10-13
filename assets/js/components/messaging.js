// messaging.js — messagerie par fils de demande, module partagé client (T8) et
// prestataire (T10). Deux colonnes : liste des fils + conversation. Toutes les
// données passent par db ; ce module ne simule rien.
import { db } from '../core/db.js';
import { esc, icon, timeAgoFR, toast, REQUEST_STATUS, EVENT_TYPES, formatDateFR } from '../core/ui.js';

// Icônes locales (même style trait que ui.js — précédent navbar.js) : ui.js ne
// fournit ni flèche retour ni cadenas.
const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ARROW_LEFT = SVG_OPEN + '<path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/></svg>';
const LOCK = SVG_OPEN + '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

const typeLabel = id => EVENT_TYPES.find(t => t.id === id)?.label ?? (id || '—');
const LOCK_TEXT = {
  closed: 'Cette demande est clôturée.',
  declined: 'Cette demande a été refusée.',
};

export function mountMessaging(rootEl, { currentUserId, getRequestIdFromUrl = true }) {
  if (!rootEl) return;

  const state = {
    threads: [],
    activeId: null,
    request: null, // demande du fil ouvert (statut frais, pilote le verrou)
    messages: [],
    loading: false,
  };

  // --- Coquille 2 colonnes ----------------------------------------------------
  rootEl.innerHTML = `
    <div class="messaging">
      <aside class="thread-list" aria-label="Conversations">
        <div class="thread-list__head"><h2>Conversations</h2></div>
        <ul class="thread-list__items" data-thread-list></ul>
      </aside>
      <section class="thread-view" aria-label="Conversation" data-thread-view></section>
    </div>`;
  const box = rootEl.querySelector('.messaging');
  const listEl = rootEl.querySelector('[data-thread-list]');
  const viewEl = rootEl.querySelector('[data-thread-view]');

  // --- Liste des fils ----------------------------------------------------------
  function threadItemHTML(t) {
    const last = t.lastMessage ?? {};
    const own = last.senderId === currentUserId;
    const preview = (own ? 'Vous : ' : '') + (last.body ?? '');
    const active = t.request.id === state.activeId;
    return `
      <li><button type="button" class="thread-item${active ? ' is-active' : ''}" data-thread="${esc(t.request.id)}"
          aria-current="${active ? 'true' : 'false'}">
        <span class="thread-item__name">${esc(t.counterparty.name)}</span>
        <span class="thread-item__time">${esc(timeAgoFR(last.createdAt))}</span>
        <span class="thread-item__preview">${esc(preview)}</span>
        ${t.unreadCount > 0 ? `<span class="thread-item__badge" aria-label="${t.unreadCount} message(s) non lu(s)">${t.unreadCount}</span>` : ''}
      </button></li>`;
  }

  function renderList() {
    if (!state.threads.length) {
      listEl.innerHTML = '<li class="thread-list__note">Aucune conversation pour le moment.</li>';
      return;
    }
    listEl.innerHTML = state.threads.map(threadItemHTML).join('');
    listEl.querySelectorAll('[data-thread]').forEach(btn =>
      btn.addEventListener('click', () => openThread(btn.dataset.thread)));
  }

  // --- Conversation --------------------------------------------------------------
  function headerHTML(t) {
    const r = t.request;
    const context = [typeLabel(r.eventType), r.eventDate ? formatDateFR(r.eventDate) : null]
      .filter(Boolean).map(esc).join(' · ');
    const st = REQUEST_STATUS[r.status] ?? { label: r.status, cls: '' };
    return `
      <header class="thread-view__head">
        <button type="button" class="thread-view__back" data-back
          aria-label="Retour à la liste des conversations">${ARROW_LEFT}</button>
        <div class="thread-view__title">
          <h2 tabindex="-1" data-title>${esc(t.counterparty.name)}</h2>
          <span class="muted">${context}</span>
        </div>
        <span class="badge ${st.cls} thread-view__status">${esc(st.label)}</span>
      </header>`;
  }

  function messagesHTML() {
    if (!state.messages.length) {
      return `<div class="thread-view__empty">${icon('mail')}<p>Aucun message pour le moment.</p></div>`;
    }
    return `<div class="thread-view__messages" data-messages aria-live="polite" aria-label="Messages de la conversation">
      ${state.messages.map(m => {
        const own = m.senderId === currentUserId;
        return `<div class="bubble${own ? ' bubble--own' : ''}">
            <span class="bubble__body">${esc(m.body)}</span>
            <span class="bubble__meta">${esc(timeAgoFR(m.createdAt))}</span>
          </div>`;
      }).join('')}
    </div>`;
  }

  function composerHTML() {
    const r = state.request;
    const locked = r && LOCK_TEXT[r.status];
    if (locked) {
      return `<footer class="thread-view__composer">
        <p class="thread-view__lock">${LOCK}<span>${esc(locked)}</span></p>
      </footer>`;
    }
    return `
      <footer class="thread-view__composer">
        <form data-composer>
          <label class="hidden" for="messaging-input">Votre message</label>
          <textarea id="messaging-input" rows="1" maxlength="2000" required
            placeholder="Écrivez votre message…"></textarea>
          <button type="submit" class="btn btn--primary">Envoyer</button>
        </form>
        <p class="thread-view__hint">Entrée pour envoyer, Maj+Entrée pour sauter une ligne.</p>
      </footer>`;
  }

  function renderView() {
    const t = state.threads.find(x => x.request.id === state.activeId);
    if (!t) {
      box.classList.remove('is-open');
      viewEl.innerHTML = `<div class="thread-view__empty">${icon('mail')}
        <p>Sélectionnez une conversation.</p></div>`;
      return;
    }
    viewEl.innerHTML = headerHTML(t) + messagesHTML() + composerHTML();
    viewEl.querySelector('[data-back]')?.addEventListener('click', () => {
      box.classList.remove('is-open');
      // Retour mobile : la liste reprend le focus au fil actif.
      listEl.querySelector(`[data-thread="${CSS.escape(state.activeId)}"]`)?.focus();
    });
    const form = viewEl.querySelector('[data-composer]');
    if (form) {
      form.addEventListener('submit', e => { e.preventDefault(); send(); });
      const input = form.querySelector('textarea');
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
    }
  }

  function scrollToBottom() {
    const boxMessages = viewEl.querySelector('[data-messages]');
    if (boxMessages) boxMessages.scrollTop = boxMessages.scrollHeight;
  }

  async function openThread(id, { initial = false } = {}) {
    const t = state.threads.find(x => x.request.id === id);
    if (!t) return;
    state.activeId = id;
    state.request = t.request;
    // Mobile : la conversation ne prend le pas que sur action utilisateur ;
    // au chargement (initial), la liste reste visible même si un fil est présélectionné.
    if (!initial) box.classList.add('is-open');
    renderView();
    renderList(); // pastille active à jour
    if (getRequestIdFromUrl && !initial) {
      const url = new URL(location.href);
      url.searchParams.set('demande', id);
      history.replaceState(null, '', url);
    }
    try {
      const msgs = await db.listMessages(id);
      if (state.activeId !== id) return; // fil changé entre-temps : rendu périmé
      state.messages = msgs;
      renderView();
      scrollToBottom(); // bas de conversation à l'ouverture
      await db.markRequestRead(id, currentUserId); // les messages des AUTRES → lus
      if (state.activeId !== id) return;
      await refreshThreads(); // pastilles non-lues rafraîchies
      if (state.activeId !== id) return;
      if (!initial && window.matchMedia?.('(min-width: 761px)').matches) {
        viewEl.querySelector('#messaging-input')?.focus({ preventScroll: true });
      }
    } catch (err) {
      toast(err?.message || 'Conversation impossible à charger, veuillez réessayer.', 'error');
    }
  }

  async function refreshThreads() {
    state.threads = await db.listThreadsFor(currentUserId);
    const active = state.threads.find(x => x.request.id === state.activeId);
    if (active) state.request = active.request; // statut frais (pilote le verrou)
    renderList();
  }

  async function send() {
    if (state.loading || !state.activeId) return;
    const rid = state.activeId;
    const input = viewEl.querySelector('#messaging-input');
    const body = input?.value.trim() ?? '';
    if (!body) { toast('Le message ne peut pas être vide.', 'error'); return; }
    const btn = viewEl.querySelector('[data-composer] button[type="submit"]');
    if (btn) btn.disabled = true;
    state.loading = true;
    try {
      await db.sendMessage({ requestId: rid, senderId: currentUserId, body });
      await db.markRequestRead(rid, currentUserId); // état cohérent (nos messages ne comptent pas)
      state.messages = await db.listMessages(rid);
      await refreshThreads(); // ordre des fils (updatedAt) + pastilles
      if (state.activeId === rid) {
        renderView();         // verrou re-vérifié si le statut a changé
        scrollToBottom();     // bas après son propre envoi
        const freshInput = viewEl.querySelector('#messaging-input');
        if (freshInput) { freshInput.value = ''; freshInput.focus(); }
      }
    } catch (err) {
      toast(err?.message || "Envoi impossible, veuillez réessayer.", 'error');
      if (btn) btn.disabled = false;
    } finally {
      state.loading = false;
    }
  }

  // --- Démarrage -------------------------------------------------------------------
  (async () => {
    listEl.innerHTML = '<li class="thread-list__note">Chargement des conversations…</li>';
    viewEl.innerHTML = `<div class="thread-view__empty">${icon('mail')}
      <p>Sélectionnez une conversation.</p></div>`;
    try {
      await refreshThreads();
      const wanted = getRequestIdFromUrl
        ? new URLSearchParams(location.search).get('demande') : null;
      const first = state.threads.find(x => x.request.id === wanted) ?? state.threads[0];
      if (first) await openThread(first.request.id, { initial: true });
      else renderList();
    } catch (err) {
      toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
      renderList();
    }
  })();
}
