// footer.js — pied de page : marque, navigation, contact, rappel mode démo.
import { isDemoMode } from '../core/config.js';
import { icon } from '../core/ui.js';

const CONTACT = [
  { iconName: 'mail', label: 'contact@eventis.tg', href: 'mailto:contact@eventis.tg' },
  { iconName: 'phone', label: '+228 70 00 00 00', href: 'tel:+22870000000' },
  { iconName: 'whatsapp', label: 'WhatsApp +228 70 00 00 00', href: 'https://wa.me/22870000000' },
];

// Enregistrement du service worker (portée « / », cache statique uniquement).
// Volontairement sans interface : aucune promesse d'« installation » ni de « hors ligne »
// n'est affichée à l'utilisateur, seulement un journal de refus pour le débogage.
let swRegistrationStarted = false;

function registerServiceWorker() {
  if (swRegistrationStarted) return;
  const isSecure = location.protocol === 'https:';
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !(isSecure || isLocal)) {
    console.info('[Eventis] Service worker non enregistré : contexte non sécurisé ou API indisponible.');
    return;
  }
  swRegistrationStarted = true;
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.info('[Eventis] Enregistrement du service worker refusé :', error && error.message ? error.message : error);
  });
}

export function mountFooter() {
  registerServiceWorker();
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  const demo = isDemoMode();
  footer.classList.add('footer');
  footer.innerHTML = `
    <div class="container footer__cols">
      <div>
        <p class="footer__brand">Eventis<span>.</span></p>
        <p class="muted">L'excellence événementielle, connectée et sécurisée.</p>
        ${demo ? '<p class="footer__demo">Mode démonstration — données fictives, aucune donnée réelle n\'est enregistrée.</p>' : ''}
      </div>
      <nav aria-label="Navigation pied de page">
        <h2>Navigation</h2>
        <ul>
          <li><a href="/">Accueil</a></li>
          <li><a href="/catalogue.html">Catalogue</a></li>
          <li><a href="/comment-ca-marche.html">Comment ça marche</a></li>
          <li><a href="/contact.html">Contact</a></li>
        </ul>
      </nav>
      <div>
        <h2>Contact</h2>
        <ul>
          ${CONTACT.map(c => `<li>${demo
            ? `<span class="muted">${icon(c.iconName)} ${c.label}</span>`
            : `<a href="${c.href}">${icon(c.iconName)} ${c.label}</a>`}</li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="container footer__bottom">
      <p>© 2026 Eventis — L'excellence événementielle, connectée et sécurisée.</p>
      <a href="/mentions-legales.html">Mentions légales</a>
    </div>`;
}
