// Page connexion Eventis — e-mail/mot de passe → auth.signIn → redirection (?next ou home du rôle).
// Mode démo : case « Afficher les identifiants démo » + consigne honnête pour le mot de passe oublié.
// Retour d'un compte Google : si la session existe sans profil, l'écran de choix du rôle
// (client / prestataire) prend la main — un compte Google n'est jamais administrateur.
import { auth } from '../core/auth.js';
import { isDemoMode, CONFIG } from '../core/config.js';
import { HOME_FOR } from '../core/guards.js';
import { CGU_VERSION, CONSENT_MESSAGE } from '../core/legal.js';
import { toast, esc, icon } from '../core/ui.js';
import { clearIntent, readIntent, safeNext } from '../core/oauth.js';
import { authErrorFR, hasAuthReturnCode } from '../core/auth-messages.js';
import { mountGoogleButton, resolveOAuthReturn } from '../components/google-button.js';
import { mountPasswordToggles } from '../components/password-toggle.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar();
mountFooter();

const form = document.querySelector('#login-form');
const plainBlock = document.querySelector('#login-plain');
const emailInput = document.querySelector('#l-email');
const passwordInput = document.querySelector('#l-password');
const errorsBox = document.querySelector('#login-errors');
const submitBtn = form.querySelector('button[type="submit"]');
const pendingPanel = document.querySelector('#pending-signup');
const pendingName = document.querySelector('#pending-name');
const pendingConfirm = document.querySelector('#pending-confirm');
const pendingCancel = document.querySelector('#pending-cancel');
const pendingRoles = [...pendingPanel.querySelectorAll('input[name="pending-role"]')];
const pendingConsent = pendingPanel.querySelector('#g-consent');

mountPasswordToggles();

function showError(message) {
  errorsBox.textContent = message;
  errorsBox.hidden = false;
  errorsBox.scrollIntoView({ block: 'nearest' });
}

// Identifiants démo : visibles uniquement en mode démo, avec un bouton « Remplir » par compte.
if (isDemoMode()) {
  const DEMO_ACCOUNTS = [
    { email: 'client@demo.tg', label: 'Client' },
    { email: 'prestataire@demo.tg', label: 'Prestataire' },
    { email: 'admin@demo.tg', label: 'Administrateur' },
  ];
  const toggleWrap = document.querySelector('#demo-toggle-wrap');
  const toggle = document.querySelector('#demo-toggle');
  const accountsBox = document.querySelector('#demo-accounts');
  accountsBox.innerHTML = `
    <p class="muted">Mot de passe : <code>${esc(CONFIG.DEMO_PASSWORD)}</code></p>
    <ul>
      ${DEMO_ACCOUNTS.map(a => `
        <li class="demo-account">
          <span class="demo-account__mail"><code>${esc(a.email)}</code> <span class="muted">— ${esc(a.label)}</span></span>
          <button type="button" class="btn btn--outline" data-fill="${esc(a.email)}">Remplir</button>
        </li>`).join('')}
    </ul>`;
  toggleWrap.hidden = false;
  toggle.addEventListener('change', () => { accountsBox.hidden = !toggle.checked; });
  accountsBox.addEventListener('click', e => {
    const btn = e.target.closest('[data-fill]');
    if (!btn) return;
    emailInput.value = btn.dataset.fill;
    passwordInput.value = CONFIG.DEMO_PASSWORD;
    emailInput.focus();
  });
}

// Mot de passe oublié : un seul code pour les deux modes — la démo lève une Error dont le
// message français (consigne d'utilisation des comptes de démonstration) est affiché tel quel.
document.querySelector('#forgot-link').addEventListener('click', async e => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!email) { toast('Veuillez saisir votre adresse e-mail.', 'error'); emailInput.focus(); return; }
  try {
    await auth.requestPasswordReset(email);
    toast('E-mail de réinitialisation envoyé. Consultez votre boîte de réception.', 'success');
  } catch (err) {
    toast(authErrorFR(err), 'error');
  }
});

// Cible après connexion : l'intention Google (?next consigné avant le départ), puis
// ?next= de l'URL, sinon la home du rôle. Les deux sources sont limitées aux chemins internes.
function redirectTarget(user, intentNext = null) {
  return intentNext
    ?? safeNext(new URLSearchParams(location.search).get('next'))
    ?? HOME_FOR[user.role]
    ?? '/';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  errorsBox.hidden = true;
  submitBtn.disabled = true;
  try {
    const user = await auth.signIn(emailInput.value.trim(), passwordInput.value);
    location.replace(redirectTarget(user));
  } catch (err) {
    showError(authErrorFR(err));
  } finally {
    submitBtn.disabled = false;
  }
});

// --- Retour Google -----------------------------------------------------------
function showPendingPanel(pending, role) {
  form.hidden = true;
  plainBlock.hidden = true;
  pendingName.textContent = pending.fullName ? `— ${pending.fullName}` : '';
  // Icônes des cartes rôle (les mêmes que l'inscription).
  pendingPanel.querySelectorAll('.role-card__icon').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  if (role) pendingRoles.forEach(r => { r.checked = r.value === role; });
  pendingPanel.hidden = false;
  pendingRoles.find(r => r.checked)?.focus();
}

function hidePendingPanel() {
  pendingPanel.hidden = true;
  errorsBox.hidden = true;
  form.hidden = false;
  plainBlock.hidden = false;
  clearIntent(window.sessionStorage);
  emailInput.focus();
}

pendingConfirm.addEventListener('click', async () => {
  if (!pendingConsent.checked) {
    showError(CONSENT_MESSAGE);
    pendingConsent.focus();
    return;
  }
  const role = pendingRoles.find(r => r.checked)?.value ?? 'client';
  pendingConfirm.disabled = true;
  try {
    const user = await auth.completeSignup({ role, cguVersion: CGU_VERSION });
    const next = readIntent(window.sessionStorage).next;
    clearIntent(window.sessionStorage);
    toast('Compte prêt !', 'success');
    location.replace(redirectTarget(user, next));
  } catch (err) {
    showError(err?.message || "Une erreur est survenue, veuillez réessayer.");
  } finally {
    pendingConfirm.disabled = false;
  }
});

// Issue de secours : le mauvais compte Google est connecté. Sans elle, l'écran de
// rôle serait le seul choix possible pour cette session.
pendingCancel.addEventListener('click', async () => {
  try { await auth.signOut(); } catch { /* la déconnexion locale suffit à rendre la main */ }
  hidePendingPanel();
});

mountGoogleButton({ onError: showError });

// Mené après le montage : la page doit rester utilisable si Supabase ne répond pas.
const outcome = await resolveOAuthReturn();
if (outcome.kind === 'signed') {
  location.replace(redirectTarget(outcome.user, outcome.next));
} else if (outcome.kind === 'pending') {
  showPendingPanel(outcome.pending, outcome.role);
}

// Seconde porte d'entrée sur cet écran : la confirmation d'e-mail. Le lien arrive ici avec
// un « code » que supabase-js échange contre une session, mais la ligne « profiles » n'a
// pas pu être écrite à l'inscription — sans session, « profiles self insert » refuse
// l'insertion. Le compte est donc connecté et sans profil : c'est exactement l'état que
// l'écran de choix du rôle traitait déjà pour Google.
if (outcome.kind === 'none' && !isDemoMode() && hasAuthReturnCode(auth.entryUrl())) {
  await auth.ready();
  const pending = await auth.pendingSignup();
  if (pending) showPendingPanel(pending, pending.role);
  else if (auth.current()) location.replace(redirectTarget(auth.current()));
}
