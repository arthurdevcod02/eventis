// Page fiche prestataire Eventis — galerie, services & tarifs, avis, demande de devis.
// La demande créée ici est consommée par les Tâches 7 (compte client), 8/10 (messagerie).
import { db } from '../core/db.js';
import { auth } from '../core/auth.js';
import { esc, icon, renderStars, formatFCFA, formatDateFR, toast, initReveal, EVENT_TYPES } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

mountNavbar('');
mountFooter();

// --- Chargement du prestataire : inconnu / non approuvé → redirection 404 ------
const id = new URLSearchParams(location.search).get('id');
let provider = null;
try {
  provider = await db.getProvider(id);
} catch {
  // Redirection côté client : serve.js sert 404.html avec le statut 200 (fallback statique).
  location.replace('/404.html');
}

// Date du jour au format ISO (min du champ date — comparaison lexicographique fiable).
const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Numéros nettoyés pour les liens tel:/wa.me (uniquement si renseignés).
const cleanTel = v => String(v ?? '').replace(/[^\d+]/g, '');
const cleanWa = v => String(v ?? '').replace(/\D/g, '');

function renderGallery(p) {
  const section = document.getElementById('provider-gallery');
  const heroImg = document.getElementById('hero-image');
  const thumbs = document.getElementById('gallery-thumbs');
  const sources = [...new Set([p.coverUrl, ...p.gallery].filter(Boolean))];
  if (!sources.length) { section.hidden = true; return; }
  heroImg.src = sources[0];
  heroImg.alt = p.businessName;
  if (sources.length < 2) return;
  thumbs.innerHTML = sources.map((src, i) =>
    `<button type="button" class="provider-gallery__thumb" aria-pressed="${i === 0}"
       aria-label="Afficher la photo ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('');
  thumbs.hidden = false;
  thumbs.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const i = [...thumbs.children].indexOf(btn);
    heroImg.src = sources[i];
    for (const [j, b] of [...thumbs.children].entries()) b.setAttribute('aria-pressed', String(j === i));
  });
}

function renderHead(p) {
  const where = [p.categoryName, p.quarter, p.city].filter(Boolean).map(esc).join(' · ');
  const note = p.reviewsCount
    ? `${renderStars(p.avgRating)} <span class="muted">(${p.reviewsCount} avis)</span>`
    : '<span class="muted">Pas encore d’avis</span>';
  const tel = cleanTel(p.phone);
  const wa = cleanWa(p.whatsapp);
  const contacts = [
    tel ? `<a href="tel:${esc(tel)}">${icon('phone')} <span>${esc(p.phone)}</span></a>` : '',
    wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${icon('whatsapp')} <span>WhatsApp</span></a>` : '',
  ].filter(Boolean).join('');
  document.getElementById('provider-head').innerHTML = `
    <h1>${esc(p.businessName)}</h1>
    ${p.isVerified ? `<span class="badge badge--verified">${icon('check')} Vérifié</span>` : ''}
    ${where ? `<p class="provider-head__meta">${where}</p>` : ''}
    <p class="provider-head__rating">${note}</p>
    ${contacts ? `<p class="provider-head__contacts">${contacts}</p>` : ''}`;
}

function renderServices(p) {
  document.getElementById('services-wrap').hidden = p.services.length === 0;
  document.getElementById('services-empty').hidden = p.services.length > 0;
  document.getElementById('services-body').innerHTML = p.services.map(s => `
    <tr>
      <td><span class="price-table__label">${esc(s.label)}</span>
        ${s.description ? `<br><span class="muted">${esc(s.description)}</span>` : ''}</td>
      <td class="price-table__price">${formatFCFA(s.price)}</td>
    </tr>`).join('');
}

function renderAbout(p) {
  document.getElementById('about-text').textContent = p.description || 'Présentation en cours de rédaction.';
}

function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  list.innerHTML = reviews.length
    ? reviews.map(v => `
      <article class="review">
        <div class="review__head">
          <span class="review__author">${esc(v.clientName || 'Client·e Eventis')}</span>
          ${renderStars(v.rating)}
        </div>
        <p>${esc(v.comment)}</p>
        <p class="review__date">${formatDateFR(v.createdAt)}</p>
      </article>`).join('')
    : '<p class="muted">Aucun avis pour le moment.</p>';
}

// --- Formulaire de devis / encart connexion ------------------------------------
function quoteFormHTML(today) {
  const options = EVENT_TYPES
    .map(t => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
  return `
    <form id="quote-form" class="quote-form">
      <h2>Demander un devis</h2>
      <div class="field">
        <label for="q-event-type">Type d’événement</label>
        <select id="q-event-type" name="eventType" required>
          <option value="" selected disabled>Sélectionnez un type d’événement</option>${options}
        </select>
      </div>
      <div class="field">
        <label for="q-event-date">Date de l’événement</label>
        <input id="q-event-date" name="eventDate" type="date" min="${today}" required>
        <p class="error" id="q-event-date-error" hidden></p>
      </div>
      <div class="field">
        <label for="q-guests">Nombre d’invités</label>
        <input id="q-guests" name="guests" type="number" min="1" step="1" inputmode="numeric"
          placeholder="Ex. 150" autocomplete="off">
      </div>
      <div class="field">
        <label for="q-budget">Budget estimé (FCFA)</label>
        <input id="q-budget" name="budget" type="number" min="0" step="5000" inputmode="numeric"
          placeholder="Ex. 500 000" autocomplete="off">
      </div>
      <div class="field">
        <label for="q-message">Votre message</label>
        <textarea id="q-message" name="message" rows="5" minlength="10" maxlength="1000" required
          placeholder="Décrivez votre événement : lieu, horaires, prestations souhaitées…"></textarea>
        <p class="error" id="q-message-error" hidden></p>
      </div>
      <button class="btn btn--primary btn--block" type="submit">Envoyer ma demande</button>
      <p class="muted quote-form__hint">Le prestataire vous répondra directement sur Eventis.</p>
    </form>`;
}

function loginBoxHTML(next, businessName) {
  return `
    <div class="quote-form quote-login">
      <h2>Demander un devis</h2>
      <p><strong>Connectez-vous pour contacter ce prestataire.</strong></p>
      <p class="muted">Envoyez votre demande et échangez directement avec ${esc(businessName)}.</p>
      <a class="btn btn--primary btn--block" href="/auth/connexion.html?next=${next}">Se connecter</a>
      <a class="btn btn--outline btn--block" href="/auth/inscription.html?next=${next}">Créer un compte</a>
    </div>`;
}

function bindQuoteForm(user) {
  const form = document.getElementById('quote-form');
  const today = todayISO();
  form.eventDate.min = today; // recalage si la page reste ouverte au-delà de minuit
  const dateInput = form.querySelector('#q-event-date');
  const dateError = form.querySelector('#q-event-date-error');
  const msgInput = form.querySelector('#q-message');
  const msgError = form.querySelector('#q-message-error');
  dateInput.addEventListener('input', () => { dateError.hidden = true; });
  msgInput.addEventListener('input', () => { msgError.hidden = true; });

  const fail = (input, errorEl, message) => {
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.focus();
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    // 1. Validations HTML5 : required, min, step, minlength/maxlength.
    if (!form.checkValidity()) { form.reportValidity(); return; }
    // 2. Contrôles JS : date ≥ aujourd’hui, message 10–1000 caractères.
    if (dateInput.value < today) {
      return fail(dateInput, dateError, 'La date de l’événement ne peut pas être dans le passé.');
    }
    const message = msgInput.value.trim();
    if (message.length < 10 || message.length > 1000) {
      return fail(msgInput, msgError, 'Votre message doit contenir entre 10 et 1000 caractères.');
    }
    const guestsRaw = form.guests.value.trim();
    const guests = guestsRaw === '' ? null : Math.trunc(Number(guestsRaw));
    const budgetRaw = form.budget.value.trim();
    const budget = budgetRaw === '' ? null : Math.trunc(Number(budgetRaw));

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await db.createRequest({
        clientId: user.id,
        providerId: provider.id,
        eventType: form.eventType.value,
        eventDate: dateInput.value,
        guests,
        budget,
        message,
      });
      toast('Votre demande a été envoyée.');
      location.assign('/compte/demandes.html');
    } catch (err) {
      toast(err.message || 'Une erreur est survenue. Veuillez réessayer.', 'error');
      submitBtn.disabled = false;
    }
  });
}

function renderQuote(p, user) {
  const slot = document.getElementById('quote-slot');
  if (user) {
    slot.innerHTML = quoteFormHTML(todayISO());
    bindQuoteForm(user);
  } else {
    // Lien de retour vers cette fiche après connexion (même construction que guards.js).
    const next = encodeURIComponent(location.pathname + location.search);
    slot.innerHTML = loginBoxHTML(next, p.businessName);
  }
}

// --- Rendu ---------------------------------------------------------------------
if (provider) {
  document.title = `${provider.businessName} — Eventis`;
  renderGallery(provider);
  renderHead(provider);
  renderServices(provider);
  renderAbout(provider);
  const reviews = await db.listReviewsForProvider(provider.id);
  renderReviews(reviews);
  renderQuote(provider, auth.current());
  initReveal();
}
