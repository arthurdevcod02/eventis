// footer.js — pied de page : marque, navigation, contact, rappel mode démo.
import { isDemoMode } from '../core/config.js';
import { icon } from '../core/ui.js';
import { mountInstallPrompt } from './install-prompt.js';

const CONTACT = [
  { iconName: 'mail', label: 'nandjanakpane@gmail.com', href: 'mailto:nandjanakpane@gmail.com' },
  { iconName: 'phone', label: '+228 93 83 85 93', href: 'tel:+22893838593' },
  { iconName: 'whatsapp', label: 'WhatsApp +228 93 83 85 93', href: 'https://wa.me/22893838593' },
];

// Enregistrement du service worker (portée « / », cache statique uniquement).
// L'enregistrement lui-même reste sans interface : il ne promet rien à l'utilisateur,
// seulement un journal de refus pour le débogage. Ce qui se voit — l'invitation à
// installer — est décidé ailleurs, dans install-prompt.js, qui ne s'appuie que sur les
// événements réels du navigateur et ne promet toujours pas le hors ligne.
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
  // Le service worker est enregistré sur toutes les pages via ce pied de page ;
  // l'invitation à installer y est branchée au même endroit pour hériter de la
  // même couverture, sans retoucher les vingt-huit pages HTML.
  mountInstallPrompt();
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
        <!-- Ces coordonnées sont réelles dans les deux modes : elles ont donc le droit
             d'être cliquables, y compris en démonstration. -->
        <ul>
          ${CONTACT.map(c => `<li><a href="${c.href}">${icon(c.iconName)} ${c.label}</a></li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="container footer__bottom">
      <p>© 2026 Eventis — L'excellence événementielle, connectée et sécurisée.</p>
      <nav class="footer__legal" aria-label="Documents légaux">
        <a href="/cgu.html">Conditions d'utilisation</a>
        <a href="/confidentialite.html">Confidentialité</a>
        <a href="/mentions-legales.html">Mentions légales</a>
      </nav>
    </div>`;
}
