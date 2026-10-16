// db.js — interface de données unique. Deux adaptateurs : démo (stockage local) et Supabase.
import { isDemoMode, CONFIG } from './config.js';
import { seedState, SEED_REVIEWS } from './seed.js';

// Les avis du seed sont des données historiques importées ; la règle
// « un seul avis par demande » s'applique aux avis déposés via la plateforme
// (sans cette exclusion, la création du 1er avis sur r1 serait rejetée car
// le seed contient déjà v1 pour r1 — cf. tests db « avis »).
const SEED_REVIEW_IDS = new Set(SEED_REVIEWS.map(v => v.id));

const PREFIX = 'eventis_demo_';
const STATE_KEY = PREFIX + 'state';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// État partagé (démo) — utilisé par DemoAdapter ET DemoAuth (même stockage).
// ---------------------------------------------------------------------------
export function getSharedState(storage) {
  const raw = storage.getItem(STATE_KEY);
  if (raw) return JSON.parse(raw);
  const state = seedState();
  storage.setItem(STATE_KEY, JSON.stringify(state));
  return state;
}

export function saveSharedState(storage, state) {
  storage.setItem(STATE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// DemoAdapter — toutes les données dans le stockage injecté (localStorage démo).
// Chaque méthode recharge l'état, le modifie, le réécrit.
// ---------------------------------------------------------------------------
const EDITABLE_PROVIDER_KEYS = ['businessName', 'categoryId', 'description', 'city', 'quarter',
  'phone', 'whatsapp', 'priceFrom', 'priceTo', 'coverUrl', 'gallery'];

export class DemoAdapter {
  constructor(storage) {
    this.storage = storage; // accès paresseux : rien n'est lu tant qu'une méthode n'est appelée
  }

  _load() { return getSharedState(this.storage); }
  _save(state) { saveSharedState(this.storage, state); }

  _user(state, id) { return state.users.find(u => u.id === id); }
  _provider(state, id) { return state.providers.find(p => p.id === id); }
  _ownerSuspended(state, provider) {
    const owner = this._user(state, provider.ownerId);
    return !!owner?.suspended;
  }
  _ratings(state, providerId) {
    const visible = state.reviews.filter(v => v.providerId === providerId && v.visible);
    const count = visible.length;
    const avg = count ? visible.reduce((s, v) => s + v.rating, 0) / count : 0;
    return { avgRating: Math.round(avg * 10) / 10, reviewsCount: count };
  }
  _publicProvider(state, p) {
    const cat = state.categories.find(c => c.id === p.categoryId);
    const { avgRating, reviewsCount } = this._ratings(state, p.id);
    const pub = {};
    for (const k of ['id', 'businessName', 'categoryId', 'city', 'quarter', 'phone', 'whatsapp',
      'priceFrom', 'priceTo', 'coverUrl', 'isVerified', 'status', 'createdAt']) pub[k] = p[k];
    pub.categoryName = cat ? cat.name : '';
    pub.avgRating = avgRating;
    pub.reviewsCount = reviewsCount;
    return pub;
  }

  // --- Catalogue public ----------------------------------------------------
  async listCategories() {
    const state = this._load();
    return state.categories.filter(c => c.active !== false)
      .map(({ id, slug, name, icon, active }) => ({ id, slug, name, icon, active: active !== false }));
  }

  async listProviders(f = {}) {
    const state = this._load();
    let list = state.providers
      .filter(p => p.status === 'approved' && !this._ownerSuspended(state, p))
      .map(p => this._publicProvider(state, p));
    if (f.category) list = list.filter(p => p.categoryId === f.category);
    if (f.quarter) {
      const q = String(f.quarter).trim().toLowerCase();
      list = list.filter(p => (p.quarter || '').toLowerCase().includes(q));
    }
    if (f.q) {
      const q = String(f.q).trim().toLowerCase();
      list = list.filter(p => (p.businessName + ' ' + (p.description || '')).toLowerCase().includes(q));
    }
    if (f.verifiedOnly) list = list.filter(p => p.isVerified);
    if (f.priceMax != null) list = list.filter(p => p.priceFrom <= f.priceMax);
    if (f.minRating != null) list = list.filter(p => p.avgRating >= f.minRating);
    const byRatingDesc = (a, b) => b.avgRating - a.avgRating || b.createdAt.localeCompare(a.createdAt);
    switch (f.sort) {
      case 'note': list.sort(byRatingDesc); break;
      case 'prix-asc': list.sort((a, b) => a.priceFrom - b.priceFrom); break;
      case 'prix-desc': list.sort((a, b) => b.priceFrom - a.priceFrom); break;
      case 'pertinence':
      default:
        list.sort((a, b) => Number(b.isVerified) - Number(a.isVerified) || byRatingDesc(a, b));
    }
    return list;
  }

  async getProvider(id) {
    const state = this._load();
    const p = this._provider(state, id);
    if (!p || p.status !== 'approved' || this._ownerSuspended(state, p)) {
      throw new Error('Prestataire introuvable.');
    }
    return {
      ...this._publicProvider(state, p),
      description: p.description,
      gallery: Array.isArray(p.gallery) ? [...p.gallery] : [],
      services: state.services
        .filter(s => s.providerId === id)
        .sort((a, b) => a.price - b.price)
        .map(({ id: sid, label, description, price }) => ({ id: sid, label, description, price })),
    };
  }

  // --- Prestataire (propriétaire) ------------------------------------------
  async createProvider(profileId, data) {
    const state = this._load();
    const provider = {
      id: uuid(), ownerId: profileId, gallery: [], status: 'pending', isVerified: false,
      description: '', city: 'Lomé', quarter: '', phone: '', whatsapp: '',
      priceFrom: 0, priceTo: 0, coverUrl: '', createdAt: now(), ...data,
    };
    state.providers.push(provider);
    this._save(state);
    return { ...provider };
  }

  async updateProvider(id, patch) {
    const state = this._load();
    const p = this._provider(state, id);
    if (!p) throw new Error('Prestataire introuvable.');
    for (const k of EDITABLE_PROVIDER_KEYS) if (k in patch) p[k] = patch[k];
    this._save(state);
    return { ...p };
  }

  async saveServices(providerId, services) {
    const state = this._load();
    if (!this._provider(state, providerId)) throw new Error('Prestataire introuvable.');
    state.services = state.services.filter(s => s.providerId !== providerId);
    for (const s of services) {
      state.services.push({ id: s.id ?? uuid(), providerId, label: s.label, description: s.description ?? '', price: s.price });
    }
    this._save(state);
    return state.services.filter(s => s.providerId === providerId)
      .map(({ id, label, description, price }) => ({ id, label, description, price }));
  }

  // --- Demandes & messagerie ------------------------------------------------
  async createRequest({ clientId, providerId, eventType, eventDate, guests, budget, message }) {
    const state = this._load();
    const provider = this._provider(state, providerId);
    if (!provider || provider.status !== 'approved') throw new Error('Prestataire introuvable.');
    if (!message || !String(message).trim()) throw new Error('Le message est obligatoire.');
    const request = {
      id: uuid(), clientId, providerId, eventType, eventDate: eventDate ?? null,
      guests: guests ?? null, budget: budget ?? null, message: String(message),
      status: 'sent', createdAt: now(), updatedAt: now(),
    };
    state.requests.push(request);
    this._save(state);
    return { ...request };
  }

  async getRequest(id) {
    const state = this._load();
    const r = state.requests.find(x => x.id === id);
    if (!r) throw new Error('Demande introuvable.');
    const client = this._user(state, r.clientId);
    const provider = this._provider(state, r.providerId);
    return { ...r, client: { id: r.clientId, fullName: client?.fullName ?? '' },
      provider: { id: r.providerId, businessName: provider?.businessName ?? '' } };
  }

  async listRequestsForClient(clientId) {
    const state = this._load();
    return state.requests.filter(r => r.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({ ...r }));
  }

  async listRequestsForProvider(providerId) {
    const state = this._load();
    return state.requests.filter(r => r.providerId === providerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({ ...r }));
  }

  async updateRequestStatus(id, { status, byRole }) {
    const state = this._load();
    const r = state.requests.find(x => x.id === id);
    if (!r) throw new Error('Demande introuvable.');
    const allowed = byRole === 'prestataire'
      ? ['in_progress', 'accepted', 'declined', 'closed'].includes(status)
          && ['sent', 'in_progress'].includes(r.status)
      : byRole === 'client'
        ? status === 'closed' && r.status === 'accepted'
        : false;
    if (!allowed) throw new Error('Transition non autorisée.');
    if (status === 'declined') {
      const provider = this._provider(state, r.providerId);
      const hasMessage = state.messages.some(m => m.requestId === id && m.senderId === provider?.ownerId);
      if (!hasMessage) throw new Error('Un message du prestataire est requis avant de refuser.');
    }
    r.status = status;
    r.updatedAt = now();
    this._save(state);
    return { ...r };
  }

  async listMessages(requestId) {
    const state = this._load();
    return state.messages.filter(m => m.requestId === requestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ id, requestId: rid, senderId, body, readAt, createdAt }) => ({ id, requestId: rid, senderId, body, readAt, createdAt }));
  }

  async sendMessage({ requestId, senderId, body }) {
    const state = this._load();
    const r = state.requests.find(x => x.id === requestId);
    if (!r) throw new Error('Demande introuvable.');
    const provider = this._provider(state, r.providerId);
    const isParty = senderId === r.clientId || senderId === provider?.ownerId;
    if (!isParty) throw new Error('Non autorisé.');
    if (!body || !String(body).trim()) throw new Error('Le message ne peut pas être vide.');
    const message = { id: uuid(), requestId, senderId, body: String(body), readAt: null, createdAt: now() };
    state.messages.push(message);
    if (r.status === 'sent') { r.status = 'in_progress'; r.updatedAt = now(); }
    this._save(state);
    return { ...message };
  }

  async markRequestRead(requestId, readerId) {
    const state = this._load();
    const t = now();
    for (const m of state.messages) {
      if (m.requestId === requestId && m.senderId !== readerId && !m.readAt) m.readAt = t;
    }
    this._save(state);
  }

  async listThreadsFor(userId) {
    const state = this._load();
    const ownedProviderIds = new Set(
      state.providers.filter(p => p.ownerId === userId).map(p => p.id));
    const requests = state.requests.filter(r => r.clientId === userId || ownedProviderIds.has(r.providerId));
    return requests.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(r => {
      const provider = this._provider(state, r.providerId);
      const client = this._user(state, r.clientId);
      const messages = state.messages.filter(m => m.requestId === r.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = messages[messages.length - 1];
      const isClientSide = r.clientId === userId;
      return {
        request: { ...r },
        counterparty: isClientSide
          ? { name: provider?.businessName ?? '', role: 'prestataire' }
          : { name: client?.fullName ?? '', role: 'client' },
        lastMessage: last
          ? { ...last }
          : { id: null, requestId: r.id, senderId: r.clientId, body: r.message, readAt: null, createdAt: r.createdAt },
        unreadCount: messages.filter(m => m.senderId !== userId && !m.readAt).length,
      };
    });
  }

  // --- Avis ------------------------------------------------------------------
  async createReview({ requestId, clientId, rating, comment }) {
    const state = this._load();
    const r = state.requests.find(x => x.id === requestId);
    if (!r || r.status !== 'closed' || r.clientId !== clientId) {
      throw new Error('Impossible de déposer un avis sur cette demande.');
    }
    if (state.reviews.some(v => v.requestId === requestId && !SEED_REVIEW_IDS.has(v.id))) {
      throw new Error('Un avis existe déjà pour cette demande.');
    }
    const review = {
      id: uuid(), requestId, clientId, providerId: r.providerId,
      rating, comment: comment ?? '', visible: false, createdAt: now(),
    };
    state.reviews.push(review);
    this._save(state);
    return { ...review };
  }

  async setReviewVisible(id, visible) {
    const state = this._load();
    const v = state.reviews.find(x => x.id === id);
    if (!v) throw new Error('Avis introuvable.');
    v.visible = !!visible;
    this._save(state);
    return { ...v };
  }

  async listReviewsForProvider(providerId) {
    const state = this._load();
    return state.reviews
      .filter(v => v.providerId === providerId && v.visible)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      // Auteur jamais nommé sur la voie publique : la voie réelle ne peut plus le
      // lire (politique de lecture des profils), la démo montre la même chose.
      .map(v => ({ id: v.id, rating: v.rating, comment: v.comment,
        clientName: '', createdAt: v.createdAt }));
  }

  // « Mes avis » (espace client, R22) : l'AUTEUR voit ses avis, y compris non
  // publiés — c'est la seule raison d'être de cette section et la raison pour
  // laquelle elle n'existe pas côté listReviewsForProvider (avis visibles seuls).
  async listReviewsForClient(clientId) {
    const state = this._load();
    return state.reviews
      .filter(v => v.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(v => ({ id: v.id, requestId: v.requestId ?? null, providerId: v.providerId,
        rating: v.rating, comment: v.comment, visible: !!v.visible, createdAt: v.createdAt,
        providerName: this._provider(state, v.providerId)?.businessName ?? '' }));
  }

  // File de modération admin : TOUS les avis (publiés et non publiés), les
  // non publiés en tête puis createdAt décroissant — la file à traiter arrive
  // donc en premier sans filtrage côté UI.
  async listReviewsAdmin() {
    const state = this._load();
    return state.reviews
      .map(v => ({ id: v.id, requestId: v.requestId ?? null, clientId: v.clientId,
        providerId: v.providerId, rating: v.rating, comment: v.comment,
        visible: !!v.visible, createdAt: v.createdAt,
        clientName: this._user(state, v.clientId)?.fullName ?? '',
        providerName: this._provider(state, v.providerId)?.businessName ?? '' }))
      .sort((a, b) => Number(a.visible) - Number(b.visible)
        || b.createdAt.localeCompare(a.createdAt));
  }

  // --- Administration --------------------------------------------------------
  async listProvidersAdmin({ status } = {}) {
    const state = this._load();
    return state.providers
      .filter(p => !status || p.status === status)
      .map(p => {
        const owner = this._user(state, p.ownerId);
        const pub = this._publicProvider(state, p);
        // ownerSuspended (R18) : listProviders/getProvider masquent aussi un
        // prestataire dont le gérant est suspendu — la page admin a besoin du
        // drapeau pour ne proposer aucun lien public trompeur.
        return { ...pub, description: p.description,
          ownerSuspended: this._ownerSuspended(state, p),
          owner: { fullName: owner?.fullName ?? '', email: owner?.email ?? '' } };
      });
  }

  async setProviderStatus(id, status) {
    const state = this._load();
    const p = this._provider(state, id);
    if (!p) throw new Error('Prestataire introuvable.');
    if (!['pending', 'approved', 'suspended'].includes(status)) throw new Error('Statut invalide.');
    p.status = status;
    this._save(state);
    return { ...p };
  }

  async setProviderVerified(id, isVerified) {
    const state = this._load();
    const p = this._provider(state, id);
    if (!p) throw new Error('Prestataire introuvable.');
    p.isVerified = !!isVerified;
    this._save(state);
    return { ...p };
  }

  async listUsersAdmin() {
    const state = this._load();
    return state.users
      .map(u => ({ id: u.id, fullName: u.fullName, email: u.email, phone: u.phone ?? '',
        role: u.role, suspended: !!u.suspended, createdAt: u.createdAt }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async setUserSuspended(id, suspended) {
    const state = this._load();
    const u = this._user(state, id);
    if (!u) throw new Error('Utilisateur introuvable.');
    // Un compte administrateur ne peut pas être suspendu (protège l'admin démo d'une auto-suspension).
    if (u.role === 'admin' && suspended) throw new Error('Un administrateur ne peut pas être suspendu.');
    u.suspended = !!suspended;
    this._save(state);
    return { ...u };
  }

  async listCategoriesAdmin() {
    const state = this._load();
    return state.categories.map(c => ({ ...c, active: c.active !== false }));
  }

  async saveCategory({ id, slug, name, icon, active }) {
    const state = this._load();
    if (id) {
      const c = state.categories.find(x => x.id === id);
      if (!c) throw new Error('Catégorie introuvable.');
      Object.assign(c, { slug, name, icon, active: active !== false });
      this._save(state);
      return { ...c };
    }
    const cat = { id: 'cat-' + slug, slug, name, icon: icon ?? 'star', active: active !== false };
    state.categories.push(cat);
    this._save(state);
    return { ...cat };
  }

  async getStats() {
    const state = this._load();
    const dayMs = 86400000;
    const today = new Date();
    const dayKey = d => d.toISOString().slice(0, 10);
    const signupsSeries = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      const key = dayKey(d);
      signupsSeries.push({ date: key,
        count: state.users.filter(u => dayKey(new Date(u.createdAt)) === key).length });
    }
    const monthAgo = new Date(today.getTime() - 30 * dayMs).toISOString();
    return {
      providersActive: state.providers.filter(p => p.status === 'approved' && !this._ownerSuspended(state, p)).length,
      providersPending: state.providers.filter(p => p.status === 'pending').length,
      clients: state.users.filter(u => u.role === 'client' && !u.suspended).length,
      requestsMonth: state.requests.filter(r => r.createdAt >= monthAgo).length,
      signupsSeries,
    };
  }

  async saveContactMessage({ name, email, message }) {
    const state = this._load();
    state.contactMessages.push({ id: uuid(), name, email, message, createdAt: now() });
    this._save(state);
  }

  async getProviderIdFor(userId) {
    const state = this._load();
    return state.providers.find(p => p.ownerId === userId)?.id ?? null;
  }

  // Réglages du site (mode maintenance). La clé `settings` peut manquer dans un état
  // écrit avant cette fonction : un visiteur déjà installé porte un localStorage qui ne
  // la connaît pas, et son écran de réglages ne doit pas casser pour autant.
  async getSiteSettings() {
    const s = this._load().settings;
    return {
      maintenanceEnabled: !!s?.maintenanceEnabled,
      maintenanceMessage: s?.maintenanceMessage ?? '',
      updatedAt: s?.updatedAt ?? null,
    };
  }

  async saveSiteSettings({ maintenanceEnabled, maintenanceMessage }) {
    const state = this._load();
    state.settings = {
      maintenanceEnabled: !!maintenanceEnabled,
      maintenanceMessage: (maintenanceMessage ?? '').trim(),
      updatedAt: now(),
    };
    this._save(state);
    return { ...state.settings };
  }

  async resetDemo() {
    this.storage.removeItem(STATE_KEY); // re-seed paresseux au prochain accès
  }
}

// ---------------------------------------------------------------------------
// SupabaseAdapter — mode réel (non testable hors-ligne ; les politiques RLS
// appliquent les règles d'autorisation côté base).
// ---------------------------------------------------------------------------
const toCamel = row => ({
  id: row.id, ownerId: row.profile_id, businessName: row.business_name, categoryId: row.category_id,
  description: row.description ?? '', city: row.city, quarter: row.quarter, phone: row.phone,
  whatsapp: row.whatsapp, priceFrom: row.price_from, priceTo: row.price_to, coverUrl: row.cover_url,
  gallery: row.gallery ?? [], status: row.status, isVerified: row.is_verified, createdAt: row.created_at,
});
const providerInsert = data => ({
  profile_id: data.ownerId, business_name: data.businessName ?? '', category_id: data.categoryId ?? null,
  description: data.description ?? '', city: data.city ?? 'Lomé', quarter: data.quarter ?? '',
  phone: data.phone ?? '', whatsapp: data.whatsapp ?? '',
  price_from: data.priceFrom ?? 0, price_to: data.priceTo ?? 0, cover_url: data.coverUrl ?? '',
});
const EDITABLE_TO_SNAKE = { businessName: 'business_name', categoryId: 'category_id', description: 'description',
  city: 'city', quarter: 'quarter', phone: 'phone', whatsapp: 'whatsapp', priceFrom: 'price_from',
  priceTo: 'price_to', coverUrl: 'cover_url', gallery: 'gallery' };
const requestFromRow = row => ({
  id: row.id, clientId: row.client_id, providerId: row.provider_id, eventType: row.event_type,
  eventDate: row.event_date, guests: row.guests, budget: row.budget, message: row.message,
  status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
});

export class SupabaseAdapter {
  constructor() {
    this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }

  async _categories() {
    const { data, error } = await this.client.from('categories').select('*');
    if (error) throw new Error(error.message);
    return data;
  }

  _decorate(row, categories, reviews) {
    const cat = categories.find(c => c.id === row.category_id);
    const visible = (reviews ?? []).filter(v => v.visible);
    const avg = visible.length ? visible.reduce((s, v) => s + v.rating, 0) / visible.length : 0;
    return {
      id: row.id, businessName: row.business_name, categoryId: row.category_id,
      categoryName: cat ? cat.name : '', city: row.city, quarter: row.quarter,
      phone: row.phone, whatsapp: row.whatsapp, priceFrom: row.price_from, priceTo: row.price_to,
      coverUrl: row.cover_url, isVerified: row.is_verified, status: row.status,
      createdAt: row.created_at,
      avgRating: Math.round(avg * 10) / 10, reviewsCount: visible.length,
    };
  }

  async listCategories() {
    const { data, error } = await this.client.from('categories').select('*').eq('active', true);
    if (error) throw new Error(error.message);
    return data.map(c => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, active: c.active }));
  }

  async listProviders(f = {}) {
    const { data, error } = await this.client
      .from('providers')
      .select('*, profiles!providers_profile_id_fkey(suspended), services(*), reviews(visible, rating)')
      .eq('status', 'approved');
    if (error) throw new Error(error.message);
    const categories = await this._categories();
    let list = data
      .filter(row => !row.profiles?.suspended)
      .map(row => this._decorate(row, categories, row.reviews));
    if (f.category) list = list.filter(p => p.categoryId === f.category);
    if (f.quarter) {
      const q = String(f.quarter).trim().toLowerCase();
      list = list.filter(p => (p.quarter || '').toLowerCase().includes(q));
    }
    if (f.q) {
      const q = String(f.q).trim().toLowerCase();
      const byId = new Map(data.map(r => [r.id, r]));
      list = list.filter(p => {
        const row = byId.get(p.id);
        return (p.businessName + ' ' + (row?.description || '')).toLowerCase().includes(q);
      });
    }
    if (f.verifiedOnly) list = list.filter(p => p.isVerified);
    if (f.priceMax != null) list = list.filter(p => p.priceFrom <= f.priceMax);
    if (f.minRating != null) list = list.filter(p => p.avgRating >= f.minRating);
    const byRatingDesc = (a, b) => b.avgRating - a.avgRating || b.createdAt.localeCompare(a.createdAt);
    switch (f.sort) {
      case 'note': list.sort(byRatingDesc); break;
      case 'prix-asc': list.sort((a, b) => a.priceFrom - b.priceFrom); break;
      case 'prix-desc': list.sort((a, b) => b.priceFrom - a.priceFrom); break;
      default: list.sort((a, b) => Number(b.isVerified) - Number(a.isVerified) || byRatingDesc(a, b));
    }
    return list;
  }

  async getProvider(id) {
    const { data: row, error } = await this.client.from('providers').select('*').eq('id', id).single();
    if (error || row.status !== 'approved') throw new Error('Prestataire introuvable.');
    const { data: services } = await this.client.from('services').select('*').eq('provider_id', id).order('price');
    const { data: reviews } = await this.client.from('reviews')
      .select('*').eq('provider_id', id).eq('visible', true);
    const categories = await this._categories();
    return {
      ...this._decorate(row, categories, reviews),
      description: row.description, gallery: row.gallery ?? [],
      services: (services ?? []).map(s => ({ id: s.id, label: s.label, description: s.description, price: s.price })),
      reviews: (reviews ?? []).map(v => ({ id: v.id, rating: v.rating, comment: v.comment,
        clientName: '', createdAt: v.created_at })),
    };
  }

  async createProvider(profileId, data) {
    const { data: row, error } = await this.client
      .from('providers').insert({ ...providerInsert(data), profile_id: profileId }).select().single();
    if (error) throw new Error(error.message);
    return toCamel(row);
  }

  async updateProvider(id, patch) {
    const row = {};
    for (const k of EDITABLE_PROVIDER_KEYS) {
      if (k in patch && EDITABLE_TO_SNAKE[k]) row[EDITABLE_TO_SNAKE[k]] = patch[k];
    }
    const { data, error } = await this.client.from('providers').update(row).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  }

  async saveServices(providerId, services) {
    await this.client.from('services').delete().eq('provider_id', providerId);
    const { data, error } = await this.client.from('services')
      .insert(services.map(s => ({ provider_id: providerId, label: s.label, description: s.description ?? '', price: s.price })))
      .select();
    if (error) throw new Error(error.message);
    return (data ?? []).map(s => ({ id: s.id, label: s.label, description: s.description, price: s.price }));
  }

  async createRequest({ clientId, providerId, eventType, eventDate, guests, budget, message }) {
    if (!message || !String(message).trim()) throw new Error('Le message est obligatoire.');
    const { data, error } = await this.client.from('requests').insert({
      client_id: clientId, provider_id: providerId, event_type: eventType, event_date: eventDate,
      guests, budget, message: String(message),
    }).select().single();
    if (error) throw new Error(error.message);
    return requestFromRow(data);
  }

  async getRequest(id) {
    const { data: row, error } = await this.client.from('requests').select('*').eq('id', id).single();
    if (error) throw new Error('Demande introuvable.');
    const [{ data: client }, { data: provider }] = await Promise.all([
      this.client.from('profiles').select('id, full_name').eq('id', row.client_id).single(),
      this.client.from('providers').select('id, business_name').eq('id', row.provider_id).single(),
    ]);
    return { ...requestFromRow(row), client: { id: client.id, fullName: client.full_name },
      provider: { id: provider.id, businessName: provider.business_name } };
  }

  async listRequestsForClient(clientId) {
    const { data, error } = await this.client.from('requests').select('*')
      .eq('client_id', clientId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(requestFromRow);
  }

  async listRequestsForProvider(providerId) {
    const { data, error } = await this.client.from('requests').select('*')
      .eq('provider_id', providerId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(requestFromRow);
  }

  async updateRequestStatus(id, { status }) {
    const { data, error } = await this.client.from('requests')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return requestFromRow(data);
  }

  async listMessages(requestId) {
    const { data, error } = await this.client.from('messages').select('*')
      .eq('request_id', requestId).order('created_at');
    if (error) throw new Error(error.message);
    return data.map(m => ({ id: m.id, requestId: m.request_id, senderId: m.sender_id,
      body: m.body, readAt: m.read_at, createdAt: m.created_at }));
  }

  async sendMessage({ requestId, senderId, body }) {
    if (!body || !String(body).trim()) throw new Error('Le message ne peut pas être vide.');
    const { data, error } = await this.client.from('messages')
      .insert({ request_id: requestId, sender_id: senderId, body: String(body) }).select().single();
    if (error) throw new Error(error.message);
    const { data: req } = await this.client.from('requests').select('status').eq('id', requestId).single();
    if (req?.status === 'sent') {
      await this.client.from('requests')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', requestId);
    }
    return { id: data.id, requestId: data.request_id, senderId: data.sender_id,
      body: data.body, readAt: data.read_at, createdAt: data.created_at };
  }

  async markRequestRead(requestId, readerId) {
    await this.client.from('messages').update({ read_at: new Date().toISOString() })
      .eq('request_id', requestId).neq('sender_id', readerId).is('read_at', null);
  }

  async listThreadsFor(userId) {
    const [{ data: asClient }, { data: owned }] = await Promise.all([
      this.client.from('requests').select('*').eq('client_id', userId),
      this.client.from('providers').select('id').eq('profile_id', userId),
    ]);
    const ownedIds = (owned ?? []).map(p => p.id);
    let asProvider = [];
    if (ownedIds.length) {
      const { data } = await this.client.from('requests').select('*').in('provider_id', ownedIds);
      asProvider = data ?? [];
    }
    const seen = new Set();
    const requests = [...(asClient ?? []), ...asProvider].filter(r => !seen.has(r.id) && seen.add(r.id));
    const categories = await this._categories();
    return Promise.all(requests.map(async row => {
      const [{ data: messages }, { data: provider }, { data: client }] = await Promise.all([
        this.client.from('messages').select('*').eq('request_id', row.id).order('created_at'),
        this.client.from('providers').select('*, reviews(visible, rating)').eq('id', row.provider_id).single(),
        this.client.from('profiles').select('id, full_name').eq('id', row.client_id).single(),
      ]);
      const msgs = messages ?? [];
      const last = msgs[msgs.length - 1];
      const isClientSide = row.client_id === userId;
      return {
        request: requestFromRow(row),
        counterparty: isClientSide
          ? { name: provider?.business_name ?? '', role: 'prestataire' }
          : { name: client?.full_name ?? '', role: 'client' },
        lastMessage: last
          ? { id: last.id, requestId: last.request_id, senderId: last.sender_id, body: last.body,
              readAt: last.read_at, createdAt: last.created_at }
          : { id: null, requestId: row.id, senderId: row.client_id, body: row.message,
              readAt: null, createdAt: row.created_at },
        unreadCount: msgs.filter(m => m.sender_id !== userId && !m.read_at).length,
        providerPreview: provider ? this._decorate(provider, categories, provider.reviews) : null,
      };
    }));
  }

  async createReview({ requestId, clientId, rating, comment }) {
    const { data: r } = await this.client.from('requests').select('*').eq('id', requestId).single();
    if (!r || r.status !== 'closed' || r.client_id !== clientId) {
      throw new Error('Impossible de déposer un avis sur cette demande.');
    }
    const { data, error } = await this.client.from('reviews')
      .insert({ request_id: requestId, client_id: clientId, provider_id: r.provider_id,
        rating, comment: comment ?? '', visible: false }).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, requestId: data.request_id, clientId: data.client_id,
      providerId: data.provider_id, rating: data.rating, comment: data.comment,
      visible: data.visible, createdAt: data.created_at };
  }

  async setReviewVisible(id, visible) {
    const { data, error } = await this.client.from('reviews')
      .update({ visible: !!visible }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, visible: data.visible };
  }

  async listReviewsForProvider(providerId) {
    const { data, error } = await this.client.from('reviews')
      .select('*').eq('provider_id', providerId).eq('visible', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(v => ({ id: v.id, rating: v.rating, comment: v.comment,
      clientName: '', createdAt: v.created_at }));
  }

  // « Mes avis » (espace client, R22) — miroir de listReviewsForProvider, sans le
  // filtre visible : la politique « reviews read » (rls.sql:48, bras
  // client_id = auth.uid()) laisse déjà l'auteur lire ses avis non publiés.
  // Aucune politique RLS n'est ajoutée ni modifiée.
  async listReviewsForClient(clientId) {
    const { data, error } = await this.client.from('reviews')
      .select('*, provider:providers!reviews_provider_id_fkey(business_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(v => ({ id: v.id, requestId: v.request_id ?? null,
      providerId: v.provider_id, rating: v.rating, comment: v.comment,
      visible: !!v.visible, createdAt: v.created_at,
      providerName: v.provider?.business_name ?? '' }));
  }

  // File de modération admin : tous les avis (visibles et non visibles), non publiés
  // d'abord puis date décroissante. La politique « reviews read » (rls.sql) a un bras
  // is_admin() : un admin voit les avis masqués sans qu'une politique soit ajoutée.
  // Double jointure par FK nommée (client → profiles, prestataire → providers).
  async listReviewsAdmin() {
    const { data, error } = await this.client.from('reviews')
      .select('*, client:profiles!reviews_client_id_fkey(full_name), provider:providers!reviews_provider_id_fkey(business_name)')
      .order('visible', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(v => ({ id: v.id, requestId: v.request_id ?? null,
      clientId: v.client_id, providerId: v.provider_id, rating: v.rating, comment: v.comment,
      visible: !!v.visible, createdAt: v.created_at,
      clientName: v.client?.full_name ?? '', providerName: v.provider?.business_name ?? '' }));
  }

  async listProvidersAdmin({ status } = {}) {
    // `email` est columnné dans public.profiles (I8/R20) et `suspended` permet
    // le drapeau ownerSuspended (R18) : sans lui, l'admin afficherait un lien
    // public sur les fiches « Approuvé » masquées par la liste publique.
    let query = this.client.from('providers')
      .select('*, profiles!providers_profile_id_fkey(full_name, email, suspended)');
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const categories = await this._categories();
    return data.map(row => ({
      ...this._decorate(row, categories, []),
      description: row.description,
      ownerSuspended: !!row.profiles?.suspended,
      owner: { fullName: row.profiles?.full_name ?? '', email: row.profiles?.email ?? '' },
    }));
  }

  async setProviderStatus(id, status) {
    const { data, error } = await this.client.from('providers').update({ status }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  }

  async setProviderVerified(id, isVerified) {
    const { data, error } = await this.client.from('providers')
      .update({ is_verified: !!isVerified }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  }

  async listUsersAdmin() {
    const { data, error } = await this.client.from('profiles').select('*').order('created_at');
    if (error) throw new Error(error.message);
    return data.map(u => ({ id: u.id, fullName: u.full_name, email: u.email, phone: u.phone ?? '',
      role: u.role, suspended: u.suspended, createdAt: u.created_at }));
  }

  async setUserSuspended(id, suspended) {
    const { data, error } = await this.client.from('profiles')
      .update({ suspended: !!suspended }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, suspended: data.suspended };
  }

  async listCategoriesAdmin() {
    const { data, error } = await this.client.from('categories').select('*');
    if (error) throw new Error(error.message);
    return data.map(c => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon, active: c.active }));
  }

  async saveCategory({ id, slug, name, icon, active }) {
    if (id) {
      const { data, error } = await this.client.from('categories')
        .update({ slug, name, icon, active: active !== false }).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return { id: data.id, slug: data.slug, name: data.name, icon: data.icon, active: data.active };
    }
    const { data, error } = await this.client.from('categories')
      .insert({ slug, name, icon: icon ?? 'star', active: active !== false }).select().single();
    if (error) throw new Error(error.message);
    return { id: data.id, slug: data.slug, name: data.name, icon: data.icon, active: data.active };
  }

  async getStats() {
    const count = async (table, filters = () => {}) => {
      let query = this.client.from(table).select('id', { count: 'exact', head: true });
      query = filters(query);
      const { count: n, error } = await query;
      if (error) throw new Error(error.message);
      return n ?? 0;
    };
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: signups }, providersActive, providersPending, clients, requestsMonth] = await Promise.all([
      this.client.from('profiles').select('created_at').gte('created_at', since),
      count('providers', q => q.eq('status', 'approved')),
      count('providers', q => q.eq('status', 'pending')),
      count('profiles', q => q.eq('role', 'client').eq('suspended', false)),
      count('requests', q => q.gte('created_at', since)),
    ]);
    const dayKey = d => d.toISOString().slice(0, 10);
    const signupsSeries = [];
    for (let i = 29; i >= 0; i--) {
      const key = dayKey(new Date(Date.now() - i * 86400000));
      signupsSeries.push({ date: key,
        count: (signups ?? []).filter(u => dayKey(new Date(u.created_at)) === key).length });
    }
    return { providersActive, providersPending, clients, requestsMonth, signupsSeries };
  }

  async saveContactMessage({ name, email, message }) {
    const { error } = await this.client.from('contact_messages').insert({ name, email, message });
    if (error) throw new Error(error.message);
  }

  async getProviderIdFor(userId) {
    const { data } = await this.client.from('providers').select('id').eq('profile_id', userId).maybeSingle();
    return data?.id ?? null;
  }

  // Réglages du site. Lecture ouverte à tous (rls.sql) : la page de maintenance et la
  // edge function n'ont pas de session. Écriture réservée à un admin par la base, pas
  // par ce fichier — `.single()` sur une écriture refusée remonte l'erreur de Postgres.
  async getSiteSettings() {
    const { data, error } = await this.client.from('site_settings')
      .select('maintenance_enabled, maintenance_message, updated_at').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return {
      maintenanceEnabled: !!data?.maintenance_enabled,
      maintenanceMessage: data?.maintenance_message ?? '',
      updatedAt: data?.updated_at ?? null,
    };
  }

  async saveSiteSettings({ maintenanceEnabled, maintenanceMessage }) {
    const { data, error } = await this.client.from('site_settings').update({
      maintenance_enabled: !!maintenanceEnabled,
      maintenance_message: (maintenanceMessage ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1).select('maintenance_enabled, maintenance_message, updated_at').single();
    if (error) throw new Error(error.message);
    return {
      maintenanceEnabled: !!data.maintenance_enabled,
      maintenanceMessage: data.maintenance_message ?? '',
      updatedAt: data.updated_at,
    };
  }

  async resetDemo() {
    throw new Error('resetDemo n\'est disponible qu\'en mode démonstration.');
  }
}

// ---------------------------------------------------------------------------
// Sélection d'adaptateur — les pages ne parlent qu'à `db`.
// ---------------------------------------------------------------------------
export function createDb() {
  return isDemoMode() ? new DemoAdapter(globalThis.localStorage) : new SupabaseAdapter();
}

export const db = createDb();
