import { auth } from './auth.js';

export const HOME_FOR = { client: '/compte/', prestataire: '/espace-prestataire/', admin: '/admin/' };

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
