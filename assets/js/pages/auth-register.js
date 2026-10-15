// Page inscription Eventis — sélecteur de rôle + nom/e-mail/téléphone/mot de passe → auth.signUp.
// Redirection post-inscription : prestataire → compléter sa fiche ; client → son compte.
import { auth } from '../core/auth.js';
import { toast, icon } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { mountPasswordToggles } from '../components/password-toggle.js';

mountNavbar();
mountFooter();

// Cibles post-inscription propres à l'onboarding (différentes des homes de session des guards).
const REDIRECT_FOR = { prestataire: '/espace-prestataire/profil.html', client: '/compte/' };

const form = document.querySelector('#register-form');
const errorsBox = document.querySelector('#reg-errors');
const submitBtn = form.querySelector('button[type="submit"]');
const roleInputs = [...form.querySelectorAll('input[name="role"]')];

// Icônes des cartes rôle.
document.querySelectorAll('.role-card__icon').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

mountPasswordToggles();

// Rôle pré-sélectionné via l'URL (?role=prestataire depuis la home, par ex.) + état visuel des cartes.
const wantedRole = new URLSearchParams(location.search).get('role');
if (roleInputs.some(r => r.value === wantedRole)) {
  roleInputs.find(r => r.value === wantedRole).checked = true;
}
const syncRoleCards = () => roleInputs.forEach(r =>
  r.closest('.role-card').classList.toggle('is-selected', r.checked));
roleInputs.forEach(r => r.addEventListener('change', syncRoleCards));
syncRoleCards();

function showError(message) {
  errorsBox.textContent = message;
  errorsBox.hidden = false;
}

// Validation métier : e-mail valide, téléphone ≥ 8 chiffres, mots de passe identiques ≥ 8.
function validate({ email, phone, password, password2 }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Veuillez saisir une adresse e-mail valide.';
  if (phone.replace(/\D/g, '').length < 8) return 'Le numéro de téléphone doit contenir au moins 8 chiffres.';
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (password !== password2) return 'Les mots de passe ne correspondent pas.';
  return '';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = {
    fullName: document.querySelector('#r-name').value.trim(),
    email: document.querySelector('#r-email').value.trim(),
    phone: document.querySelector('#r-phone').value.trim(),
    password: document.querySelector('#r-password').value,
    password2: document.querySelector('#r-password2').value,
    role: roleInputs.find(r => r.checked)?.value ?? 'client',
  };
  const error = validate(data);
  if (error) { showError(error); return; }
  errorsBox.hidden = true;
  submitBtn.disabled = true;
  try {
    const user = await auth.signUp({
      fullName: data.fullName, email: data.email, phone: data.phone,
      password: data.password, role: data.role,
    });
    toast('Compte créé !', 'success');
    location.replace(REDIRECT_FOR[user.role] ?? '/compte/');
  } catch (err) {
    showError(err?.message || "Une erreur est survenue, veuillez réessayer.");
  } finally {
    submitBtn.disabled = false;
  }
});
