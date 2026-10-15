// Page profil client Eventis — affichage/édition nom + téléphone (e-mail en lecture
// seule) via auth.updateProfile ; zone danger honnête sur la suppression de compte ;
// section « Mes avis » (T12) : les avis du client avec leur état réel — un avis
// non publié reste « En attente de modération » tant que l'admin ne l'a pas publié.
import { auth } from '../core/auth.js';
import { db } from '../core/db.js';
import { isDemoMode } from '../core/config.js';
import { ensureAuth } from '../core/guards.js';
import { esc, renderStars, formatDateFR, toast, reviewStatusBadgeHTML } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = await ensureAuth(['client']);
// user === null → la garde a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  initProfile(user);
  initMyReviews(user).catch(err => {
    toast(err?.message || 'Chargement de vos avis impossible, veuillez réessayer.', 'error');
    document.getElementById('my-reviews-slot').innerHTML =
      '<p class="muted">Chargement de vos avis impossible. Réessayez plus tard.</p>';
  });
}

function initProfile(user) {
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
    : 'La suppression de compte n\'est pas encore disponible. Pour toute demande, écrivez à nandjanakpane@gmail.com.';

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

// --- « Mes avis » (T12) ----------------------------------------------------------
// Liste accessible (ul) ; l'état est porté par du TEXTE (badge), pas seulement
// par la couleur : « Publié » seulement si l'admin l'a publié, sinon
// « En attente de modération ». La source est db.listReviewsForClient : seule
// méthode qui montre au client ses propres avis non publiés (R22).
function reviewItemHTML(v) {
  const provider = v.providerName || 'Prestataire';
  const badge = reviewStatusBadgeHTML(v.visible);
  const comment = v.comment ? esc(v.comment) : '<span class="muted">Aucun commentaire rédigé.</span>';
  return `
    <li class="my-reviews__item">
      <div class="my-reviews__head">
        <p class="my-reviews__title">${esc(provider)}</p>
        ${badge}
      </div>
      <p class="my-reviews__meta">
        <span>${renderStars(v.rating)} <span class="muted" aria-hidden="true">${esc(v.rating)} sur 5</span></span>
        <span class="muted">${esc(formatDateFR(v.createdAt) || 'date inconnue')}</span>
      </p>
      <p class="my-reviews__text">${comment}</p>
    </li>`;
}

function renderMyReviews(reviews) {
  const slot = document.getElementById('my-reviews-slot');
  slot.innerHTML = reviews.length
    ? `<ul class="my-reviews__list">${reviews.map(reviewItemHTML).join('')}</ul>`
    : '<p class="muted">Vous n\'avez pas encore déposé d\'avis. Vous pouvez en écrire un depuis une demande clôturée.</p>';
}

async function initMyReviews(user) {
  const reviews = await db.listReviewsForClient(user.id);
  renderMyReviews(reviews);
}
