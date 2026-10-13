import { isDemoMode, CONFIG } from './config.js';
import { DemoAuth } from './auth-demo.js';
import { db } from './db.js';
// AuthSupabase chargé dynamiquement uniquement en mode réel
export function createAuth() {
  if (isDemoMode()) return new DemoAuth(globalThis.localStorage);
  const { AuthSupabase } = window.EventisAuthSupabase; // défini par auth-supabase.js (script classique)
  return new AuthSupabase(CONFIG, db);
}
export const auth = createAuth();
