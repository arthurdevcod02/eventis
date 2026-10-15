// Page administration des utilisateurs Eventis — table (nom, e-mail, rôle,
// inscription, statut) et actions Suspendre / Réactiver.
// Règle M3 : l'UI ne propose JAMAIS l'action sur une ligne administrateur ni sur
// le compte connecté. En mode démo, la base refuse en plus toute suspension
// d'administrateur ; en mode Supabase, seule cette barrière d'interface protège
// ces lignes (le message de la page doit donc décrire ce qui est réellement
// garanti, pas une protection de base qui n'existe que dans un des deux modes).
import { db } from '../core/db.js';
import { esc, icon, formatDateFR } from '../core/ui.js';
import { bootAdminPage, confirmAction, refocusRow } from '../components/admin-actions.js';

const ROLES = { client: 'Client', prestataire: 'Prestataire', admin: 'Administrateur' };

// Une ligne sans action = administrateur OU votre propre compte (barrière UI).
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
    <p class="admin-note">${icon('eye')} Les comptes administrateurs et votre propre compte (${protectedCount} ligne${protectedCount > 1 ? 's' : ''}) ne sont jamais proposés à la suspension depuis cette page : l’action y est absente, et un administrateur ne peut pas suspendre son propre compte.</p>`;

  const byId = new Map(list.map(u => [u.id, u]));
  document.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', () => handlers[el.dataset.action]?.(byId.get(el.dataset.id))));
}

async function reload(refocusId = null) {
  const list = await db.listUsersAdmin();
  render(list);
  // Repli focalisable (M7) : #users-admin porte tabindex="-1" dans la page.
  refocusRow(refocusId, document.getElementById('users-admin'));
}

function confirmSuspend(u, suspended) {
  if (!u || !isSuspendable(u)) return; // garde-fou : aucune action sur une ligne protégée
  const label = u.fullName || u.email || 'ce compte';
  // I3 : la conséquence sur le catalogue public n'existe que pour un compte
  // prestataire (fiches rattachées) — ne pas l'affirmer pour un client.
  const consequence = suspended
    ? `<p class="admin-note">La connexion sera refusée.${u.role === 'prestataire'
        ? ' Les fiches de ce prestataire disparaîtront du catalogue public tant que le compte est suspendu.'
        : ''}</p>`
    : '';
  confirmAction({
    title: suspended ? 'Suspendre un compte' : 'Réactiver un compte',
    question: `${suspended ? 'Suspendre' : 'Réactiver'} le compte de « ${label} » ?`,
    bodyHTML: `<dl class="request-detail__grid">
        <div class="request-detail__item"><dt>E-mail</dt><dd>${esc(u.email || '—')}</dd></div>
        <div class="request-detail__item"><dt>Rôle</dt><dd>${esc(ROLES[u.role] ?? u.role)}</dd></div>
        <div class="request-detail__item"><dt>Inscription</dt><dd>${esc(formatDateFR(u.createdAt) || '—')}</dd></div>
      </dl>${consequence}`,
    confirmLabel: suspended ? 'Suspendre' : 'Réactiver',
    run: () => db.setUserSuspended(u.id, suspended),
    successMessage: suspended ? `Compte de « ${label} » suspendu.` : `Compte de « ${label} » réactivé.`,
    reload: () => reload(u.id),
  });
}

const handlers = {
  suspend: u => confirmSuspend(u, true),
  reactivate: u => confirmSuspend(u, false),
};

async function init() {
  await reload();
}

// requireAuth renvoie le compte connecté : user.id sert à exclure sa propre ligne.
// user === null (non admin) → bootAdminPage ne lance rien (redirection déjà faite).
const user = bootAdminPage(init);
