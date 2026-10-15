// google-button.js — bouton « Continuer avec Google », partagé par les pages
// connexion et inscription. En mode réel, il enregistre l'intention (rôle pré-coché,
// page demandée) puis ouvre l'écran de consentement Google sur Supabase. En mode
// démonstration, aucun fournisseur externe n'est branché : le clic l'explique.
import { auth } from '../core/auth.js';
import { isDemoMode } from '../core/config.js';
import {
  DEMO_OAUTH_MESSAGE, hasIntent, oauthErrorFR, readIntent, redirectUrl, safeNext, writeIntent,
} from '../core/oauth.js';

// Le rôle choisi sur le formulaire d'inscription ne fait que pré-sélectionner l'écran
// de retour : aucune ligne « profiles » n'est écrite sans confirmation explicite.
function selectedRole(sourceForm) {
  if (!sourceForm) return null;
  return sourceForm.querySelector('input[name="role"]:checked')?.value ?? null;
}

export function mountGoogleButton({ sourceForm = null, onError = () => {} } = {}) {
  const button = document.querySelector('[data-google]');
  if (!button) return null;
  const note = document.querySelector('[data-google-note]');
  if (note) note.hidden = !isDemoMode();
  // Le rappel sur la reprise du rôle n'a de sens qu'en mode réel.
  const roleNote = document.querySelector('[data-google-role]');
  if (roleNote) roleNote.hidden = isDemoMode();

  button.addEventListener('click', async () => {
    if (isDemoMode()) { onError(DEMO_OAUTH_MESSAGE); return; }
    button.disabled = true;
    try {
      const next = safeNext(new URLSearchParams(location.search).get('next'));
      writeIntent(window.sessionStorage, { role: selectedRole(sourceForm), next });
      const url = await auth.signInWithGoogle({ redirectTo: redirectUrl(location.origin) });
      // On ne quitte la page qu'à partir d'ici : une réponse erronée de Supabase
      // reste lisible sur place au lieu de disparaître avec la navigation.
      location.assign(url);
    } catch (error) {
      onError(oauthErrorFR(error, location.origin));
      button.disabled = false;
    }
  });

  return button;
}

// Au retour de Google, sur la page de connexion. Trois issues :
//  - « signed »  : le compte avait déjà un profil, on reprend la page demandée ;
//  - « pending » : compte tout juste créé par Google, le rôle reste à choisir ;
//  - « none »    : visiteur ordinaire, le formulaire e-mail lui est laissé.
// « none » couvre aussi l'absence d'intention : un compte déjà connecté qui ouvre
// cette page n'est pas redirigé, il garde le choix de changer de compte.
export async function resolveOAuthReturn() {
  if (isDemoMode() || !hasIntent(window.sessionStorage)) return { kind: 'none' };
  const intent = readIntent(window.sessionStorage);
  await auth.ready();
  const user = auth.current();
  if (user) return { kind: 'signed', user, next: intent.next };
  const pending = await auth.pendingSignup();
  if (pending) return { kind: 'pending', pending, next: intent.next, role: intent.role };
  return { kind: 'none' };
}
