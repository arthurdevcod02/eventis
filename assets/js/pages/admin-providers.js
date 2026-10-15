// Page administration des prestataires Eventis — table filtrable par statut,
// badge de vérification, actions par ligne (Approuver / Vérifier / Retirer la
// vérification / Suspendre / Réactiver) confirmées en modale puis persistées via db.
import { db } from '../core/db.js';
import { esc, icon, toast } from '../core/ui.js';
import { bootAdminPage, confirmAction, refocusRow } from '../components/admin-actions.js';

// Libellés portés par du texte (jamais la couleur seule) ; classes de badges
// déjà définies dans components.css. « Suspendu » partage badge--progress avec
// la page utilisateurs (règle M10 : même libellé = même classe).
const STATUTS = {
  pending: { label: 'En attente', cls: 'badge--progress' },
  approved: { label: 'Approuvé', cls: 'badge--accepted' },
  suspended: { label: 'Suspendu', cls: 'badge--progress' },
};
const FILTERS = [['', 'Tous les statuts'], ['pending', 'En attente'], ['approved', 'Approuvés'], ['suspended', 'Suspendus']];
const EMPTY_TEXT = {
  '': 'Aucun prestataire inscrit pour le moment.',
  pending: 'Aucune fiche en attente : la file d’approbation est vide.',
  approved: 'Aucun prestataire approuvé.',
  suspended: 'Aucun prestataire suspendu.',
};

// Filtre initial lu de l'URL (?statut=pending) — lien du tableau de bord.
// Valeur inconnue → retombe sur « tous » (aucun tableau fantôme).
const fromURL = new URLSearchParams(location.search).get('statut');
let filter = Object.hasOwn(STATUTS, fromURL) ? fromURL : '';

bootAdminPage(init);

const actionBtn = (action, id, label, tone) =>
  `<button type="button" class="btn btn--${tone}" data-action="${esc(action)}" data-id="${esc(id)}">${esc(label)}</button>`;

const badgeHTML = (cls, label) => `<span class="badge${cls ? ` ${cls}` : ''}">${esc(label)}</span>`;

function summaryHTML(p) {
  return `<dl class="request-detail__grid">
    <div class="request-detail__item"><dt>Nom de la fiche</dt><dd>${esc(p.businessName || '—')}</dd></div>
    <div class="request-detail__item"><dt>Propriétaire</dt><dd>${esc(p.owner.fullName || '—')}</dd></div>
    <div class="request-detail__item"><dt>E-mail</dt><dd>${esc(p.owner.email || '—')}</dd></div>
    <div class="request-detail__item"><dt>Catégorie</dt><dd>${esc(p.categoryName || '—')}</dd></div>
  </dl>`;
}

// Actions STRICTEMENT conditionnées au statut (brief Étape 2) :
// pending → Approuver ; approved → Vérifier/Retirer la vérification + Suspendre ;
// suspended → Réactiver.
function actionsFor(p) {
  if (p.status === 'pending') return [actionBtn('approve', p.id, 'Approuver', 'primary')];
  if (p.status === 'approved') {
    return [
      p.isVerified
        ? actionBtn('unverify', p.id, 'Retirer la vérification', 'outline')
        : actionBtn('verify', p.id, 'Vérifier', 'outline'),
      actionBtn('suspend', p.id, 'Suspendre', 'outline'),
    ];
  }
  if (p.status === 'suspended') return [actionBtn('reactivate', p.id, 'Réactiver', 'primary')];
  return [];
}

function rowHTML(p) {
  const st = STATUTS[p.status] ?? { label: p.status, cls: '' };
  const name = p.businessName || 'Fiche sans nom';
  // Lien public seulement si la fiche est réellement visible : getProvider et
  // listProviders masquent aussi un prestataire dont le gérant est suspendu
  // (I4/R18) — sans ce contrôle, « Approuvé » suffirait à poser un lien menant à 404.
  const ownerHidden = p.status === 'approved' && p.ownerSuspended;
  const title = (p.status === 'approved' && !ownerHidden)
    ? `<a href="/prestataire.html?id=${esc(encodeURIComponent(p.id))}">${esc(name)}</a>`
    : esc(name);
  const verified = p.isVerified
    ? `<span class="badge badge--verified">${icon('check')} Vérifié</span>`
    : badgeHTML('', 'Non vérifié');
  // Mention textuelle honnête : la raison pour laquelle aucun lien public n'est
  // proposé malgré le statut « Approuvé ».
  const statusCell = badgeHTML(st.cls, st.label)
    + (ownerHidden ? ' <span class="muted">Gérant suspendu</span>' : '');
  return `
    <tr>
      <th scope="row" class="cell-title">${title}</th>
      <td>${esc(p.owner.fullName || '—')}</td>
      <td>${esc(p.owner.email || '—')}</td>
      <td>${esc(p.categoryName || '—')}</td>
      <td>${statusCell}</td>
      <td>${verified}</td>
      <td><div class="table__actions">${actionsFor(p).join('')}</div></td>
    </tr>`;
}

function render(list) {
  const label = FILTERS.find(([v]) => v === filter)[1];
  const tableHTML = `
    <div class="table-wrap" role="region" aria-label="Liste des prestataires" tabindex="0">
      <table class="table">
        <caption class="table__caption">${list.length} fiche${list.length > 1 ? 's' : ''} — filtre : ${esc(label.toLowerCase())}</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th><th scope="col">Propriétaire</th><th scope="col">E-mail</th>
            <th scope="col">Catégorie</th><th scope="col">Statut</th><th scope="col">Vérification</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>${list.map(rowHTML).join('')}</tbody>
      </table>
    </div>`;
  document.getElementById('providers-admin').innerHTML = `
    <div class="admin-toolbar">
      <div class="field">
        <label for="f-status">Filtrer par statut</label>
        <select id="f-status">${FILTERS.map(([v, l]) =>
          `<option value="${esc(v)}"${v === filter ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </div>
      <p class="admin-results">${list.length} résultat${list.length > 1 ? 's' : ''}</p>
    </div>
    ${list.length ? tableHTML : `<div class="empty">${icon('search')}<p>${esc(EMPTY_TEXT[filter])}</p></div>`}`;

  // I1 : le rechargement déclenché par le filtre est rattaché ; sa panne affiche
  // le message de la base (la table affichée peut rester obsolète, c'est annoncé).
  document.getElementById('f-status').addEventListener('change', e => {
    filter = e.target.value;
    reload().catch(err => {
      toast(err?.message || 'Rechargement impossible, veuillez réessayer.', 'error');
    });
  });
  const byId = new Map(list.map(p => [p.id, p]));
  document.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', () => handlers[el.dataset.action]?.(byId.get(el.dataset.id))));
}

async function reload(refocusId = null) {
  const list = await db.listProvidersAdmin(filter ? { status: filter } : {});
  render(list);
  refocusRow(refocusId, document.getElementById('f-status'));
}

const handlers = {
  approve(p) {
    if (!p) return;
    confirmAction({
      title: 'Approuver un prestataire',
      question: `Approuver « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: summaryHTML(p),
      confirmLabel: 'Approuver',
      run: () => db.setProviderStatus(p.id, 'approved'),
      // Aucune promesse de visibilité tant que le gérant est suspendu : la fiche
      // reste masquée du catalogue (db.listProviders / getProvider, ruling R18).
      successMessage: p.ownerSuspended
        ? `La fiche « ${p.businessName || 'sans nom'} » est approuvée, mais son gérant est suspendu : elle reste masquée du catalogue public.`
        : `La fiche « ${p.businessName || 'sans nom'} » est approuvée : elle est visible publiquement.`,
      reload: () => reload(p.id),
    });
  },

  suspend(p) {
    if (!p) return;
    confirmAction({
      title: 'Suspendre un prestataire',
      question: `Suspendre « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: `${summaryHTML(p)}<p class="admin-note">La fiche disparaît du catalogue public et de sa page publique tant qu’elle est suspendue.</p>`,
      confirmLabel: 'Suspendre',
      run: () => db.setProviderStatus(p.id, 'suspended'),
      successMessage: `La fiche « ${p.businessName || 'sans nom'} » est suspendue : elle n’est plus visible publiquement.`,
      reload: () => reload(p.id),
    });
  },

  reactivate(p) {
    if (!p) return;
    confirmAction({
      title: 'Réactiver un prestataire',
      question: `Réactiver « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: summaryHTML(p),
      confirmLabel: 'Réactiver',
      run: () => db.setProviderStatus(p.id, 'approved'),
      successMessage: p.ownerSuspended
        ? `La fiche « ${p.businessName || 'sans nom'} » est de nouveau approuvée, mais son gérant est suspendu : elle reste masquée du catalogue public.`
        : `La fiche « ${p.businessName || 'sans nom'} » est de nouveau approuvée et visible.`,
      reload: () => reload(p.id),
    });
  },

  verify(p) {
    if (!p) return;
    confirmAction({
      title: 'Accorder le badge Vérifié',
      question: `Accorder le badge « Vérifié » à « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: `<p class="admin-note">À réserver aux fiches dont vous avez contrôlé l’identité et les prestations : le badge est affiché publiquement.</p>${summaryHTML(p)}`,
      confirmLabel: 'Accorder le badge',
      run: () => db.setProviderVerified(p.id, true),
      successMessage: `Badge « Vérifié » accordé à la fiche « ${p.businessName || 'sans nom'} ».`,
      reload: () => reload(p.id),
    });
  },

  unverify(p) {
    if (!p) return;
    confirmAction({
      title: 'Retirer le badge Vérifié',
      question: `Retirer le badge « Vérifié » de « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: summaryHTML(p),
      confirmLabel: 'Retirer le badge',
      run: () => db.setProviderVerified(p.id, false),
      successMessage: `Badge « Vérifié » retiré de la fiche « ${p.businessName || 'sans nom'} ».`,
      reload: () => reload(p.id),
    });
  },
};

async function init() {
  await reload();
}
