// auth-supabase.js — script classique (aucun import/export) : expose window.EventisAuthSupabase.
// Actif uniquement en mode réel ; chargé avant les modules de page.
(function () {
  'use strict';

  class AuthSupabase {
    // cfg : { SUPABASE_URL, SUPABASE_ANON_KEY } (config.js) ; db : instance de db.js (module)
    constructor(cfg, db) {
      this.db = db;
      this.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }

    async _profile(userId) {
      const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).single();
      if (error) throw new Error(error.message);
      return { id: data.id, fullName: data.full_name, email: data.email, phone: data.phone ?? '',
        role: data.role, suspended: data.suspended };
    }

    async current() {
      const { data: { session } } = await this.client.auth.getSession();
      if (!session?.user) return null;
      return this._profile(session.user.id);
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
      return this._profile(userId);
    }

    async signIn(email, password) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error('Identifiants invalides.');
      const profile = await this._profile(data.user.id);
      if (profile.suspended) {
        await this.client.auth.signOut();
        throw new Error('Compte suspendu.');
      }
      return profile;
    }

    async signOut() {
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

    // Mise à jour des métadonnées du compte connecté (nom affiché + téléphone).
    // L'e-mail reste inchangé : il identifie le compte et sert à la connexion.
    async updateProfile({ fullName, phone }) {
      const { error } = await this.client.auth.updateUser({ data: { full_name: fullName, phone } });
      if (error) throw new Error(error.message);
      return this.current();
    }
  }

  window.EventisAuthSupabase = { AuthSupabase };
})();
