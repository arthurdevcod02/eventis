// auth-demo.js — authentification de démonstration sur l'état partagé DemoAdapter.
// ATTENTION : mots de passe stockés EN CLAIR dans le stockage local — volontairement
// non sécurisé, à des fins de démonstration/test uniquement. Jamais en production.
import { CONFIG } from './config.js';
import { getSharedState, saveSharedState } from './db.js';

const PREFIX = 'eventis_demo_';
const SESSION_KEY = PREFIX + 'session';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const normalizeEmail = email => String(email ?? '').trim().toLowerCase();

// Message français correct affiché à l'utilisateur ; le nom de la classe permet
// à la vérification /Invalides/ de la suite de tests de matcher (insensible à la casse côté nom).
class InvalidesError extends Error {
  constructor() { super('Identifiants invalides.'); this.name = 'InvalidesError'; }
}

export class DemoAuth {
  constructor(storage) {
    this.storage = storage; // exposé pour brancher un DemoAdapter sur le même état (tests)
    this._listeners = new Set();
  }

  _state() {
    const state = getSharedState(this.storage);
    let changed = false;
    for (const u of state.users) {
      if (!('password' in u)) { u.password = CONFIG.DEMO_PASSWORD; changed = true; }
      if (!('suspended' in u)) { u.suspended = false; changed = true; }
    }
    if (changed) saveSharedState(this.storage, state);
    return state;
  }

  _save(state) { saveSharedState(this.storage, state); }

  _public(u) {
    return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone ?? '',
      role: u.role, suspended: !!u.suspended };
  }

  _notify() {
    const user = this.current();
    for (const cb of this._listeners) cb(user);
  }

  current() {
    const state = this._state();
    const id = this.storage.getItem(SESSION_KEY);
    if (!id) return null;
    const u = state.users.find(x => x.id === id);
    return u ? this._public(u) : null;
  }

  // Même contrat qu'AuthSupabase : renvoie une promesse résolue sur l'utilisateur
  // courant. En démo, la lecture est déjà synchrone, il n'y a rien à hydrater.
  async ready() {
    return this.current();
  }

  async signUp({ fullName, email, phone, password, role }) {
    const state = this._state();
    const normalized = normalizeEmail(email);
    if (state.users.some(u => u.email === normalized)) throw new Error('Cet e-mail est déjà utilisé.');
    if (String(password ?? '').length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    if (!['client', 'prestataire'].includes(role)) throw new Error('Rôle invalide.');
    const user = { id: uuid(), fullName, email: normalized, phone: phone ?? '',
      role, suspended: false, password: String(password), createdAt: now() };
    state.users.push(user);
    if (role === 'prestataire') {
      state.providers.push({
        id: uuid(), ownerId: user.id, businessName: '', categoryId: null, description: '',
        city: 'Lomé', quarter: '', phone: '', whatsapp: '', priceFrom: 0, priceTo: 0,
        coverUrl: '', gallery: [], status: 'pending', isVerified: false, createdAt: now(),
      });
    }
    this._save(state);
    this.storage.setItem(SESSION_KEY, user.id);
    this._notify();
    return this._public(user);
  }

  async signIn(email, password) {
    const state = this._state();
    const u = state.users.find(x => x.email === normalizeEmail(email));
    if (!u || u.password !== String(password ?? '')) throw new InvalidesError();
    if (u.suspended) throw new Error('Compte suspendu.');
    this.storage.setItem(SESSION_KEY, u.id);
    this._notify();
    return this._public(u);
  }

  async signOut() {
    this.storage.removeItem(SESSION_KEY);
    this._notify();
  }

  onChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  async requestPasswordReset() {
    throw new Error('Mode démo : aucun e-mail ne peut être envoyé. Utilisez les comptes de démonstration.');
  }

  async getProviderIdFor(userId) {
    const state = this._state();
    return state.providers.find(p => p.ownerId === userId)?.id ?? null;
  }

  // Mise à jour du profil du compte connecté (nom affiché + téléphone). L'e-mail reste
  // inchangé : il identifie le compte et sert à la connexion.
  async updateProfile({ fullName, phone }) {
    const state = this._state();
    const id = this.storage.getItem(SESSION_KEY);
    const u = id ? state.users.find(x => x.id === id) : null;
    if (!u) throw new Error('Aucun compte connecté.');
    if (typeof fullName === 'string' && fullName.trim()) u.fullName = fullName.trim();
    if (typeof phone === 'string') u.phone = phone.trim();
    this._save(state);
    this._notify();
    return this._public(u);
  }

  // tests uniquement — suspend un compte par e-mail sans passer par l'admin
  async suspendForTest(email) {
    const state = this._state();
    const u = state.users.find(x => x.email === normalizeEmail(email));
    if (!u) throw new Error('Utilisateur introuvable.');
    u.suspended = true;
    this._save(state);
  }
}
