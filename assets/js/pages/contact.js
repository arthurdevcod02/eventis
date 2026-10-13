// Page contact Eventis — formulaire nom/e-mail/message → db.saveContactMessage + toast.
// Mode démo : le message est enregistré localement (stockage démo) et le toast l'indique honnêtement.
import { db } from '../core/db.js';
import { isDemoMode } from '../core/config.js';
import { toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('contact');
mountFooter();

const form = document.querySelector('#contact-form');
const submitBtn = form.querySelector('button[type="submit"]');

// Mention honnête persistante en mode démo (le toast répète la même information à l'envoi).
if (isDemoMode()) document.querySelector('#contact-demo-note').hidden = false;

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  submitBtn.disabled = true;
  try {
    await db.saveContactMessage({
      name: document.querySelector('#c-name').value.trim(),
      email: document.querySelector('#c-email').value.trim(),
      message: document.querySelector('#c-message').value.trim(),
    });
    toast(isDemoMode()
      ? 'Mode démonstration : votre message est enregistré localement et ne sera pas transmis.'
      : 'Message envoyé.', 'success');
    form.reset();
  } catch (err) {
    toast(err?.message || "Une erreur est survenue, veuillez réessayer.", 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
