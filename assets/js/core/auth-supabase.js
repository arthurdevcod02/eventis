// auth-supabase.js — script classique (aucun import/export) : expose window.EventisAuthSupabase.
// Actif uniquement en mode réel ; chargé avant les modules de page.
(function () {
  'use strict';

  // L'URL d'entrée est figée ici, avant toute création de client : supabase-js efface
  // « ?code= » de la barre d'adresse dès qu'il l'a échangé. Sans cette capture, aucune
  // page ne peut ensuite distinguer « on est arrivé en suivant un lien d'e-mail » de
  // « on est arrivé en cliquant un bouton » — et c'est ce qui décide d'afficher ou non
  // un formulaire de nouveau mot de passe.
  const ENTRY_URL = { search: window.location.search, hash: window.location.hash };

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

    // L'URL sous laquelle la page a été chargée, avant le nettoyage de supabase-js.
    entryUrl() {
      return ENTRY_URL;
    }

    // Une session de récupération est une session valide sans être une connexion :
    // « current() » lit un profil, ce qui n'est pas la question posée par la page
    // « nouveau mot de passe » (le profil peut très bien exister déjà).
    async hasSession() {
      const { data } = await this.client.auth.getSession();
      return !!(data && data.session && data.session.user);
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
        this._profileOrNull(session.user.id).then(p => { this._user = p; }).catch(() => { this._user = null; });
      });
      const { data: { session } } = await this.client.auth.getSession();
      this._user = session?.user ? await this._profileOrNull(session.user.id) : null;
      return this._user;
    }

    _mapProfile(row) {
      return { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone ?? '',
        role: row.role, suspended: row.suspended };
    }

    async _profile(userId) {
      const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).single();
      if (error) throw new Error(error.message);
      return this._mapProfile(data);
    }

    // Ligne absente = null, et non une exception : « aucun profil » (compte qui arrive
    // par Google) et « Supabase injoignable » sont deux situations différentes, et la
    // première doit mener à l'écran de choix de rôle, pas à une erreur.
    async _profileOrNull(userId) {
      const { data } = await this.client.from('profiles').select('*').eq('id', userId).maybeSingle();
      return data ? this._mapProfile(data) : null;
    }

    async signUp({ fullName, email, phone, password, role, cguVersion, emailRedirectTo }) {
      if (!['client', 'prestataire'].includes(role)) throw new Error('Rôle invalide.');
      const { data, error } = await this.client.auth.signUp({
        email, password,
        // Les réponses du formulaire partent dans les métadonnées du compte. C'est la
        // seule écriture possible quand le projet exige la confirmation d'e-mail : sans
        // session, « profiles self insert » (id = auth.uid()) refuse toute insertion,
        // donc le profil ne peut s'écrire qu'au retour du lien.
        options: {
          data: { full_name: fullName, phone: phone ?? '', role, cgu_version: cguVersion },
          emailRedirectTo,
        },
      });
      if (error) {
        if (/already registered/i.test(error.message)) throw new Error('Cet e-mail est déjà utilisé.');
        throw new Error(error.message);
      }
      const userId = data.user.id;
      const { data: { session } } = await this.client.auth.getSession();
      // Pas de session = confirmation d'e-mail attendue. Ce n'est pas une erreur, et
      // surtout pas un compte à moitié créé : l'affichage doit le dire clairement.
      if (!session || !session.user) return { needsEmailConfirmation: true, email };
      await this._provision({ id: userId, fullName, email }, role, phone, cguVersion);
      return await this.signIn(email, password);
    }

    // Écriture du profil et, pour un prestataire, de sa fiche en attente. Une seule
    // règle pour les deux voies d'entrée : inscription classique et retour Google
    // (completeSignup). Un compte Google ne peut pas non plus choisir « admin » ici.
    // La version acceptée est écrite avec le profil : le consentement laisse une trace
    // en base, ce n'est pas un simple contrôle d'affichage.
    async _provision({ id, fullName, email }, role, phone = '', cguVersion) {
      // email est columnné dans public.profiles (I8/R20) : les pages admin
      // (prestataires, utilisateurs) consomment profiles.email via db.js.
      const { error: profileError } = await this.client.from('profiles')
        .insert({ id, full_name: fullName, email: email ?? '', phone: phone ?? '',
          role, cgu_version: cguVersion });
      if (profileError) throw new Error(profileError.message);
      if (role === 'prestataire') {
        const { error: providerError } = await this.client.from('providers')
          .insert({ profile_id: id, business_name: '' });
        if (providerError) throw new Error(providerError.message);
      }
    }

    // --- Connexion Google (mode réel uniquement) ----------------------------
    // Renvoie l'URL de consentement sans quitter la page (skipBrowserRedirect) :
    // l'appelant n'oriente le navigateur que si Supabase n'a pas répondu une erreur,
    // sinon le message reste lisible sur place.
    async signInWithGoogle({ redirectTo } = {}) {
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw new Error(error.message || 'La connexion Google est indisponible.');
      if (!data || !data.url) throw new Error('La connexion Google est indisponible.');
      return data.url;
    }

    // Un compte qui arrive par Google a une session mais aucune ligne « profiles » :
    // le profil est écrit par l'interface, pas par la base (rls.sql, « profiles self
    // insert »). pendingSignup signale cette attente, completeSignup y met fin.
    async pendingSignup() {
      const { data: { session } } = await this.client.auth.getSession();
      const user = session && session.user;
      if (!user) return null;
      if (await this._profileOrNull(user.id)) return null;
      const meta = user.user_metadata || {};
      return { id: user.id, email: user.email ?? '', fullName: this._nameFrom(user),
        phone: typeof meta.phone === 'string' ? meta.phone : '',
        role: ['client', 'prestataire'].includes(meta.role) ? meta.role : null };
    }

    _nameFrom(user) {
      const meta = user.user_metadata || {};
      return meta.full_name || meta.name
        || (user.email ? String(user.email).split('@')[0] : '')
        || 'Compte Eventis';
    }

    async completeSignup({ role, cguVersion } = {}) {
      if (!['client', 'prestataire'].includes(role)) throw new Error('Rôle invalide.');
      const pending = await this.pendingSignup();
      if (!pending) throw new Error('Aucun compte à compléter.');
      await this._provision(pending, role, pending.phone, cguVersion);
      this._user = await this._profile(pending.id);
      if (this._user.suspended) {
        await this.signOut();
        throw new Error('Compte suspendu.');
      }
      return this._user;
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

    // Le chemin littéral est celui de RECOVERY_RETURN_PATH dans core/auth-messages.js ;
    // tests/auth.test.js vérifie les deux au lieu d'un import impossible ici (script classique).
    async requestPasswordReset(email) {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reinitialisation.html',
      });
      if (error) throw new Error(error.message);
    }

    // Le lien de réinitialisation ouvre une session qui n'a d'autre droit que celui-là :
    // updateUser refuse un mot de passe hors session de récupération, ce qui rend le
    // formulaire de la page inutilisable ailleurs — et l'erreur doit rester lisible.
    async updatePassword(password) {
      const { data, error } = await this.client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      if (data && data.user) this._user = await this._profileOrNull(data.user.id);
      return this._user;
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
