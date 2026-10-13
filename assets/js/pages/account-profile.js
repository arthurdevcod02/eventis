// Page profil client Eventis — affichage/édition nom + téléphone (e-mail en lecture
// seule) via auth.updateProfile ; zone danger honnête sur la suppression de compte.
import { auth } from '../core/auth.js';
import { isDemoMode } from '../core/config.js';
import { requireAuth } from '../core/guards.js';
import { toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = requireAuth(['client']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init(user);
}

function init(user) {
  const form = document.querySelector('#profile-form');
  const nameInput = document.querySelector('#p-name');
  const phoneInput = document.querySelector('#p-phone');
  const emailInput = document.querySelector('#p-email');
  const submitBtn = form.querySelector('button[type="submit"]');

  nameInput.value = user.fullName ?? '';
  phoneInput.value = user.phone ?? '';
  emailInput.value = user.email ?? '';

  // Suppression de compte : rien n'est promis sans l'être (principe fondateur).
  document.querySelector('#danger-text').textContent = isDemoMode()
    ? 'Mode démo : la suppression de compte n\'est pas disponible.'
    : 'La suppression de compte n\'est pas encore disponible. Pour toute demande, contactez-nous : contact@eventis.tg.';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fullName = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    if (phone && phone.replace(/\D/g, '').length < 8) {
      toast('Le numéro de téléphone doit contenir au moins 8 chiffres.', 'error');
      phoneInput.focus();
      return;
    }
    submitBtn.disabled = true;
    try {
      await auth.updateProfile({ fullName, phone });
      toast(isDemoMode() ? 'Profil mis à jour (mode démo).' : 'Profil mis à jour.', 'success');
    } catch (err) {
      toast(err?.message || 'Mise à jour impossible, veuillez réessayer.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
