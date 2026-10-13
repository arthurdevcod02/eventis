// Page connexion Eventis — e-mail/mot de passe → auth.signIn → redirection (?next ou home du rôle).
// Mode démo : case « Afficher les identifiants démo » + consigne honnête pour le mot de passe oublié.
import { auth } from '../core/auth.js';
import { isDemoMode, CONFIG } from '../core/config.js';
import { HOME_FOR } from '../core/guards.js';
import { toast, icon, esc } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar();
mountFooter();

const form = document.querySelector('#login-form');
const emailInput = document.querySelector('#l-email');
const passwordInput = document.querySelector('#l-password');
const errorsBox = document.querySelector('#login-errors');
const submitBtn = form.querySelector('button[type="submit"]');

// Boutons œil : bascule du type du champ mot de passe.
document.querySelectorAll('.pw-toggle').forEach(btn => {
  const input = document.getElementById(btn.dataset.target);
  btn.innerHTML = icon('eye');
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eye-off' : 'eye');
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });
});

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
    toast(err?.message || "Une erreur est survenue, veuillez réessayer.", 'error');
  }
});

// Cible après connexion : ?next= (protégé contre les URL absolues) sinon la home du rôle.
function redirectTarget(user) {
  const next = new URLSearchParams(location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return HOME_FOR[user.role] ?? '/';
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
    errorsBox.textContent = err?.message || 'Identifiants invalides.';
    errorsBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});
