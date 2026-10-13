// Page « Profil public » prestataire Eventis — formulaire de la fiche (nom,
// catégorie, description, coordonnées, fourchette de prix, photo de couverture)
// + aperçu « ce que voit le client » rendu par providerCardHTML (R7).
// Sauvegarde via db.updateProvider (clés éditables limitées par db).
import { auth } from '../core/auth.js';
import { db } from '../core/db.js';
import { isDemoMode } from '../core/config.js';
import { requireAuth } from '../core/guards.js';
import { providerCardHTML, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';

const user = requireAuth(['prestataire']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  init().catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

let providerId = null;
let provider = null;   // fiche chargée (null si en attente d'approbation)
let categories = [];
const $ = id => document.getElementById(id);

function fillCategories() {
  const select = $('f-category');
  select.innerHTML = '<option value="" disabled>Choisissez une catégorie</option>'
    + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (provider?.categoryId) select.value = provider.categoryId;
}

function fillForm() {
  if (!provider) return;
  $('f-business-name').value = provider.businessName ?? '';
  $('f-description').value = provider.description ?? '';
  $('f-city').value = provider.city ?? '';
  $('f-quarter').value = provider.quarter ?? '';
  $('f-phone').value = provider.phone ?? '';
  $('f-whatsapp').value = provider.whatsapp ?? '';
  $('f-price-from').value = String(provider.priceFrom ?? 0);
  $('f-price-to').value = String(provider.priceTo ?? 0);
  $('f-cover-url').value = provider.coverUrl ?? '';
}

// Prix : vide → 0 ; sinon entier ≥ 0, sinon null (invalide).
function parsePrice(input) {
  const raw = input.value.trim();
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function currentPatch() {
  return {
    businessName: $('f-business-name').value.trim(),
    categoryId: $('f-category').value,
    description: $('f-description').value.trim(),
    city: $('f-city').value.trim(),
    quarter: $('f-quarter').value.trim(),
    phone: $('f-phone').value.trim(),
    whatsapp: $('f-whatsapp').value.trim(),
    priceFrom: parsePrice($('f-price-from')),
    priceTo: parsePrice($('f-price-to')),
    coverUrl: $('f-cover-url').value.trim(),
  };
}

// --- Aperçu « ce que voit le client » (R7 : providerCardHTML + styles home.css) --
function renderPreview() {
  const slot = $('preview-slot');
  if (!provider) {
    slot.innerHTML = '<p class="muted">L’aperçu sera disponible après approbation de votre fiche.</p>';
    return;
  }
  const p = currentPatch();
  const categoryName = categories.find(c => c.id === p.categoryId)?.name ?? '';
  slot.innerHTML = `<div class="provider-grid">${providerCardHTML({
    id: providerId,
    businessName: p.businessName,
    categoryName,
    quarter: p.quarter,
    priceFrom: Number.isInteger(p.priceFrom) ? p.priceFrom : 0,
    coverUrl: p.coverUrl,
    isVerified: provider.isVerified,
    avgRating: provider.avgRating,
    reviewsCount: provider.reviewsCount,
  })}</div>`;
}

async function init() {
  providerId = await auth.getProviderIdFor(user.id);
  if (!providerId) {
    $('preview-slot').innerHTML = '<p class="muted">Aucune fiche prestataire n\'est associée à votre compte.</p>';
    return;
  }
  const [cats] = await Promise.all([db.listCategories()]);
  categories = cats;
  try { provider = await db.getProvider(providerId); } catch { /* fiche non visible (pending) */ }
  fillCategories();
  fillForm();
  renderPreview();

  // Mention honnête en mode démo : pas d'upload inerte sans explication.
  $('cover-hint').hidden = !isDemoMode();

  const form = $('provider-form');
  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const priceFrom = parsePrice($('f-price-from'));
    const priceTo = parsePrice($('f-price-to'));
    if (priceFrom === null || priceTo === null) {
      toast('Les prix doivent être des nombres entiers supérieurs ou égaux à 0.', 'error');
      (priceFrom === null ? $('f-price-from') : $('f-price-to')).focus();
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await db.updateProvider(providerId, { ...currentPatch(), priceFrom, priceTo });
      toast(isDemoMode() ? 'Fiche mise à jour (mode démo).' : 'Fiche mise à jour.', 'success');
    } catch (err) {
      toast(err?.message || 'Mise à jour impossible, veuillez réessayer.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
