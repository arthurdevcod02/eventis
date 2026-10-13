# Eventis — Spécification de conception (Phase 1)

**Date :** 2026-10-13
**Statut :** validé en conception, en attente de relecture
**Slogan :** « L'excellence événementielle, connectée et sécurisée. »

---

## 1. Contexte et objectifs

Eventis est une plateforme événementielle premium qui met en relation des clients avec des prestataires événementiels (traiteurs, décorateurs, DJ, photographes, salles…). Premier marché : le Togo (Lomé et environs), avec une évolution possible vers d'autres marchés africains.

Objectifs de la phase 1 :

- Permettre à un visiteur de découvrir et comparer des prestataires, puis de leur envoyer une demande de devis.
- Permettre à un client de suivre ses demandes et d'échanger par messagerie.
- Permettre à un prestataire de gérer son profil, ses services et ses demandes.
- Permettre à un administrateur de modérer : approuver, vérifier, suspendre ; gérer avis, catégories et utilisateurs.
- Fonctionner immédiatement en **mode démonstration** (données locales réalistes) et basculer sur **Supabase** dès que les clés sont fournies, sans toucher au code des pages.

Principes non négociables :

- Aucune fonctionnalité présentée comme opérationnelle si elle ne l'est pas réellement (transparence sur le mode démo).
- Confiance : le badge vert « vérifié » n'est accordé que par l'administrateur via un mécanisme réel.
- Simplicité d'utilisation, design premium, performance sur connexions mobiles.
- Pas de paiement en ligne : le règlement se fait directement entre client et prestataire (Flooz, TMoney, espèces). Aucune simulation de paiement.

## 2. Utilisateurs et rôles

| Rôle | Description |
|---|---|
| **Visiteur** | Consulte le catalogue et les fiches. Peut s'inscrire. |
| **Client** | Envoi de demandes de devis, messagerie, avis après prestation, gestion de son profil. |
| **Prestataire** | Fiche publique, services & tarifs, galerie, réception/traitement des demandes, messagerie, consultation de ses avis. |
| **Administrateur** | Modération complète : approuver/vérifier/suspendre les prestataires, modérer les avis, gérer catégories et utilisateurs, statistiques globales. |

Un même compte ne cumule pas les rôles client et prestataire (inscription distincte, choix explicite).

## 3. Périmètre

### Inclus (phase 1)

- Site public : accueil, catalogue avec recherche et filtres, fiche prestataire, comment ça marche, contact, mentions légales.
- Authentification : inscription (client ou prestataire), connexion, déconnexion, mot de passe oublié.
- Espace client : tableau de bord, demandes (création via fiche prestataire, suivi des statuts), messagerie par fils, profil, dépôt d'avis après clôture.
- Espace prestataire : dashboard (demandes reçues, taux de réponse), traitement des demandes (accepter / refuser avec message), messagerie, gestion des services & tarifs (FCFA), galerie, profil, lecture de ses avis.
- Espace administrateur : statistiques, gestion des prestataires (approbation, vérification, suspension), utilisateurs, avis (modération), catégories.
- Messagerie simple par fils : un fil = une demande ; messages texte ; statuts lus/non lus ; pas de temps réel.
- Mode démo autonome + connecteur Supabase prêt (même interface de données).
- PWA installable : manifest, service worker, icônes.
- Architecture compatible mode sombre (tokens + bascule, palette sombre de base fournie).
- Contenu démo : 10 prestataires fictifs réalistes à Lomé, 8 catégories, avis, photos générées.

### Exclus (phase 1) — reportés volontairement

- Paiement en ligne et réservation avec acompte.
- Chat temps réel (présence, « en train d'écrire »).
- Multilingue (le code sera structuré pour accueillir l'anglais plus tard, sans sélecteur visible).
- Notifications push et par e-mail.
- Application mobile native.

## 4. Architecture technique

**Stack :** HTML/CSS/JS 100 % sur mesure, multi-pages, sans framework ni étape de build. GSAP (core + ScrollTrigger) pour les animations, hébergé en local dans `assets/vendor/`. SDK Supabase JS également en local dans `assets/vendor/`, activé uniquement en mode réel (aucun appel externe en mode démo).

**Principe central — couche de données interchangeable :**

```
config.js   →  db.js (interface unique)  →  DemoAdapter   (localStorage, données fictives)
                                    └→  SupabaseAdapter (Supabase + RLS)
```

- `assets/js/config.js` : `SUPABASE_URL` et `SUPABASE_ANON_KEY` vides ⇒ mode démo ; renseignés ⇒ mode réel.
- Toutes les pages et modules ne parlent qu'à `db.js`. Le changement de mode ne touche aucune page.
- Authentification : même principe (`auth.js` avec deux adaptateurs). En mode démo, comptes locaux dans le navigateur (avec jeu de comptes démo documentés : client, prestataire, admin). En mode réel, Supabase Auth (e-mail + mot de passe).
- Indicateur « Mode démonstration » discret et permanent (header ou footer) tant que le site n'est pas branché à Supabase.

**Organisation des fichiers :**

```
eventis/
├── index.html · catalogue.html · prestataire.html · comment-ca-marche.html
├── contact.html · mentions-legales.html · 404.html
├── auth/connexion.html · auth/inscription.html
├── compte/ (index.html · demandes.html · messages.html · profil.html)
├── espace-prestataire/ (index.html · demandes.html · messages.html · services.html · profil.html)
├── admin/ (index.html · prestataires.html · utilisateurs.html · avis.html · categories.html)
├── assets/
│   ├── css/ (tokens.css · base.css · components.css · pages/*.css)
│   ├── js/core/ (config.js · db.js · auth.js · ui.js · guards.js)
│   ├── js/pages/ (un module par page/écran)
│   ├── fonts/ (repli local si CDN indisponible) · img/
│   └── vendor/ (gsap, supabase-js, en local, pas de CDN externe requis)
├── manifest.webmanifest · sw.js · icons/
└── supabase/ (schema.sql · rls.sql · seed.sql)
```

Chaque espace protégé (compte, espace prestataire, admin) est gardé par `guards.js` : redirection vers la connexion si non authentifié, vers la bonne page selon le rôle.

## 5. Pages et fonctionnalités

### 5.1 Accueil (`index.html`)

- Hero : titre Syne fort, sous-titre, barre de recherche (catégorie + quartier/ville), image de fond générée, animation d'entrée GSAP.
- Bandeau de catégories (8 cartes cliquables vers le catalogue pré-filtré).
- « Comment ça marche » : 3 étapes (Cherchez → Comparez → Contactez).
- Sélection de prestataires (vérifiés d'abord, puis mieux notés).
- Témoignages (issus du contenu démo, marqués comme tels en mode démo).
- Appels à l'action : « Trouver un prestataire », « Devenir prestataire ».
- Footer complet : navigation, contact, mentions légales, indicateur de mode.

### 5.2 Catalogue (`catalogue.html`)

- Filtres : catégorie, quartier/ville, fourchette de budget (FCFA), note minimale, vérifiés uniquement, recherche texte (nom, description).
- Tri : pertinence (défaut), note, tarif croissant/décroissant.
- Grille de cartes prestataire : photo de couverture, nom, catégorie, quartier, tarif « à partir de », note, badge vert « Vérifié » le cas échéant.
- États : chargement (skeletons), aucun résultat (avec suggestion d'élargir les filtres).

### 5.3 Fiche prestataire (`prestataire.html?id=...`)

- Galerie photos, nom, catégorie, quartier + zone d'intervention, description.
- Services & tarifs (liste détaillée, prix en FCFA).
- Badge « Vérifié » + date d'inscription, note moyenne et nombre d'avis.
- Avis clients (modérés, visibles).
- Formulaire « Demander un devis » (connecté obligatoire) : type d'événement, date, nombre d'invités, budget estimé, message. Soumission ⇒ création d'une demande + ouverture du fil de messagerie.
- Coordonnées affichées sur la fiche (téléphone/WhatsApp).

### 5.4 Authentification (`auth/`)

- Inscription : choix explicite « Je cherche un prestataire » (client) / « Je propose mes services » (prestataire). Champs : nom complet, e-mail, téléphone, mot de passe. Le prestataire complète ensuite son profil public (obligatoire avant publication : nom commercial, catégorie, description, quartier, téléphone).
- Connexion, déconnexion, mot de passe oublié (simulé en démo avec consigne claire, réel via Supabase).
- Après connexion : redirection selon le rôle (client → compte, prestataire → espace prestataire, admin → admin).

### 5.5 Espace client (`compte/`)

- Tableau de bord : résumé (demandes en cours, messages non lus, dernières activités).
- Demandes : liste avec statuts colorés — Envoyée, En cours, Acceptée, Refusée, Clôturée. Détail d'une demande : informations + fil de messages.
- Messagerie : liste des fils (un par demande), conversation, indicateur lu/non lu.
- Avis : après clôture d'une demande acceptée, le client peut déposer une note (1–5) et un commentaire (soumis à modération).
- Profil : nom, téléphone, mot de passe (réel uniquement en mode Supabase ; en démo, modification locale).

### 5.6 Espace prestataire (`espace-prestataire/`)

- Dashboard : demandes reçues (nouvelles/en cours), taux de réponse calculé sur les 30 derniers jours, note moyenne, derniers avis.
- Demandes : accepter ou refuser (avec message obligatoire en cas de refus). Chaque demande ouvre son fil de messagerie.
- Messagerie : identique au client, côté prestataire.
- Services & tarifs : ajout/modification/suppression (libellé + description + prix FCFA).
- Galerie : ajout/suppression de photos (fichiers locaux en démo ; Supabase Storage en mode réel).
- Profil : informations publiques, zone d'intervention, téléphone, WhatsApp.
- Visibilité : tant que le profil n'est pas complet et approuvé par l'admin, la fiche n'apparaît pas dans le catalogue (statut « en attente » affiché).

### 5.7 Administration (`admin/`)

- Dashboard : compteurs (prestataires actifs, en attente, clients, demandes du mois), graphique simple des inscriptions sur 30 jours.
- Prestataires : liste avec filtres (statut), actions — approuver, vérifier (accorde le badge vert), suspendre, réactiver.
- Utilisateurs : liste, suspension de compte.
- Avis : file de modération — publier ou masquer.
- Catégories : ajouter/renommer/désactiver une catégorie.

### 5.8 Pages statiques

Comment ça marche (3 rôles détaillés), contact (formulaire vers l'équipe Eventis — en mode démo : message enregistré localement avec consigne), mentions légales, 404.

## 6. Modèle de données

Convention : clés primaires `uuid`, `created_at timestamptz default now()`. Montants en FCFA (entiers).

| Table | Colonnes principales |
|---|---|
| `profiles` | `id` (ref auth.users), `full_name`, `phone`, `role` (client/prestataire/admin), `suspended bool`, `created_at` |
| `categories` | `id`, `slug unique`, `name`, `icon`, `active bool` |
| `providers` | `id`, `profile_id` ref profiles, `category_id`, `business_name`, `slug`, `description`, `city`, `quarter`, `phone`, `whatsapp`, `price_from int`, `price_to int`, `cover_url`, `gallery jsonb`, `status` (pending/approved/suspended), `is_verified bool default false`, `created_at` |
| `services` | `id`, `provider_id` ref providers, `label`, `description`, `price int` |
| `requests` | `id`, `client_id` ref profiles, `provider_id` ref providers, `event_type`, `event_date`, `guests int`, `budget int`, `message`, `status` (sent/in_progress/accepted/declined/closed), `created_at` |
| `messages` | `id`, `request_id` ref requests, `sender_id` ref profiles, `body`, `read_at timestamptz null`, `created_at` |
| `reviews` | `id`, `provider_id`, `client_id`, `request_id`, `rating int 1–5`, `comment`, `visible bool default false`, `created_at` |

**Politiques RLS (résumé) :**

- Lecture publique : `categories` actives, `providers` approuvés (avec leurs `services` et `reviews` visibles).
- `requests` : le client propriétaire (lecture/écriture) et le prestataire destinataire (lecture ; mise à jour du statut). Admin : tout.
- `messages` : lecture/insertion limitées aux deux parties de la demande. Admin : lecture.
- `reviews` : insertion par le client de la demande clôturée ; lecture publique des avis `visible = true`. Admin : modération.
- `profiles` : lecture de son propre profil ; admin : tout. Les rôles ne sont modifiables que par admin.

**Contraintes d'intégrité :** une `review` exige une `request` au statut `closed` ; un `message` exige une `request` existante ; un prestataire n'existe que pour un profil de rôle prestataire.

## 7. Design system

### 7.1 Tokens (variables CSS)

| Token | Valeur | Usage |
|---|---|---|
| `--color-white` | `#FFFFFF` | Fond dominant |
| `--color-black` | `#111111` | Titres, texte, sections sombres |
| `--color-orange` | `#F97316` | Boutons primaires, accents, liens clés |
| `--color-orange-hover` | `#EA580C` | Survol des boutons orange |
| `--color-green` | `#16A34A` | Succès, disponibilité, badge vérifié |
| `--color-green-dark` | `#166534` | Textes verts foncés |
| `--color-gray-bg` | `#F5F5F5` | Fonds de sections alternées |
| `--color-gray-border` | `#E5E7EB` | Bordures fines des cartes |
| `--color-gray-text` | `#6B7280` | Texte secondaire |

Plus : échelle d'espacements (4 → 96 px), rayons (`--radius-sm 8px`, `--radius-md 14px`, `--radius-lg 22px`), ombres discrètes, échelle typographique.

### 7.2 Typographie

- Titres et marque : **Syne** (Google Fonts, repli : `'Syne', system-ui, sans-serif` ; fichier local embarqué en secours).
- Textes courants, formulaires, UI : **Plus Jakarta Sans** (même politique de repli).

### 7.3 Composants

Boutons (primaire orange, secondaire à contours, fantôme), badges (vérifié vert, statuts), cartes prestataire (bordure fine `--color-gray-border`, ombre au survol), champs de formulaire avec état d'erreur, modales, toasts, skeletons de chargement, états vides avec action suggérée, barre de navigation sticky (menu mobile plein écran), pagination, tableaux d'administration, avis avec étoiles.

### 7.4 Direction artistique

Minimaliste et haut de gamme : beaucoup de blanc, titres Syne très présents, images événementielles de qualité, hiérarchie immédiate. Interdits : violet/jaune dominants, dégradés excessifs, effets lumineux artificiels, surcharge de composants génériques. Animations GSAP sobres : entrée du hero, apparitions au scroll (fondu + translation légère), micro-interactions au survol. `prefers-reduced-motion` respecté (animations désactivées).

### 7.5 Mode sombre

Architecture prête dès la construction : toutes les couleurs passent par les tokens, bascule via `data-theme="dark"` sur `<html>`, préférence utilisateur persistée. Palette sombre de base fournie (fond `#111111`, cartes `#1B1B1B`, texte `#F5F5F5`, accents inchangés). Peaufinage visuel complet en phase ultérieure.

### 7.6 Accessibilité

Contraste AA vérifié sur les combinaisons texte/fond principales, focus visibles, navigation clavier complète (modales et menus inclus), attributs ARIA des composants interactifs, textes alternatifs sur toutes les images.

## 8. Sécurité

- Mode réel : clé anonyme Supabase uniquement côté client ; jamais de clé service dans le navigateur ; toutes les règles d'autorisation dans les politiques RLS (le client JS ne fait confiance à rien).
- Mode démo : aucune donnée sensible ; tout reste dans le navigateur de l'utilisateur.
- Sortie HTML systématiquement échappée (injection XSS) ; validation des entrées à la soumission ; limitation de la taille des messages et champs.
- Mots de passe : politique minimale (8 caractères) ; hachage côté Supabase en mode réel ; en démo, stockage local marqué comme non sécurisé (à des fins de test uniquement).
- Production : HTTPS obligatoire (prérequis PWA), en-têtes de sécurité recommandés documentés pour l'hébergeur.

## 9. PWA et performance

- `manifest.webmanifest` : nom Eventis, thème `--color-orange`, icônes 192/512 générées, `display: standalone`.
- Service worker : stratégie cache-first pour les assets statiques, network-first pour les données ; pages statiques disponibles hors ligne.
- Performance : JS différé, images lazy-loaded et compressées, polices avec `font-display: swap`, budget cible < 200 Ko de JS initial par page hors vendor.
- Cible mobile : navigation tactile confortable (zones ≥ 44 px), formulaires adaptés (claviers contextuels), testé sur écran 360 px.

## 10. Contenu démo

- **10 prestataires** fictifs réalistes : noms commerciaux crédibles, quartiers de Lomé (Bè, Agbalépédogan, Tokoin, Adidogomé, Agoè, Hédzranawoé…), téléphones au format togolais (+228), tarifs en FCFA cohérents avec le marché local.
- **Répartition :** 2 traiteurs, 1 décoration, 1 photo/vidéo, 1 DJ & sonorisation, 1 salle des fêtes, 1 location de matériel, 1 wedding planner, 1 animation, 1 maître de cérémonie.
- 3 prestataires « vérifiés » (badge vert légitime via le compte admin démo), avis variés et datés, photos générées par catégorie.
- Comptes démo documentés (identifiants visibles sur la page de connexion en mode démo uniquement) : client@demo.tg, prestataire@demo.tg, admin@demo.tg.
- Témoignages de la page d'accueil issus des avis démo, présentés comme tels en mode démo.

## 11. Ordre de construction

1. **Fondations** : arborescence, tokens CSS, base, nav/footer, config + db.js (adaptateur démo + jeu de données), auth démo, guards.
2. **Pages publiques** : accueil, catalogue (filtres/tri), fiche prestataire, comment ça marche, contact, mentions légales, 404.
3. **Authentification & compte client** : inscription/connexion, dashboard client, demandes, profil.
4. **Espace prestataire** : dashboard, demandes, services & tarifs, galerie, profil.
5. **Messagerie & demandes** : fils de conversation, statuts, notifications de non-lus (dans l'interface, pas de push).
6. **Administration** : dashboard, modération prestataires/utilisateurs/avis, catégories.
7. **Avis** : dépôt client après clôture, publication admin, affichage public.
8. **Finition** : PWA (manifest, sw, icônes), mode sombre (tokens), animations GSAP, QA multi-navigateurs (Chrome desktop, Chrome mobile, Firefox, Safari si possible), accessibilité, vérification finale du mode démo puis simulation du bascule Supabase.

## 12. Critères d'acceptation

- Un visiteur peut trouver un prestataire par catégorie, quartier et budget, et lui envoyer une demande sans friction.
- Un client inscrit suit ses demandes et converse par fils de messages.
- Un prestataire gère son profil, ses tarifs et ses demandes ; sa fiche n'apparaît publiquement qu'après approbation.
- L'admin approuve, vérifie et suspend ; le badge vert ne s'affiche que pour les prestataires réellement vérifiés.
- Le site est installable en PWA et reste utilisable sur connexion lente (3G) et écran 360 px.
- Le passage démo → Supabase se fait en renseignant deux clés dans `config.js`, sans autre modification.
- Aucune fonctionnalité fictive n'est annoncée comme réelle ; le mode démo est indiqué en permanence.

## 13. Hors périmètre (rappel)

Paiement en ligne, chat temps réel, multilingue visible, notifications push/e-mail, application native, intégrations réseaux sociaux avancées.
