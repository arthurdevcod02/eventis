// oauth.js — helpers de la connexion Google. Fonctions pures : le stockage et
// l'origine sont passés en argument, donc le contrat se vérifie sous Node
// (tests/oauth.test.js) sans navigateur ni instance Supabase.
// Ces helpers ne font que préparer l'appel : la session Google elle-même exige un
// projet Supabase avec le fournisseur activé (voir README, « Configuration Google »).

export const OAUTH_INTENT_KEY = 'eventis_oauth_intent';
export const OAUTH_RETURN_PATH = '/auth/connexion.html';

// Seuls ces deux rôles sont attribuables depuis l'interface. Un compte Google n'est
// jamais administrateur : la liste l'interdit côté client, et le serveur aussi
// (politique « profiles self insert » + déclencheur profiles_guard_privileges de rls.sql).
const ROLES_INSCRIPABLES = ['client', 'prestataire'];

export const DEMO_OAUTH_MESSAGE =
  'Connexion Google indisponible en mode démonstration : elle exige un projet Supabase '
  + 'avec le fournisseur Google activé. Utilisez les comptes de démonstration.';

// L'URL de retour est déduite de l'origine courante : identique en local
// (http://localhost:4173) et en production (domaine réel), sans configuration dans le code.
export function redirectUrl(origin) {
  return String(origin).replace(/\/+$/, '') + OAUTH_RETURN_PATH;
}

// Cible après connexion : uniquement un chemin interne. Une URL absolue ou
// protocole-relative (« //evil.tld ») serait une redirection ouverte.
export function safeNext(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('..')) return null;
  return value;
}

// Le trajet aller-retour Google réécrit l'URL de la page : le rôle pré-coché et la
// page demandée sont donc consignés ici avant de partir, puis relus au retour.
export function writeIntent(storage, { role, next } = {}) {
  const intent = {
    role: ROLES_INSCRIPABLES.includes(role) ? role : null,
    next: safeNext(next),
  };
  try { storage.setItem(OAUTH_INTENT_KEY, JSON.stringify(intent)); }
  catch { /* stockage refusé : le retour prendra la home du rôle */ }
  return intent;
}

export function readIntent(storage) {
  let raw = null;
  try { raw = storage.getItem(OAUTH_INTENT_KEY); } catch { /* stockage refusé */ }
  if (!raw) return { role: null, next: null };
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { return { role: null, next: null }; }
  if (!parsed || typeof parsed !== 'object') return { role: null, next: null };
  // Le contenu relu est re-validé, jamais cru : il vient du stockage du navigateur.
  return {
    role: ROLES_INSCRIPABLES.includes(parsed.role) ? parsed.role : null,
    next: safeNext(parsed.next),
  };
}

export function hasIntent(storage) {
  try { return storage.getItem(OAUTH_INTENT_KEY) !== null; } catch { return false; }
}

export function clearIntent(storage) {
  try { storage.removeItem(OAUTH_INTENT_KEY); } catch { /* stockage refusé */ }
}

// Traduit les réponses connues de Supabase en consignes françaises actionnables.
// Les libellés exacts de Supabase ne peuvent pas être vérifiés sans instance réelle :
// tout ce qui n'est pas reconnu est affiché tel quel, sans promesse de diagnostic.
export function oauthErrorFR(error, origin) {
  const raw = typeof error === 'string' ? error : (error && error.message) || '';
  const url = redirectUrl(origin);
  if (!raw) {
    return 'La connexion Google est indisponible pour le moment. Réessayez, ou utilisez votre e-mail et votre mot de passe.';
  }
  if (/redirect/i.test(raw)) {
    return `L’URL de retour a été refusée par Supabase. Ajoutez ${url} dans Authentication → URL Configuration → Redirect URLs du projet.`;
  }
  if (/unknown provider|not enabled|not configured|not supported|(provider.{0,40}(disabled|not found))/i.test(raw)) {
    return 'Le fournisseur Google n’est pas activé sur le projet Supabase. Ouvrez Authentication → Sign In / Providers → Google, activez-le, puis renseignez le Client ID et le Client secret du client OAuth Google.';
  }
  if (/failed to fetch|fetch failed|networkerror|load failed|network error|timed out|timeout/i.test(raw)) {
    return `Impossible de joindre Supabase depuis ce navigateur. Vérifiez votre connexion et l’URL du projet dans assets/js/core/config.js (retour attendu : ${url}).`;
  }
  return `La connexion Google a échoué : ${raw}`;
}
