// auth-supabase.js — script classique (aucun import/export) : expose window.EventisAuthSupabase.
// Actif uniquement en mode réel ; chargé avant les modules de page.
(function () {
  'use strict';

  class AuthSupabase {
    // cfg : { SUPABASE_URL, SUPABASE_ANON_KEY } (config.js) ; db : instance de db.js (module)
    constructor(cfg, db) {
      this.db = db;
      this.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      this._user = null;   // cache synchrone lu par current()
      this._ready = null;  // hydratation lancée une seule fois par chargement
    }

    // Lecture SYNCHRONE, exigée par guards.requireAuth : renvoie le profil en cache
    // ou null, jamais une Promise. Une Promise est toujours évaluée vraie, ce qui
    // rendait la garde de session inopérante en mode réel (R21).
    current() {
      return this._user;
    }

    // Hydrate le cache depuis la session enregistrée, puis l'entretient à chaque
    // changement d'état (connexion/déconnexion dans un autre onglet, expiration).
    // Idempotent : les pages protégées et la barre de navigation peuvent l'appeler.
    ready() {
      if (!this._ready) this._ready = this._hydrate();
      return this._ready;
    }

    async _hydrate() {
      this.client.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) { this._user = null; return; }
        this._profile(session.user.id).then(p => { this._user = p; }).catch(() => { this._user = null; });
      });
      const { data: { session } } = await this.client.auth.getSession();
      this._user = session?.user ? await this._profile(session.user.id) : null;
      return this._user;
    }

    async _profile(userId) {
      const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).single();
      if (error) throw new Error(error.message);
      return { id: data.id, fullName: data.full_name, email: data.email, phone: data.phone ?? '',
        role: data.role, suspended: data.suspended };
    }

    async signUp({ fullName, email, phone, password, role }) {
      if (!['client', 'prestataire'].includes(role)) throw new Error('Rôle invalide.');
      const { data, error } = await this.client.auth.signUp({ email, password });
      if (error) {
        if (/already registered/i.test(error.message)) throw new Error('Cet e-mail est déjà utilisé.');
        throw new Error(error.message);
      }
      const userId = data.user.id;
      // email est columnné dans public.profiles (I8/R20) : les pages admin
      // (prestataires, utilisateurs) consomment profiles.email via db.js.
      const { error: profileError } = await this.client.from('profiles')
        .insert({ id: userId, full_name: fullName, email, phone: phone ?? '', role });
      if (profileError) throw new Error(profileError.message);
      if (role === 'prestataire') {
        const { error: providerError } = await this.client.from('providers')
          .insert({ profile_id: userId, business_name: '' });
        if (providerError) throw new Error(providerError.message);
      }
      // Connexion directe si la confirmation d'e-mail est désactivée sur le projet.
      try { await this.signIn(email, password); } catch { /* confirmation d'e-mail requise */ }
      return this._user ?? await this._profile(userId);
    }

    async signIn(email, password) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error('Identifiants invalides.');
      const profile = await this._profile(data.user.id);
      if (profile.suspended) {
        await this.signOut();
        throw new Error('Compte suspendu.');
      }
      this._user = profile;
      return profile;
    }

    async signOut() {
      this._user = null;
      await this.client.auth.signOut();
    }

    onChange(cb) {
      const { data: { subscription } } = this.client.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) { cb(null); return; }
        this._profile(session.user.id).then(cb).catch(() => cb(null));
      });
      return () => subscription.unsubscribe();
    }

    async requestPasswordReset(email) {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/connexion.html',
      });
      if (error) throw new Error(error.message);
    }

    async getProviderIdFor(userId) {
      return this.db.getProviderIdFor(userId);
    }

    // Mise à jour des données du compte connecté (nom affiché + téléphone).
    // L'e-mail reste inchangé : il identifie le compte et sert à la connexion.
    // Source unique de ce que voit l'interface = public.profiles (lu par _profile) :
    // n'écrire que dans les métadonnées auth.users laisserait l'ancien nom affiché
    // tout en annonçant un succès (mode réel).
    async updateProfile({ fullName, phone }) {
      if (!this._user) throw new Error('Aucun compte connecté.');
      const { error } = await this.client.from('profiles')
        .update({ full_name: fullName, phone: phone ?? '' }).eq('id', this._user.id);
      if (error) throw new Error(error.message);
      this._user = await this._profile(this._user.id);
      return this._user;
    }
  }

  window.EventisAuthSupabase = { AuthSupabase };
})();
