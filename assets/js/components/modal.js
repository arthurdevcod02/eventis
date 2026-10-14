// modal.js — modale accessible partagée (R17).
// Comportement identique à la copie locale de provider-services.js:26-62 :
// role=dialog + aria-modal + aria-labelledby, Échap ferme, Tab piégé dans la
// modale, retour du focus au déclencheur, fermetures [data-close] / [data-cancel],
// focus initial sur le premier champ ( sinon le bouton de fermeture ).
// Les pages T7/T9 gardent leur copie locale (refactor décidé en T13).
import { esc, icon, toast } from '../core/ui.js';

export function openModal(title, bodyHTML, onOpen) {
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
  return { overlay, close };
}

// Modale de confirmation d'une action admin : question échappée, bodyHTML fourni
// déjà échappé par l'appelant, exécution seulement sur « Confirmer ».
// Si l'appel à la base lève, le message de la base est affiché TEL QUEL (ruling M3 :
// aucune édulcoration) et la modale reste ouverte pour ne pas perdre le contexte.
export function confirmModal({ title, question, bodyHTML = '', confirmLabel, onConfirm }) {
  openModal(title, `
    <div class="confirm-box">
      <p><strong>${esc(question)}</strong></p>
      ${bodyHTML}
      <div class="confirm-box__actions">
        <button type="button" class="btn btn--primary" data-confirm>${esc(confirmLabel)}</button>
        <button type="button" class="btn btn--outline" data-cancel>Annuler</button>
      </div>
    </div>`, (overlay, close) => {
    const btn = overlay.querySelector('[data-confirm]');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await onConfirm();
        close();
      } catch (err) {
        toast(err?.message || 'Action impossible, veuillez réessayer.', 'error');
        btn.disabled = false;
      }
    });
  });
}

