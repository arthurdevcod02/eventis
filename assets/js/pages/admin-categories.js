// Page administration des catégories Eventis — table (nom, identifiant, icône,
// état) + ajout et renommage en modale, activation/désactivation en un clic.
// db.saveCategory ne validant rien côté base (pas d'unicité de slug), TOUTE la
// validation est faite ici et affichée en ligne : aucun doublon silencieux.
import { db } from '../core/db.js';
import { requireAuth } from '../core/guards.js';
import { esc, icon, toast } from '../core/ui.js';
import { mountNavbar } from '../components/navbar.js';
import { mountFooter } from '../components/footer.js';
import { openModal, confirmModal } from '../components/modal.js';

const user = requireAuth(['admin']);
// user === null → requireAuth a déjà redirigé (location.replace) : on arrête tout ici.
if (user) {
  mountNavbar();
  mountFooter();
  document.getElementById('add-category').addEventListener('click', () => showFormModal(null));
  init().catch(err => {
    toast(err?.message || 'Chargement impossible, veuillez réessayer.', 'error');
  });
}

// Les seules clés du registre d'icônes (ui.js) : icon() lève sur une clé inconnue,
// donc le menu n'offre QUE celles-ci (aucune icône inventée).
const ICONS = [
  ['fork', 'Couverts — restauration'], ['flower', 'Fleur — décoration'], ['camera', 'Appareil photo'],
  ['music', 'Note de musique'], ['building', 'Bâtiment — salle'], ['chair', 'Chaise'],
  ['rings', 'Alliances'], ['mic', 'Micro'], ['check', 'Coche'], ['star', 'Étoile'],
  ['star-half', 'Demi-étoile'], ['search', 'Loupe'], ['menu', 'Menu (trois barres)'],
  ['close', 'Croix'], ['arrow-right', 'Flèche'], ['mail', 'Enveloppe'], ['phone', 'Téléphone'],
  ['whatsapp', 'Bulle WhatsApp'], ['eye', 'Œil'], ['eye-off', 'Œil barré'],
];
const ICON_IDS = new Set(ICONS.map(([id]) => id));
const ICON_LABEL = id => ICONS.find(([k]) => k === id)?.[1] ?? 'Icône indisponible';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 60;

let categories = [];

// icon() lève sur une clé inconnue : toute icône venant de la base est ramenée à
// une clé du registre avant rendu (une donnée inattendue ne doit pas planter la page).
const safeIcon = key => icon(ICON_IDS.has(key) ? key : 'star');

// Nom → identifiant : minuscules, accents supprimés, espaces et signes → tirets.
// NFD sépare l'accent de la lettre, \p{Diacritic} le retire (Unicode : pas de
// plage de codes en dur dans la source).
function slugify(name) {
  return String(name).normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rowHTML(c) {
  const glyph = safeIcon(c.icon);
  return `
    <tr>
      <th scope="row" class="cell-title">${esc(c.name)}</th>
      <td><code>${esc(c.slug)}</code></td>
      <td><span class="cat-icon"><span class="cat-icon__glyph" aria-hidden="true">${glyph}</span>${esc(ICON_LABEL(c.icon))}</span></td>
      <td>${c.active
        ? '<span class="badge badge--accepted">Active</span>'
        : '<span class="badge badge--closed">Désactivée</span>'}</td>
      <td><div class="table__actions">
        <button type="button" class="btn btn--outline" data-action="edit" data-id="${esc(c.id)}">Renommer</button>
        <button type="button" class="btn btn--${c.active ? 'outline' : 'primary'}" data-action="toggle" data-id="${esc(c.id)}">
          ${c.active ? 'Désactiver' : 'Activer'}
        </button>
      </div></td>
    </tr>`;
}

function render() {
  const activeCount = categories.filter(c => c.active).length;
  document.getElementById('categories-admin').innerHTML = `
    <p class="admin-results" role="status">${categories.length} catégorie${categories.length > 1 ? 's' : ''} · ${activeCount} active${activeCount > 1 ? 's' : ''}</p>
    ${categories.length ? `
    <div class="table-wrap" role="region" aria-label="Liste des catégories" tabindex="0">
      <table class="table">
        <caption class="table__caption">${categories.length} catégorie${categories.length > 1 ? 's' : ''} — l’identifiant sert d’URL et de clé interne</caption>
        <thead>
          <tr>
            <th scope="col">Nom</th><th scope="col">Identifiant</th><th scope="col">Icône</th>
            <th scope="col">État</th><th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>${categories.map(rowHTML).join('')}</tbody>
      </table>
    </div>` : `<div class="empty">${icon('search')}<p>Aucune catégorie : le catalogue public n’a plus de filtre.</p></div>`}
    <p class="admin-note">Une catégorie désactivée disparaît du filtre du catalogue public ; les fiches déjà publiées qui y appartiennent restent visibles.</p>`;

  const byId = new Map(categories.map(c => [c.id, c]));
  document.querySelectorAll('[data-action]').forEach(el =>
    el.addEventListener('click', () => {
      const c = byId.get(el.dataset.id);
      if (el.dataset.action === 'edit') showFormModal(c);
      else toggleActive(c);
    }));
}

async function reload(refocusId = null) {
  categories = await db.listCategoriesAdmin();
  render();
  const row = refocusId && document.querySelector(`[data-id="${CSS.escape(refocusId)}"]`);
  (row ?? document.getElementById('add-category'))?.focus?.({ preventScroll: true });
}

// --- Formulaire (ajout et renommage partagent la même modale) ----------------
function formHTML(prefix, c) {
  const current = c ?? { name: '', slug: '', icon: 'star' };
  // Clé réellement sélectionnée = clé de la base si elle est au registre, sinon
  // 'star' : le select et l'aperçu restent cohérents (aucune icône inventée).
  const iconKey = ICON_IDS.has(current.icon) ? current.icon : 'star';
  return `
    <form id="${prefix}-form" class="cat-form">
      <div class="field">
        <label for="${prefix}-name">Nom de la catégorie</label>
        <input id="${prefix}-name" type="text" maxlength="${MAX_NAME}" placeholder="Ex. Décoration"
          value="${esc(current.name)}" aria-describedby="${prefix}-name-error">
        <p class="error" id="${prefix}-name-error" hidden></p>
      </div>
      <div class="field">
        <label for="${prefix}-slug">Identifiant (slug)</label>
        <input id="${prefix}-slug" type="text" maxlength="${MAX_NAME}" placeholder="Ex. decoration"
          value="${esc(current.slug)}" aria-describedby="${prefix}-slug-hint ${prefix}-slug-error">
        <p class="slug-hint" id="${prefix}-slug-hint">Généré depuis le nom : minuscules, sans accents, séparé de tirets. Modifiable.</p>
        <p class="error" id="${prefix}-slug-error" hidden></p>
      </div>
      <div class="field">
        <label for="${prefix}-icon">Icône</label>
        <div class="cat-form__preview">
          <select id="${prefix}-icon" aria-describedby="${prefix}-icon-error">${ICONS.map(([id, label]) =>
            `<option value="${esc(id)}"${id === iconKey ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>
          <span class="cat-icon__glyph" id="${prefix}-icon-preview" aria-hidden="true">${safeIcon(iconKey)}</span>
        </div>
        <p class="error" id="${prefix}-icon-error" hidden></p>
      </div>
      <div class="request-detail__actions">
        <button type="submit" class="btn btn--primary">${c ? 'Enregistrer' : 'Ajouter la catégorie'}</button>
        <button type="button" class="btn btn--outline" data-cancel>Annuler</button>
      </div>
    </form>`;
}

function showFormModal(c) {
  const prefix = c ? 'edit' : 'add';
  openModal(c ? 'Renommer une catégorie' : 'Ajouter une catégorie', formHTML(prefix, c), (overlay, close) => {
    const nameInput = overlay.querySelector(`#${prefix}-name`);
    const slugInput = overlay.querySelector(`#${prefix}-slug`);
    const iconSelect = overlay.querySelector(`#${prefix}-icon`);
    const preview = overlay.querySelector(`#${prefix}-icon-preview`);
    // En création le slug suit le nom ; en renommage il reste volontairement stable
    // (les fiches référencent l'identifiant interne, pas le slug).
    let slugTouched = !!c;

    nameInput.addEventListener('input', () => {
      if (!slugTouched) slugInput.value = slugify(nameInput.value);
    });
    slugInput.addEventListener('input', () => { slugTouched = true; });
    iconSelect.addEventListener('change', () => {
      // Clé forcément connue (liste fermée) : icon() ne peut pas lever ici.
      preview.innerHTML = icon(iconSelect.value);
    });

    overlay.querySelector(`#${prefix}-form`).addEventListener('submit', async e => {
      e.preventDefault();
      const values = readForm(overlay, prefix, c?.id ?? null);
      if (!values) return;
      const btn = overlay.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await db.saveCategory(c ? { id: c.id, ...values, active: c.active } : { ...values, active: true });
        close();
        toast(c ? `Catégorie renommée en « ${values.name} ».` : `Catégorie « ${values.name} » ajoutée et active.`, 'success');
        await reload(c?.id ?? null);
      } catch (err) {
        toast(err?.message || 'Enregistrement impossible, veuillez réessayer.', 'error');
        btn.disabled = false;
      }
    });
  });
}

// Validation UI : nom, format du slug, unicité (la base ne vérifie rien), icône
// du registre. Messages en ligne sous le champ concerné.
function readForm(scope, prefix, currentId) {
  const name = scope.querySelector(`#${prefix}-name`).value.trim();
  const slug = scope.querySelector(`#${prefix}-slug`).value.trim().toLowerCase();
  const iconId = scope.querySelector(`#${prefix}-icon`).value;
  let ok = true;
  const fail = (field, message) => {
    const err = scope.querySelector(`#${prefix}-${field}-error`);
    err.textContent = message;
    err.hidden = false;
    ok = false;
  };
  if (!name) fail('name', 'Le nom de la catégorie est requis.');
  else if (name.length > MAX_NAME) fail('name', `Le nom ne peut pas dépasser ${MAX_NAME} caractères.`);
  if (!slug) fail('slug', 'L’identifiant est requis : il est généré depuis le nom.');
  else if (!SLUG_RE.test(slug)) {
    fail('slug', 'Identifiant invalide : lettres minuscules, chiffres et tirets, sans tiret en début ni en fin.');
  } else if (categories.some(c => c.slug === slug && c.id !== currentId)) {
    fail('slug', 'Cet identifiant est déjà utilisé par une autre catégorie : choisissez-en un autre.');
  }
  if (!ICON_IDS.has(iconId)) fail('icon', 'Choisissez une icône disponible dans la liste.');
  return ok ? { name, slug, icon: iconId } : null;
}

// Activer / désactiver : action immédiatement réversible, sans modale
// (le badge d'état de la ligne est la confirmation visuelle, plus le toast).
async function toggleActive(c) {
  if (!c) return;
  const next = !c.active;
  try {
    await db.saveCategory({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, active: next });
    toast(next
      ? `Catégorie « ${c.name} » réactivée : elle réapparaît dans le filtre du catalogue.`
      : `Catégorie « ${c.name} » désactivée : elle disparaît du filtre du catalogue.`, 'success');
    await reload(c.id);
  } catch (err) {
    toast(err?.message || 'Action impossible, veuillez réessayer.', 'error');
  }
}

async function init() {
  await reload();
}
