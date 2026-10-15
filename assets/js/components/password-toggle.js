// password-toggle.js — boutons « œil » des champs mot de passe (partagés par
// connexion.html et inscription.html). Bascule le type du champ et tient à jour
// aria-pressed + aria-label ; l'icône est injectée ici, les pages ne posent que
// le bouton <button class="pw-toggle" data-target="id-du-champ">.
import { icon } from '../core/ui.js';

export function mountPasswordToggles(root = document) {
  root.querySelectorAll('.pw-toggle').forEach(btn => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    btn.innerHTML = icon('eye');
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eye-off' : 'eye');
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    });
  });
}
