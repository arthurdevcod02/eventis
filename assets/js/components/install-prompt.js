// install-prompt.js — invitation à installer Eventis : une bannière basse, non bloquante,
// qui ne s'affiche que là où l'installation est réellement possible.
//
// Trois chemins, et un seul « chemin aucun » :
//   native  — le navigateur fournit beforeinstallprompt : le bouton déclenche l'invite réelle.
//   ios     — Safari iOS/iPadOS n'a pas cette API : le bouton ouvre les étapes exactes.
//   manual  — Firefox de bureau installe depuis son propre menu : idem, des étapes.
//   none    — aucun chemin vérifiable (Chrome sans critère atteint, Safari macOS) : rien.
// Rien n'est jamais présenté comme installé tant que le navigateur ne l'a pas annoncé.
import { icon, toast } from '../core/ui.js';

// Un horodatage, rien d'autre. Aucun jeton, aucun e-mail, aucune donnée de compte :
// le stockage de la bannière n'a pas à savoir qui visite.
const LATER_KEY = 'eventis_install_later_at';
const DONE_KEY = 'eventis_installed_at';
const SHOWN_KEY = 'eventis_install_pages_shown'; // sessionStorage : invitations dessinées
const PAGES_KEY = 'eventis_visit_pages';         // sessionStorage : compteur de pages vues
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const DWELL_MS = 15000;
const MAX_PAR_VISITE = 2; // deux pages au plus, puis le silence jusqu'à la visite suivante

// Pages de passage : l'invitation n'y a rien à promettre et gênerait un parcours
// déjà court (connexion, inscription, récupération) ou l'administration.
const EXCLUDED = [/^\/admin/, /^\/auth/];

let started = false;
let deferred = null; // l'événement gardé jusqu'au clic : sans lui, pas d'invite native
let pendingShow = null; // attente du chemin natif : posée par mountInstallPrompt

// Écouté dès l'import du module : « beforeinstallprompt » n'est émis qu'une fois par
// document, parfois avant que le pied de page ne se monte. Le manquer nous laisserait
// croire qu'aucune installation native n'est possible.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // sinon le navigateur garde l'invite pour lui et la retire
    deferred = event;
    // Le visiteur attend peut-être quinze secondes : l'arrivée de l'invite native
    // vaut mieux que le minute, sinon le chemin « native » passerait à la trappe.
    if (pendingShow) pendingShow();
  });

  window.addEventListener('appinstalled', () => {
    write(DONE_KEY);
    sessionStorageRemove(SHOWN_KEY);
    removeBanner();
    toast('Eventis est installé sur ton appareil.', 'success');
  });
}

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; /* stockage privé indisponible */ }
}

function write(key) {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* invitation muette, site intact */ }
}

function sessionStorageGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function sessionStorageSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* compteur de visite perdu */ }
}

function sessionStorageRemove(key) {
  try { sessionStorage.removeItem(key); } catch { /* rien à retirer */ }
}

// Le navigateur a-t-il déjà ouvert Eventis dans sa propre fenêtre ?
function isStandalone() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return window.navigator.standalone === true; // seul indicateur exposé par Safari iOS
}

function isIOS() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se fait passer pour un Mac : la surface tactile est le seul signe.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function installPath() {
  if (typeof navigator === 'undefined') return 'none';
  if (isStandalone()) return 'none';
  if (deferred) return 'native';
  if (isIOS()) return 'ios';
  if (/Firefox\//.test(navigator.userAgent) && !/Android|iOS|iPhone|iPad/.test(navigator.userAgent)) {
    return 'manual';
  }
  return 'none';
}

const GUIDES = {
  ios: {
    intro: 'Sur iPhone ou iPad, l’ajout se fait depuis Safari :',
    steps: [
      'Touche le bouton Partager (le carré avec une flèche vers le haut, sous Safari).',
      'Choisis « Sur l’écran d’accueil ».',
      'Valide avec « Ajouter ».',
    ],
  },
  manual: {
    intro: 'Depuis le menu de ton navigateur :',
    steps: [
      'Ouvre le menu du navigateur (les trois points ou le tiret du site).',
      'Choisis l’entrée d’installation de l’application — l’intitulé exact varie selon la version.',
      'Confirme : Eventis apparaît dans tes applications.',
    ],
  },
};

// Ce que l'installation apporte, et ce qu'elle n'apporte pas. La seconde phrase est la
// plus importante : Eventis lit ses données sur le serveur, l'icône ne crée pas un mode
// hors ligne.
const CAVEAT = 'L’installation ajoute une icône et une fenêtre dédiée. Elle ne rend pas '
  + 'les données consultables hors connexion : Eventis a besoin de réseau pour afficher '
  + 'les prestataires, les demandes et les messages.';

function bannerHTML(path) {
  const guide = GUIDES[path];
  const opensGuide = path !== 'native';
  return `
  <button type="button" class="install-banner__close" aria-label="Fermer l’invitation à installer Eventis">${icon('close')}</button>
  <div class="install-banner__row">
    <img class="install-banner__logo" src="/assets/icons/icon-192.png" alt="" width="48" height="48">
    <div class="install-banner__text">
      <p class="install-banner__title">Emportez Eventis partout avec vous</p>
      <p class="install-banner__desc">Retrouvez vos prestataires événementiels et préparez vos événements plus facilement depuis votre écran d’accueil.</p>
    </div>
    <div class="install-banner__actions">
      <button type="button" class="btn btn--primary btn--sm install-banner__go"
        ${opensGuide ? 'aria-expanded="false" aria-controls="install-guide"' : ''}>Installer Eventis</button>
      <button type="button" class="btn btn--ghost btn--sm install-banner__later">Plus tard</button>
    </div>
  </div>
  ${guide ? `<div class="install-banner__guide" id="install-guide" hidden>
      <p class="install-banner__intro">${guide.intro}</p>
      <ol class="install-banner__steps">${guide.steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <p class="install-banner__caveat">${CAVEAT}</p>
    </div>` : `<p class="install-banner__caveat install-banner__caveat--inline">${CAVEAT}</p>`}`;
}

let node = null;

function setState(state) {
  if (state) document.body.dataset.install = state;
  else delete document.body.dataset.install;
}

function removeBanner() {
  if (!node) return;
  node.remove();
  node = null;
  setState(null);
}

// Le repli quand l'invite native échoue ou n'existe pas : des étapes, jamais un message
// qui laisserait croire que l'installation vient de se faire.
function showGuide(path) {
  const guide = node && node.querySelector('.install-banner__guide');
  const go = node && node.querySelector('.install-banner__go');
  if (!guide) return false;
  guide.removeAttribute('hidden');
  setState('guide');
  if (go) go.setAttribute('aria-expanded', 'true');
  const first = guide.querySelector('li');
  if (first) { first.setAttribute('tabindex', '-1'); first.focus(); }
  if (path !== 'ios') {
    toast('L’invite du navigateur n’est pas disponible ici — voici les étapes.', 'info');
  }
  return true;
}

async function tryNativeInstall() {
  const event = deferred;
  if (!event) return 'noguard';
  deferred = null;
  try {
    await event.prompt();
  } catch {
    return 'failed'; // prompt() refusé : on ne dit rien de réussi
  }
  if (!event.userChoice) return 'unknown';
  let choice = null;
  try { choice = await event.userChoice; } catch { return 'unknown'; }
  return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
}

function bind(path) {
  const go = node.querySelector('.install-banner__go');
  const later = node.querySelector('.install-banner__later');
  const close = node.querySelector('.install-banner__close');

  go.addEventListener('click', async () => {
    if (path === 'native') {
      const outcome = await tryNativeInstall();
      if (outcome === 'accepted') {
        // Le navigateur n'a pas encore annoncé l'installation : on retire la bannière sans
        // rien revendiquer, et « appinstalled » écrira la mémoire s'il arrive.
        removeBanner();
        toast('Suis les indications de ton navigateur pour terminer l’installation.', 'info');
        return;
      }
      if (outcome === 'dismissed') { write(LATER_KEY); removeBanner(); return; }
      if (outcome === 'failed' || outcome === 'unknown' || outcome === 'noguard') {
        removeBanner();
        toast('L’installation n’a pas abouti. Elle reste possible depuis le menu du navigateur.', 'info');
        return;
      }
      return;
    }
    if (!showGuide(path)) {
      removeBanner();
      toast('Installation impossible depuis ce navigateur.', 'info');
    }
  });

  const dismiss = () => { write(LATER_KEY); removeBanner(); };
  later.addEventListener('click', dismiss);
  close.addEventListener('click', dismiss);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismiss();
  });
}

function render(path) {
  node = document.createElement('aside');
  node.className = 'install-banner';
  node.setAttribute('role', 'region');
  node.setAttribute('aria-label', 'Installer Eventis sur ton appareil');
  node.innerHTML = bannerHTML(path);
  document.body.appendChild(node);
  setState('banner');
  // Le marqueur de visite est un COMPTEUR, pas un booléen : une page qui redirige
  // immédiatement (fiche introuvable, session expirée) ne doit pas consommer
  // l'invitation sans que le visiteur l'ait vue. Deux pages, puis silence.
  sessionStorageSet(SHOWN_KEY, String(Number(sessionStorageGet(SHOWN_KEY) || '0') + 1));
  bind(path);
}

export function mountInstallPrompt() {
  if (started || typeof document === 'undefined') return;
  started = true;
  if (EXCLUDED.some(rx => rx.test(location.pathname))) return;
  if (read(DONE_KEY)) return;
  if (Number(sessionStorageGet(SHOWN_KEY) || '0') >= MAX_PAR_VISITE) return;
  const later = Number(read(LATER_KEY));
  if (later && Date.now() - later < COOLDOWN_MS) return;

  const seen = Number(sessionStorageGet(PAGES_KEY) || '0') + 1;
  sessionStorageSet(PAGES_KEY, String(seen));
  // « Un moment pertinent » : soit le visiteur a déjà vu une autre page, soit il vient
  // d'y passer quinze secondes. Jamais au premier chargement d'un inconnu.
  // Le chemin est calculé à l'affichage, pas ici : « beforeinstallprompt » arrive souvent
  // après le montage du module, et le figer trop tôt condamnerait le chemin natif à
  // rester invisible sur un navigateur qui sait pourtant installer.
  const show = () => {
    if (node) return;
    const path = installPath();
    if (path === 'none') return;
    pendingShow = null;
    render(path);
  };
  // Le chemin est calculé à l'affichage, et « pendingShow » ne reste en éveil que quand
  // le visiteur a déjà vu une page : l'arrivée tardive de l'invite native ne doit pas
  // court-circuiter le délai de quinze secondes du premier chargement.
  if (seen >= 2) { pendingShow = show; show(); }
  else window.setTimeout(show, DWELL_MS);
}
