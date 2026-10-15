// admin-actions.js — helpers partagés des pages d'administration (T11, round 1).
// Amorçage de page (garde + navbar/footer + erreur de chargement annoncée),
// reprise de focus après re-rendu, et fabrique de confirmation d'action.
// Règle I2 : la mutation db est le fait validant ; le rechargement qui suit est
// cosmétique. Sa panne s'annonce (toast d'erreur) mais ne laisse PAS la modale
// ouverte et ne propose pas de ré-exécuter l'écriture. En revanche, si la
// mutation elle-même échoue, rien n'est écrit : confirmModal garde la modale
// ouverte avec le message de la base (comportement d'origine, conservé).
import { ensureAuth } from '../core/guards.js';
import { toast } from '../core/ui.js';
import { mountNavbar } from './navbar.js';
import { mountFooter } from './footer.js';
import { confirmModal } from './modal.js';

// Garde admin + montage chrome + init asynchrone ; les 5 pages admin bootent
// uniquement si la garde renvoie un utilisateur (sinon redirection déjà faite).
// Appelé sans await par les modules de page : l'amorçage est déjà asynchrone.
export async function bootAdminPage(init) {
  const user = await ensureAuth(['admin']);
  if (!user) return null;
  mountNavbar();
  mountFooter();
  init(user).catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
  return user;
}

// Le clic a détruit le déclencheur de la modale : on remet le focus sur la même
// ligne si elle subsiste, sinon sur `fallback` — un élément nécessairement
// focalisable (contrôle de la page ou zone de la table), jamais un <div> nu (M7).
export function refocusRow(refocusId, fallback) {
  const row = refocusId ? document.querySelector(`[data-id="${CSS.escape(refocusId)}"]`) : null;
  (row ?? fallback)?.focus?.({ preventScroll: true });
}

// Écrit puis annonce le succès, puis recharge. Panne de rechargement : toast
// d'erreur honnête (l'écriture est passée), la promesse reste résolue — l'appelant
// (modale de confirmation ou formulaire) conclut donc sans bloquer ni relancer.
export async function runAdminAction({ run, successMessage, reload }) {
  await run();
  toast(successMessage, 'success');
  if (reload) {
    try {
      await reload();
    } catch (err) {
      toast(`${err?.message || 'Rechargement impossible.'} — l’action est bien enregistrée ; rechargez la page pour actualiser l’affichage.`, 'error');
    }
  }
}

// Fabrique des actions confirmées en modale (Approuver/Suspendre/Vérifier/
// Publier/…) : titre, question, résumé, label du bouton, mutation db, message
// de succès et rechargement. run() qui lève = aucune écriture = modale ouverte.
export function confirmAction({ title, question, bodyHTML = '', confirmLabel, run, successMessage, reload }) {
  confirmModal({
    title, question, bodyHTML, confirmLabel,
    onConfirm: () => runAdminAction({ run, successMessage, reload }),
  });
}
