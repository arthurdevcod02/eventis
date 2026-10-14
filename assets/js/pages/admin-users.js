// Page administration des utilisateurs Eventis — table (nom, e-mail, rôle,
// inscription, statut) et actions Suspendre / Réactiver.
// Règle M3 : la base refuse de suspendre un administrateur ; l'UI ne propose
// donc JAMAIS l'action sur une ligne admin ni sur le compte connecté, et affiche
// le message de la base tel quel si l'appel est malgré tout déclenché.
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, formatDateFR, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { confirmModal } from '../components/modal.js';

const user = requireAuth(['admin']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init().catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

const ROLES = { client: 'Client', prestataire: 'Prestataire', admin: 'Administrateur' };

// Une ligne sans action = administrateur (refusé par la base) OU votre propre compte.
function isSuspendable(u) {
  return u.role !== 'admin' && u.id !== user.id;
}

function rowHTML(u) {
  const status = u.suspended
    ? '<span class="badge badge--progress">Suspendu</span>'
    : '<span class="badge badge--accepted">Actif</span>';
  const name = u.fullName || '—';
  const actions = isSuspendable(u)
    ? `<div class="table__actions">${u.suspended
        ? `<button type="button" class="btn btn--primary" data-action="reactivate" data-id="${esc(u.id)}">Réactiver</button>`
        : `<button type="button" class="btn btn--outline" data-action="suspend" data-id="${esc(u.id)}">Suspendre</button>`}</div>`
    : '<span class="none">—</span>';
  return `
    <tr>
      <th scope="row" class="cell-title">${esc(name)}${u.id === user.id ? ' <span class="badge">Vous</span>' : ''}</th>
      <td>${esc(u.email || '—')}</td>
      <td>${esc(ROLES[u.role] ?? u.role)}</td>
      <td>${esc(formatDateFR(u.createdAt) || '—')}</td>
      <td>${status}</td>
      <td>${actions}</td>
    </tr>`;
}

function render(list) {
  const protectedCount = list.filter(u => !isSuspendable(u)).length;
  document.getElementById('users-admin').innerHTML = `
    <p class="admin-results" role="status">${list.length} compte${list.length > 1 ? 's' : ''}</p>
    <div class="table-wrap" role="region" aria-label="Liste des utilisateurs" tabindex="0">
      <table class="table">
        <caption class="table__caption">${list.length} compte${list.length > 1 ? 's' : ''} — tri : inscription, du plus ancien au plus récent</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th><th scope="col">E-mail</th><th scope="col">Rôle</th>
            <th scope="col">Inscription</th><th scope="col">Statut</th><th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>${list.map(rowHTML).join('')}</tbody>
      </table>
    </div>
    <p class="admin-note">${icon('eye')} Les comptes administrateurs et votre propre compte (${protectedCount} ligne${protectedCount > 1 ? 's' : ''}) ne peuvent pas être suspendus : la base le refuse, l’action n’est donc pas proposée.</p>`;

  const byId = new Map(list.map(u => [u.id, u]));
  document.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', () => handlers[el.dataset.action]?.(byId.get(el.dataset.id))));
}

async function reload(refocusId = null) {
  const list = await db.listUsersAdmin();
  render(list);
  const row = refocusId && document.querySelector(`[data-id="${CSS.escape(refocusId)}"]`);
  (row ?? document.getElementById('users-admin'))?.focus?.({ preventScroll: true });
}

function confirmSuspend(u, suspended) {
  if (!u || !isSuspendable(u)) return; // garde-fou : aucune action admin sur une ligne protégée
  const label = u.fullName || u.email || 'ce compte';
  confirmModal({
    title: suspended ? 'Suspendre un compte' : 'Réactiver un compte',
    question: `${suspended ? 'Suspendre' : 'Réactiver'} le compte de « ${label} » ?`,
    bodyHTML: `<dl class="request-detail__grid">
        <div class="request-detail__item"><dt>E-mail</dt><dd>${esc(u.email || '—')}</dd></div>
        <div class="request-detail__item"><dt>Rôle</dt><dd>${esc(ROLES[u.role] ?? u.role)}</dd></div>
        <div class="request-detail__item"><dt>Inscription</dt><dd>${esc(formatDateFR(u.createdAt) || '—')}</dd></div>
      </dl>
      ${suspended ? '<p class="admin-note">La connexion sera refusée et les fiches du prestataire disparaîtront du catalogue public.</p>' : ''}`,
    confirmLabel: suspended ? 'Suspendre' : 'Réactiver',
    onConfirm: async () => {
      await db.setUserSuspended(u.id, suspended);
      toast(suspended ? `Compte de « ${label} » suspendu.` : `Compte de « ${label} » réactivé.`, 'success');
      await reload(u.id);
    },
  });
}

const handlers = {
  suspend: u => confirmSuspend(u, true),
  reactivate: u => confirmSuspend(u, false),
};

async function init() {
  await reload();
}
