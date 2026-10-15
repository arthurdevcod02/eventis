// Page modération des avis Eventis — file de modération : les avis non publiés
// d'abord (ordre renvoyé par db.listReviewsAdmin), puis les avis publiés.
// Actions « Publier » / « Masquer » confirmées en modale via db.setReviewVisible.
import { db } from '../core/db.js';
import { esc, icon, formatDateFR, renderStars } from '../core/ui.js';
import { bootAdminPage, confirmAction, refocusRow } from '../components/admin-actions.js';

bootAdminPage(init);

const providerLabel = v => v.providerName || 'Prestataire supprimé';
const clientLabel = v => v.clientName || 'Compte supprimé';

function itemHTML(v) {
  return `
    <article class="review-item${v.visible ? '' : ' review-item--pending'}">
      <div class="review-item__head">
        <h3 class="review-item__title">${esc(providerLabel(v))}</h3>
        ${v.visible
          ? '<span class="badge badge--accepted">Publié</span>'
          : '<span class="badge badge--progress">En attente de publication</span>'}
      </div>
      <p class="review-item__meta">
        <span>${esc(clientLabel(v))}</span>
        <span>${esc(formatDateFR(v.createdAt) || 'date inconnue')}</span>
        ${/* M9 : renderStars porte déjà aria-label « Note N sur 5 » ; le texte
             visible reste pour les voyants mais n'est pas annoncé deux fois. */''}
        <span>${renderStars(v.rating)} <span class="muted" aria-hidden="true">${esc(v.rating)} sur 5</span></span>
      </p>
      <p class="review-item__text">${v.comment ? esc(v.comment) : '<span class="muted">Aucun commentaire rédigé.</span>'}</p>
      <div class="review-item__actions">
        ${v.visible
          ? `<button type="button" class="btn btn--outline" data-action="hide" data-id="${esc(v.id)}">Masquer</button>`
          : `<button type="button" class="btn btn--primary" data-action="publish" data-id="${esc(v.id)}">Publier</button>`}
        ${v.visible
          ? ''
          : '<span class="muted">Cet avis n’apparaît sur aucune fiche publique tant qu’il n’est pas publié.</span>'}
      </div>
    </article>`;
}

function sectionHTML(id, title, list, emptyText) {
  return `
    <section aria-labelledby="${esc(id)}-title">
      <h2 id="${esc(id)}-title">${esc(title)} (${list.length})</h2>
      ${list.length
        ? `<div class="review-queue">${list.map(itemHTML).join('')}</div>`
        : `<div class="empty">${icon('search')}<p>${esc(emptyText)}</p></div>`}
    </section>`;
}

function render(list) {
  // La base renvoie déjà les non publiés en tête, puis createdAt décroissant ;
  // la séparation en deux blocs rend cet ordre lisible sans le modifier.
  const pending = list.filter(v => !v.visible);
  const published = list.filter(v => v.visible);
  document.getElementById('reviews-admin').innerHTML = `
    <p class="admin-results" role="status">${pending.length} avis à modérer sur ${list.length}</p>
    ${sectionHTML('queue', 'À modérer', pending, 'Aucun avis en attente : la file de modération est vide.')}
    ${sectionHTML('published', 'Avis publiés', published, 'Aucun avis publié pour le moment.')}`;

  const byId = new Map(list.map(v => [v.id, v]));
  document.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', () => confirmVisibility(byId.get(el.dataset.id))));
}

async function reload(refocusId = null) {
  const list = await db.listReviewsAdmin();
  render(list);
  // Repli focalisable (M7) : #reviews-admin porte tabindex="-1" dans la page.
  refocusRow(refocusId, document.getElementById('reviews-admin'));
}

function confirmVisibility(v) {
  if (!v) return;
  const publishing = !v.visible;
  confirmAction({
    title: publishing ? 'Publier un avis' : 'Masquer un avis',
    question: publishing
      ? `Publier cet avis sur la fiche de « ${providerLabel(v)} » ?`
      : `Masquer cet avis sur la fiche de « ${providerLabel(v)} » ?`,
    bodyHTML: `<dl class="request-detail__grid">
        <div class="request-detail__item"><dt>Client</dt><dd>${esc(clientLabel(v))}</dd></div>
        <div class="request-detail__item"><dt>Note</dt><dd>${esc(v.rating)} sur 5</dd></div>
        <div class="request-detail__item"><dt>Date</dt><dd>${esc(formatDateFR(v.createdAt) || '—')}</dd></div>
      </dl>
      <p class="review-item__text">${v.comment ? esc(v.comment) : '<span class="muted">Aucun commentaire rédigé.</span>'}</p>
      ${publishing
        ? '<p class="admin-note">L’avis sera visible publiquement et comptera dans la note moyenne du prestataire.</p>'
        : '<p class="admin-note">L’avis restera dans la file de modération mais ne sera plus visible ni comptabilisé.</p>'}`,
    confirmLabel: publishing ? 'Publier' : 'Masquer',
    run: () => db.setReviewVisible(v.id, publishing),
    successMessage: publishing
      ? `Avis publié sur la fiche de « ${providerLabel(v)} ».`
      : `Avis masqué sur la fiche de « ${providerLabel(v)} ».`,
    reload: () => reload(v.id),
  });
}

async function init() {
  await reload();
}
