export const CONFIG = {
  SUPABASE_URL: '',        // ex. 'https://xyz.supabase.co' — vide = mode démo
  SUPABASE_ANON_KEY: '',   // clé anonyme (public) — jamais la clé service
  APP_NAME: 'Eventis',
  DEMO_PASSWORD: 'demo1234',
};

export function isDemoMode() {
  return !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
}
