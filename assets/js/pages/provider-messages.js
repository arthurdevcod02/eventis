// Page « Messages » prestataire Eventis — monte le module partagé de messagerie par
// fils (T8). Le module déduit les fils via db.listThreadsFor(user.id) : aucun
// providerId nécessaire ici (les fils d'un compte prestataire sont ceux de la
// fiche dont il est propriétaire).
import { ensureAuth } from '../core/guards.js';
import { toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { mountMessaging } from '../components/messaging.js';

const user = await ensureAuth(['prestataire']);
// user === null → la garde a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  try {
    mountMessaging(document.querySelector('#messaging'), { currentUserId: user.id });
  } catch (err) {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  }
}
