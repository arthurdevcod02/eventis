// auth-messages.js — ce que lit un visiteur quand l’authentification répond mal.
// Fonctions pures : aucun réseau, aucun DOM, donc le contrat se vérifie sous Node
// (tests/auth.test.js). Les libellés bruts de GoTrue/PostgREST ne sont pas stables :
// tout ce qui n’est pas reconnu est renvoyé tel quel plutôt que masqué derrière un
// message générique qui ferait perdre l’information.

export const RECOVERY_RETURN_PATH = '/auth/reinitialisation.html';
export const CONFIRM_RETURN_PATH = '/auth/connexion.html';

// Le lien d’e-mail doit atterrir sur une page qui sait quoi en faire. Une « Redirect URL »
// absente de la liste du projet est silencieusement ignorée par GoTrue, qui renvoie alors
// sur le Site URL — d’où l’écran de connexion affiché à la place du formulaire attendu.
export function recoveryUrl(origin) {
  return String(origin).replace(/\/+$/, '') + RECOVERY_RETURN_PATH;
}

// Un lien d’e-mail (confirmation d’inscription ou réinitialisation) arrive avec « ?code= »
// depuis que supabase-js échange ce code (flux PKCE) ; l’ancien flux implicite passait par
// « #access_token=…&type=recovery ». Dans les deux cas, le paramètre dit une chose que
// rien d’autre ne peut dire : la page a été atteinte par un lien, pas par un clic.
export function hasAuthReturnCode({ search = '', hash = '' } = {}) {
  if (new URLSearchParams(search).has('code')) return true;
  return /(?:^|&)type=(?:recovery|signup|email_change|invite)(?:&|$)/.test(String(hash).replace(/^#/, ''));
}

// Mot de passe du nouveau compte ou compte réinitialisé : mêmes règles que l’inscription,
// pour qu’un utilisateur ne découvre pas une contrainte différente au deuxième formulaire.
export function validateNewPassword(password, password2) {
  if (String(password).length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (password !== password2) return 'Les mots de passe ne correspondent pas.';
  return '';
}

export function confirmEmailMessage(email) {
  return `Un e-mail de confirmation vient d’être envoyé à ${email}. Ouvrez-le et cliquez son lien pour activer votre compte.`;
}

// Correspondances ordonnées : la première gagnante s’applique, donc les cas les plus
// précis (celui qui dit exactement quoi faire) viennent avant les généralistes.
const AUTH_ERROR_FR = [
  [/error sending recovery email/i,
    'L’e-mail de réinitialisation n’a pas pu être envoyé par le serveur. Réessayez dans quelques minutes ; si cela persiste, la passerelle d’e-mail du projet est en cause.'],
  [/over_email_send_rate_limit|too many requests|rate limit/i,
    'Trop de demandes d’e-mail ont été envoyées récemment. Attendez une heure avant de réessayer.'],
  [/email not confirmed/i,
    'Votre adresse e-mail n’a pas encore été confirmée. Ouvrez le message reçu, cliquez son lien, puis reconnectez-vous.'],
  [/invalid login credentials|bad login/i,
    'E-mail ou mot de passe incorrect.'],
  [/could not find a user|for this login/i,
    'Aucun compte Eventis n’est associé à cette adresse e-mail.'],
  [/already registered|already exists/i,
    'Cet e-mail est déjà utilisé.'],
  [/password should be at least|too short|weak password/i,
    'Le mot de passe est trop court : choisissez-en un d’au moins 8 caractères.'],
  [/email address is invalid/i,
    'Cette adresse e-mail est refusée par le serveur. Vérifiez sa saisie, ou employez une autre adresse.'],
  [/expired|invalid (one-time )?token|invalid code|invalid otp/i,
    'Ce lien n’est plus valide : il a expiré ou a déjà servi. Relancez l’opération depuis le début.'],
  [/json object requested|multiple \(or no\) rows returned|row-level security|insecure/i,
    'Le serveur a refusé la lecture de votre compte. Revenez à la page de connexion et réessayez.'],
  [/failed to fetch|fetch failed|networkerror|network error|load failed|timed out|timeout/i,
    'Impossible de joindre le serveur Eventis. Vérifiez votre connexion, puis réessayez.'],
];

// Le corps d’erreur vide (« {} ») est le pire cas : il affirme qu’il y a un problème
// sans en dire un mot. Il mérite sa propre phrase, et surtout pas un « {} » à l’écran.
export function authErrorFR(error) {
  const raw = typeof error === 'string' ? error : ((error && error.message) || '');
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '{}') {
    return 'L’opération a échoué sans que le serveur précise pourquoi. Réessayez, ou utilisez votre e-mail et votre mot de passe.';
  }
  const hit = AUTH_ERROR_FR.find(([pattern]) => pattern.test(trimmed));
  return hit ? hit[1] : trimmed;
}
