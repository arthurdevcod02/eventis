// maintenance.js — la page servie pendant la coupure. Elle relit le réglage du site pour
// deux raisons : remplacer le texte par défaut si l'administrateur en a enregistré un,
// et répondre honnêtement au bouton « Réessayer » — tant que la maintenance est active,
// on le dit au lieu de recharger la même page en espérant un meilleur résultat.
import { db } from '../core/db.js';
import { isDemoMode } from '../core/config.js';

const messageEl = document.getElementById('maint-message');
const statusEl = document.getElementById('maint-status');
const retryBtn = document.getElementById('maint-retry');
const demoNote = document.getElementById('maint-demo-note');

// En démonstration, aucune page n'est réellement fermée : le blocage vient de
// l'hébergeur, donc de la version en ligne. L'écrire plutôt que de laisser croire le
// contraire — la page montre un état que le reste du site n'applique pas.
if (isDemoMode()) demoNote.hidden = false;

// Le texte de la page est celui du brief ; un message enregistré ne le remplace que s'il
// est réellement non vide, et une plateforme injoignable laisse la page lisible.
(async () => {
  try {
    const settings = await db.getSiteSettings();
    if (settings.maintenanceMessage) messageEl.textContent = settings.maintenanceMessage;
  } catch (error) {
    // Rien à annoncer ici : le rôle de cette page est de rester lisible quoi qu'il arrive.
  }
})();

retryBtn.addEventListener('click', async () => {
  retryBtn.disabled = true;
  statusEl.textContent = 'Vérification en cours…';
  try {
    const settings = await db.getSiteSettings();
    if (settings.maintenanceEnabled) {
      statusEl.textContent = 'La maintenance est toujours en cours. Réessayez dans quelques instants.';
    } else {
      statusEl.textContent = 'La plateforme est de nouveau accessible. Ouverture…';
      location.replace('/');
    }
  } catch (error) {
    statusEl.textContent = 'Vérification impossible : la plateforme ne répond pas. Réessayez dans quelques instants.';
  } finally {
    retryBtn.disabled = false;
  }
});
