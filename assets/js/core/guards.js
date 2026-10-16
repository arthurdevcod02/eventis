import { auth } from './auth.js';

export const HOME_FOR = { client: '/compte/', prestataire: '/espace-prestataire/', admin: '/admin/' };

// Cible d'une déconnexion : l'accueil, quelle que soit la page d'où l'on part.
// Jamais HOME_FOR — la session vient de disparaître et la garde renverrait de là.
// Jamais /auth/connexion.html non plus : cela présupposerait une envie de se
// reconnecter, alors que « Se connecter » est déjà un clic plus loin dans la barre.
// null = on y est déjà, une navigation ne ferait que recharger la page.
export function signOutTarget(pathname) {
  return pathname === '/' ? null : '/';
}

export function requireAuth(roles = []) {
  const user = auth.current();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/auth/connexion.html?next=${next}`);
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    location.replace(HOME_FOR[user.role] ?? '/');
    return null;
  }
  return user;
}

// Garde des pages protégées. En mode réel, la session n'est pas lisible de façon
// synchrone : requireAuth appelé seul recevrait null avant l'hydratation et
// enverrait un visiteur connecté sur la page de connexion. Cette version attend
// l'hydratation du cache (auth.ready()) puis applique la même barre.
// Une hydratation qui échoue (réseau, projet injoignable) = aucune session
// connue = redirection de connexion, jamais un rendu « connecté » par défaut.
export async function ensureAuth(roles = []) {
  try {
    await auth.ready();
  } catch {
    /* session indéterminable : requireAuth redirectionne */
  }
  return requireAuth(roles);
}
