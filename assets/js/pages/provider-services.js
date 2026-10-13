// Page « Mes services » prestataire Eventis — liste des services avec édition
// inline et suppression (confirmation en deux temps), ajout via modale.
// Chaque modification est persistée via db.saveServices (qui REMPLACE la liste :
// on envoie toujours la liste complète courante).
import { auth } from '../core/auth.js';
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, formatFCFA, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = requireAuth(['prestataire']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init(user).catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

let providerId = null;
let services = [];

// --- Modale accessible (focus dedans, Échap ferme, retour au déclencheur) -----
function openModal(title, bodyHTML, onOpen) {
  const trigger = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal__head">
        <h2 id="modal-title">${esc(title)}</h2>
        <button type="button" class="modal__close" data-close aria-label="Fermer la boîte de dialogue">${icon('close')}</button>
      </div>
      <div class="modal__body">${bodyHTML}</div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    trigger?.focus?.({ preventScroll: true });
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const els = [...overlay.querySelectorAll('button, input, select, textarea, [href]')]
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.querySelector('[data-cancel]')?.addEventListener('click', close);
  onOpen?.(overlay, close);
  const initial = overlay.querySelector('input, textarea, select, button:not(.modal__close)') ?? overlay.querySelector('.modal__close');
  initial?.focus();
}

// --- Formulaire service (ajout en modale / édition inline) ----------------------
function serviceFormHTML(prefix, s = {}) {
  // Pas d'attributs required/min/step : la validation JS ci-dessous affiche les
  // erreurs en ligne ; avec required natif, l'événement submit ne serait jamais
  // déclenché et ces erreurs resteraient inaccessibles.
  return `
    <div class="field">
      <label for="${prefix}-label">Libellé</label>
      <input id="${prefix}-label" type="text" maxlength="120"
        placeholder="Ex. Buffet mariage (par personne)" value="${esc(s.label ?? '')}">
      <p class="error" id="${prefix}-label-error" hidden></p>
    </div>
    <div class="field">
      <label for="${prefix}-description">Description <span class="muted">(facultatif)</span></label>
      <input id="${prefix}-description" type="text" maxlength="200"
        placeholder="Ex. Entrée, plat, dessert, boissons" value="${esc(s.description ?? '')}">
    </div>
    <div class="field">
      <label for="${prefix}-price">Prix (FCFA)</label>
      <input id="${prefix}-price" type="number" inputmode="numeric"
        placeholder="Ex. 4500" value="${s.price ?? ''}">
      <p class="error" id="${prefix}-price-error" hidden></p>
    </div>`;
}

function readServiceForm(scope, prefix) {
  const label = scope.querySelector(`#${prefix}-label`).value.trim();
  const description = scope.querySelector(`#${prefix}-description`).value.trim();
  const rawPrice = scope.querySelector(`#${prefix}-price`).value.trim();
  const price = Number(rawPrice);
  let ok = true;
  const fail = (suffix, message) => {
    const err = scope.querySelector(`#${prefix}-${suffix}-error`);
    err.textContent = message;
    err.hidden = false;
    ok = false;
  };
  if (!label) fail('label', 'Le libellé est requis.');
  if (rawPrice === '' || !Number.isInteger(price) || price < 0) {
    fail('price', 'Le prix doit être un nombre entier supérieur ou égal à 0.');
  }
  return ok ? { label, description, price } : null;
}

// --- Persistance : saveServices remplace la liste entière ------------------------
async function persist() {
  services = await db.saveServices(providerId, services.map(s => ({
    id: s.id, label: s.label, description: s.description, price: s.price,
  })));
  services.sort((a, b) => a.price - b.price);
}

// --- Rendu ------------------------------------------------------------------------
function rowHTML(s) {
  return `
    <div class="service-row" data-row="${esc(s.id)}">
      <div class="service-row__info">
        <p class="service-row__label">${esc(s.label)}</p>
        ${s.description ? `<p class="muted">${esc(s.description)}</p>` : ''}
      </div>
      <p class="service-row__price">${esc(formatFCFA(s.price))}</p>
      <div class="service-row__actions">
        <button type="button" class="btn btn--outline" data-edit="${esc(s.id)}">Modifier</button>
        <button type="button" class="btn btn--outline" data-delete="${esc(s.id)}">Supprimer</button>
      </div>
    </div>`;
}

function renderList() {
  const listEl = document.getElementById('services-list');
  if (!services.length) {
    listEl.innerHTML = `<div class="empty">${icon('search')}
        <p>Vous n'avez pas encore de service.</p>
        <p class="muted">Ajoutez votre premier service : il sera visible sur votre fiche publique.</p>
      </div>`;
    return;
  }
  listEl.innerHTML = services.map(rowHTML).join('');
  listEl.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => startEdit(btn.dataset.edit)));
  listEl.querySelectorAll('[data-delete]').forEach(btn =>
    btn.addEventListener('click', () => askDelete(btn.dataset.delete)));
}

// --- Édition inline -----------------------------------------------------------------
function startEdit(id) {
  const s = services.find(x => x.id === id);
  const row = document.querySelector(`[data-row="${CSS.escape(id)}"]`);
  if (!s || !row) return;
  row.innerHTML = `
    <form class="service-edit" id="edit-form">
      ${serviceFormHTML('edit', s)}
      <div class="service-edit__actions">
        <button type="submit" class="btn btn--primary">Enregistrer</button>
        <button type="button" class="btn btn--outline" data-cancel-edit>Annuler</button>
      </div>
    </form>`;
  row.querySelector('#edit-label').focus();
  row.querySelector('[data-cancel-edit]').addEventListener('click', renderList);
  row.querySelector('#edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const values = readServiceForm(row, 'edit');
    if (!values) return;
    const btn = row.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      services = services.map(x => (x.id === id ? { ...x, ...values } : x));
      await persist();
      toast('Service mis à jour.', 'success');
      renderList();
    } catch (err) {
      toast(err?.message || 'Enregistrement impossible, veuillez réessayer.', 'error');
      btn.disabled = false;
    }
  });
}

// --- Suppression (confirmation en deux temps) ------------------------------------------
function askDelete(id) {
  const s = services.find(x => x.id === id);
  const row = document.querySelector(`[data-row="${CSS.escape(id)}"]`);
  if (!s || !row) return;
  row.innerHTML = `
    <div class="service-row__info">
      <p class="service-row__label">${esc(s.label)}</p>
      <p class="muted">${esc(formatFCFA(s.price))}</p>
    </div>
    <div class="service-row__confirm">
      <p><strong>Supprimer ce service ?</strong></p>
      <button type="button" class="btn btn--primary" data-confirm-delete>Confirmer la suppression</button>
      <button type="button" class="btn btn--outline" data-cancel-delete>Annuler</button>
    </div>`;
  row.querySelector('[data-cancel-delete]').addEventListener('click', renderList);
  row.querySelector('[data-confirm-delete]').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      services = services.filter(x => x.id !== id);
      await persist();
      toast('Service supprimé.', 'success');
      renderList();
    } catch (err) {
      toast(err?.message || 'Suppression impossible, veuillez réessayer.', 'error');
      e.target.disabled = false;
    }
  });
}

// --- Ajout (modale) ---------------------------------------------------------------------
function showAddModal() {
  openModal('Ajouter un service', `
    <form id="add-form">
      ${serviceFormHTML('add')}
      <div class="request-detail__actions">
        <button type="submit" class="btn btn--primary">Ajouter le service</button>
        <button type="button" class="btn btn--outline" data-cancel>Annuler</button>
      </div>
    </form>`, (overlay, close) => {
    overlay.querySelector('#add-label').focus();
    overlay.querySelector('#add-form').addEventListener('submit', async e => {
      e.preventDefault();
      const values = readServiceForm(overlay, 'add');
      if (!values) return;
      const btn = overlay.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        services = [...services, { ...values, id: undefined }];
        await persist();
        close();
        toast('Service ajouté.', 'success');
        renderList();
      } catch (err) {
        toast(err?.message || 'Ajout impossible, veuillez réessayer.', 'error');
        btn.disabled = false;
      }
    });
  });
}

// --- Chargement ---------------------------------------------------------------------------
async function init(user) {
  providerId = await auth.getProviderIdFor(user.id);
  const listEl = document.getElementById('services-list');
  if (!providerId) {
    listEl.innerHTML = `<div class="empty">${icon('search')}
        <p>Aucune fiche prestataire n'est associée à votre compte.</p>
      </div>`;
    return;
  }
  try {
    const provider = await db.getProvider(providerId);
    services = provider.services;
  } catch {
    // Fiche non visible (en attente d'approbation) : getProvider lève. On bloque
    // l'édition plutôt que de risquer d'écraser des services existants via
    // saveServices (qui remplace toute la liste).
    document.getElementById('add-service').hidden = true;
    listEl.innerHTML = `<div class="empty">${icon('search')}
        <p>Votre fiche est en cours d'examen par l'équipe Eventis.</p>
        <p class="muted">Les services seront modifiables après approbation.</p>
      </div>`;
    return;
  }
  document.getElementById('add-service').addEventListener('click', showAddModal);
  renderList();
}
