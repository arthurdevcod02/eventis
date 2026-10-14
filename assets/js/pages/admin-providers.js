// Page administration des prestataires Eventis — table filtrable par statut,
// badge de vérification, actions par ligne (Approuver / Vérifier / Retirer la
// vérification / Suspendre / Réactiver) confirmées en modale puis persistées via db.
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { confirmModal } from '../components/modal.js';

const user = requireAuth(['admin']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
// L'amorçage est placé après les déclarations d'état (une fonction appelée depuis
// init() lit `filter` dès le premier appel : le garder ici déclencherait une
// erreur de zone temporelle morte « Cannot access 'filter' before initialization »).

// Libellés portés par du texte (jamais la couleur seule) ; classes de badges
// déjà définies dans components.css.
const STATUTS = {
  pending: { label: 'En attente', cls: 'badge--progress' },
  approved: { label: 'Approuvé', cls: 'badge--accepted' },
  suspended: { label: 'Suspendu', cls: 'badge--closed' },
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

if (user) {
  mountNavbar();
  mountFooter();
  init().catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

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
  // Lien public seulement si la fiche est réellement visible (getProvider lève
  // sinon : pas de lien qui aboutit à « Prestataire introuvable »).
  const title = p.status === 'approved'
    ? `<a href="/prestataire.html?id=${esc(encodeURIComponent(p.id))}">${esc(name)}</a>`
    : esc(name);
  const verified = p.isVerified
    ? `<span class="badge badge--verified">${icon('check')} Vérifié</span>`
    : badgeHTML('', 'Non vérifié');
  return `
    <tr>
      <th scope="row" class="cell-title">${title}</th>
      <td>${esc(p.owner.fullName || '—')}</td>
      <td>${esc(p.owner.email || '—')}</td>
      <td>${esc(p.categoryName || '—')}</td>
      <td>${badgeHTML(st.cls, st.label)}</td>
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

  document.getElementById('f-status').addEventListener('change', e => {
    filter = e.target.value;
    reload();
  });
  const byId = new Map(list.map(p => [p.id, p]));
  document.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', () => handlers[el.dataset.action]?.(byId.get(el.dataset.id))));
}

async function reload(refocusId = null) {
  const list = await db.listProvidersAdmin(filter ? { status: filter } : {});
  render(list);
  // Le clic a détruit le déclencheur de la modale : on remet le focus sur la
  // même ligne si elle subsiste (changement de filtre), sinon sur le filtre.
  const row = refocusId && document.querySelector(`[data-id="${CSS.escape(refocusId)}"]`);
  (row ?? document.getElementById('f-status'))?.focus?.({ preventScroll: true });
}

const handlers = {
  approve(p) {
    if (!p) return;
    confirmModal({
      title: 'Approuver un prestataire',
      question: `Approuver « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: summaryHTML(p),
      confirmLabel: 'Approuver',
      onConfirm: async () => {
        await db.setProviderStatus(p.id, 'approved');
        toast(`« ${p.businessName || 'La fiche'} » est approuvé : la fiche est publique.`, 'success');
        await reload(p.id);
      },
    });
  },

  suspend(p) {
    if (!p) return;
    confirmModal({
      title: 'Suspendre un prestataire',
      question: `Suspendre « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: `${summaryHTML(p)}<p class="admin-note">La fiche disparaît du catalogue public et de sa page publique tant qu’elle est suspendue.</p>`,
      confirmLabel: 'Suspendre',
      onConfirm: async () => {
        await db.setProviderStatus(p.id, 'suspended');
        toast(`« ${p.businessName || 'La fiche'} » est suspendu : il n’est plus visible publiquement.`, 'success');
        await reload(p.id);
      },
    });
  },

  reactivate(p) {
    if (!p) return;
    confirmModal({
      title: 'Réactiver un prestataire',
      question: `Réactiver « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: summaryHTML(p),
      confirmLabel: 'Réactiver',
      onConfirm: async () => {
        await db.setProviderStatus(p.id, 'approved');
        toast(`« ${p.businessName || 'La fiche'} » est de nouveau approuvé et visible.`, 'success');
        await reload(p.id);
      },
    });
  },

  verify(p) {
    if (!p) return;
    confirmModal({
      title: 'Accorder le badge Vérifié',
      question: `Accorder le badge « Vérifié » à « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: `<p class="admin-note">À réserver aux fiches dont vous avez contrôlé l’identité et les prestations : le badge est affiché publiquement.</p>${summaryHTML(p)}`,
      confirmLabel: 'Accorder le badge',
      onConfirm: async () => {
        await db.setProviderVerified(p.id, true);
        toast(`Badge « Vérifié » accordé à « ${p.businessName || 'la fiche'} ».`, 'success');
        await reload(p.id);
      },
    });
  },

  unverify(p) {
    if (!p) return;
    confirmModal({
      title: 'Retirer le badge Vérifié',
      question: `Retirer le badge « Vérifié » de « ${p.businessName || 'cette fiche'} » ?`,
      bodyHTML: summaryHTML(p),
      confirmLabel: 'Retirer le badge',
      onConfirm: async () => {
        await db.setProviderVerified(p.id, false);
        toast(`Badge « Vérifié » retiré de « ${p.businessName || 'la fiche'} ».`, 'success');
        await reload(p.id);
      },
    });
  },
};

async function init() {
  await reload();
}
