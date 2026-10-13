// navbar.js — bannière mode démo + navigation sticky + bascule de thème + compte.
import { isDemoMode } from '../core/config.js';
import { auth } from '../core/auth.js';
import { HOME_FOR } from '../core/guards.js';
import { icon, esc, toast } from '../core/ui.js';

const NAV_LINKS = [
  { id: 'accueil', label: 'Accueil', href: '/' },
  { id: 'catalogue', label: 'Catalogue', href: '/catalogue.html' },
  { id: 'guide', label: 'Comment ça marche', href: '/comment-ca-marche.html' },
  { id: 'contact', label: 'Contact', href: '/contact.html' },
];

const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SUN = `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON = `<svg ${SVG_ATTRS}><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>`;

const themeIcon = () => (document.documentElement.dataset.theme === 'dark' ? SUN : MOON);

function applyTheme(mode) {
  if (mode) document.documentElement.dataset.theme = mode;
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('eventis_theme', mode); } catch { /* stockage indisponible */ }
}

function linksHTML(current) {
  return NAV_LINKS.map(l =>
    `<li><a href="${l.href}"${l.id === current ? ' aria-current="page"' : ''}>${l.label}</a></li>`).join('');
}

function authBlockHTML(user) {
  if (!user) {
    return '<a class="btn btn--ghost btn--sm" href="/auth/connexion.html">Se connecter</a>'
      + '<a class="btn btn--primary btn--sm" href="/auth/inscription.html">Devenir prestataire</a>';
  }
  const home = HOME_FOR[user.role] ?? '/';
  return `<div class="nav__account">
      <button type="button" class="nav__account-btn" aria-haspopup="true" aria-expanded="false">${esc(user.fullName)}</button>
      <div class="nav__menu" hidden>
        <a href="${home}">Mon espace</a>
        <button type="button" data-signout>Déconnexion</button>
      </div>
    </div>`;
}

export function mountNavbar(active = '') {
  const header = document.getElementById('site-header');
  if (!header) return;

  let onDocClick = null; // évite l'empilement des écouteurs document entre re-rendus

  const render = () => {
    const user = auth.current();
    header.innerHTML = `
      ${isDemoMode() ? '<div class="demo-banner"><strong>Mode démonstration</strong> — données fictives, aucune donnée réelle n\'est enregistrée.</div>' : ''}
      <nav class="nav" aria-label="Navigation principale">
        <div class="container nav__inner">
          <a class="nav__logo" href="/">Eventis<span>.</span></a>
          <ul class="nav__links">${linksHTML(active)}</ul>
          <div class="nav__actions">
            <button type="button" class="nav__theme" aria-label="Basculer le thème clair ou sombre">${themeIcon()}</button>
            ${authBlockHTML(user)}
            <button type="button" class="nav__burger" aria-label="Ouvrir le menu" aria-expanded="false">${icon('menu')}</button>
          </div>
        </div>
      </nav>
      <div class="nav__mobile" hidden>
        <div class="nav__mobile-top">
          <a class="nav__logo" href="/">Eventis<span>.</span></a>
          <button type="button" class="nav__theme" aria-label="Basculer le thème clair ou sombre">${themeIcon()}</button>
          <button type="button" class="nav__burger-close nav__close" aria-label="Fermer le menu">${icon('close')}</button>
        </div>
        <ul class="nav__mobile-links">${linksHTML(active)}</ul>
        <div class="nav__mobile-actions">${authBlockHTML(user)}</div>
      </div>`;
    bind(user);
  };

  const bind = () => {
    const themeBtns = header.querySelectorAll('.nav__theme');
    themeBtns.forEach(btn => btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? '' : 'dark';
      applyTheme(next);
      themeBtns.forEach(b => { b.innerHTML = themeIcon(); });
    }));

    header.querySelectorAll('[data-signout]').forEach(btn =>
      btn.addEventListener('click', async () => {
        await auth.signOut();
        toast('Vous êtes déconnecté·e.', 'success');
      }));

    // Menu compte (bureau)
    const accountBtn = header.querySelector('.nav__account-btn');
    const menu = header.querySelector('.nav__menu');
    if (accountBtn && menu) {
      accountBtn.addEventListener('click', () => {
        const open = menu.hasAttribute('hidden');
        if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
        accountBtn.setAttribute('aria-expanded', String(open));
      });
      if (onDocClick) document.removeEventListener('click', onDocClick);
      onDocClick = e => {
        if (!menu.hasAttribute('hidden') && !menu.contains(e.target) && !accountBtn.contains(e.target)) {
          menu.setAttribute('hidden', '');
          accountBtn.setAttribute('aria-expanded', 'false');
        }
      };
      document.addEventListener('click', onDocClick);
    }

    // Menu mobile plein écran
    const burger = header.querySelector('.nav__burger');
    const panel = header.querySelector('.nav__mobile');
    const closeBtn = header.querySelector('.nav__burger-close');
    const closePanel = () => {
      panel.setAttribute('hidden', '');
      burger?.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey);
    };
    const onKey = e => { if (e.key === 'Escape') closePanel(); };
    if (burger && panel) {
      burger.addEventListener('click', () => {
        panel.removeAttribute('hidden');
        burger.setAttribute('aria-expanded', 'true');
        document.addEventListener('keydown', onKey);
        closeBtn?.focus();
      });
      closeBtn?.addEventListener('click', closePanel);
      panel.querySelectorAll('a').forEach(a => a.addEventListener('click', closePanel));
    }
  };

  render();
  auth.onChange(render);
}
