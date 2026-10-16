// Page « nouveau mot de passe » Eventis — atteinte uniquement par le lien d'e-mail envoyé
// depuis la connexion. Le code reçu est échangé par supabase-js à la lecture de la session ;
// la page n'affiche le formulaire que si cet échange a bien produit une session.
// Sinon elle dit ce qui s'est passé, au lieu de proposer un champ qui refusera la saisie.
import { auth } from '../core/auth.js';
import { isDemoMode } from '../core/config.js';
import { HOME_FOR } from '../core/guards.js';
import { authErrorFR, hasAuthReturnCode, validateNewPassword } from '../core/auth-messages.js';
import { toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { mountPasswordToggles } from '../components/password-toggle.js';

mountNavbar();
mountFooter();
mountPasswordToggles();

const body = document.querySelector('#recovery-body');
const notice = document.querySelector('#recovery-notice');
const noticeTitle = document.querySelector('#recovery-notice-title');
const noticeText = document.querySelector('#recovery-notice-text');
const form = document.querySelector('#recovery-form');
const errorsBox = document.querySelector('#recovery-errors');
const submitBtn = form.querySelector('button[type="submit"]');
const passwordInput = document.querySelector('#p-password');
const password2Input = document.querySelector('#p-password2');

function showNotice(title, message) {
  body.hidden = true;
  noticeTitle.textContent = title;
  noticeText.textContent = message;
  notice.hidden = false;
}

function showError(message) {
  errorsBox.textContent = message;
  errorsBox.hidden = false;
  errorsBox.scrollIntoView({ block: 'nearest' });
}

if (isDemoMode()) {
  showNotice('Indisponible en démonstration',
    'Aucun e-mail n’est envoyé en mode démonstration : la réinitialisation du mot de passe exige un projet Supabase et une passerelle d’e-mail.');
} else if (!hasAuthReturnCode(auth.entryUrl())) {
  showNotice('Lien manquant',
    'Cette page ne s’ouvre que depuis le lien reçu par e-mail après « Mot de passe oublié ». Relancez la demande depuis la page de connexion.');
} else {
  // L'échange du code se déroule pendant la préparation de la session : « ready() » est
  // donc le point d'attente, et « hasSession() » la réponse à la seule question posée ici.
  await auth.ready();
  if (await auth.hasSession()) {
    notice.hidden = true;
    body.hidden = false;
    passwordInput.focus();
  } else {
    showNotice('Lien expiré',
      'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien depuis la page de connexion.');
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const invalid = validateNewPassword(passwordInput.value, password2Input.value);
  if (invalid) { showError(invalid); return; }
  errorsBox.hidden = true;
  submitBtn.disabled = true;
  try {
    const user = await auth.updatePassword(passwordInput.value);
    toast('Mot de passe mis à jour.', 'success');
    // Un compte sans ligne « profiles » (créé par Google, rôle jamais choisi) n'a pas de
    // home : il reprend la file normale depuis la connexion, où l'écran de rôle l'attend.
    location.replace(user?.role ? (HOME_FOR[user.role] ?? '/compte/') : '/auth/connexion.html');
  } catch (err) {
    showError(authErrorFR(err));
  } finally {
    submitBtn.disabled = false;
  }
});
