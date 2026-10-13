// footer.js — pied de page : marque, navigation, contact, rappel mode démo.
import { isDemoMode } from '../core/config.js';
import { icon } from '../core/ui.js';

const CONTACT = [
  { iconName: 'mail', label: 'contact@eventis.tg', href: 'mailto:contact@eventis.tg' },
  { iconName: 'phone', label: '+228 70 00 00 00', href: 'tel:+22870000000' },
  { iconName: 'whatsapp', label: 'WhatsApp +228 70 00 00 00', href: 'https://wa.me/22870000000' },
];

export function mountFooter() {
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
