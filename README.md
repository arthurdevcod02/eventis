# Eventis

**L'excellence événementielle, connectée et sécurisée.**

Plateforme de mise en relation entre clients et prestataires événementiels — traiteurs, salles,
photographes, sonorisation, décoration — conçue pour le **Togo** (Lomé) et l'Afrique de l'Ouest.
Prix en **FCFA**, interface intégralement en **français**, pensée pour rester utilisable sur des
**connexions lentes**.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-hors%20ligne-111111?style=flat)
![Tests](https://img.shields.io/badge/tests-27%2F27%20unitaires%20·%2089%20contr%C3%B4les%20headless-16A34A?style=flat)

> **Principe directeur du projet :** aucune fonctionnalité n'est présentée comme opérationnelle
> si elle ne l'est pas réellement. Le badge vert « Vérifié » vient d'une décision prise dans
> l'espace d'administration — pas d'un champ de démonstration, et pas d'une promesse.

---

## 1. Le problème

Organiser un mariage, un baptême ou un événement d'entreprise à Lomé repose aujourd'hui sur le
bouche-à-oreille, les statuts WhatsApp et les groupes Facebook. Conséquences concrètes :

- **côté client** — impossible de comparer les prestataires sur des critères fiables (tarifs
  réels, disponibilité, prestations passées) ; le « vérifié » n'existe nulle part, et chaque
  devis s'improvise par téléphone ;
- **côté prestataire** — aucune vitrine structurée : les tarifs et les prestations vivent dans
  des albums photo et des messages, et la prospection dépend de la chance ;
- **pour les deux** — la négociation se dilue dans une messagerie non organisée, sans
  historiquement de trace par dossier, et sans aucun mécanisme de confiance.

## 2. L'objectif

Eventis est un **annuaire qualifié + un espace de travail partagé** : on y trouve un prestataire
fiable, on lui demande un devis, on échange dans le fil de la demande, on évalue la prestation
réalisée — et l'équipe Eventis tranche sur ce qui est publié et sur ce qui est vérifié.

**Public visé**

| Profil | Ce que la plateforme lui apporte |
|---|---|
| Clients (particuliers, entreprises, diaspora) | catalogue filtrable, fiches détaillées avec tarifs en FCFA, demande de devis en 1 écran, suivi et messagerie |
| Prestataires événementiels | vitrine maîtrisée (services, tarifs, galerie), réception et qualification des demandes, gestion de leur offre |
| Équipe Eventis (rôle administrateur) | modération des fiches, attribution du badge « Vérifié », modération des avis, catégories, statistiques d'activité |

**Valeur ajoutée** : un socle de confiance explicite (modération humaine + avis publiés uniquement
après prestation clôturée), une expérience légère et rapide (aucun framework, aucun build,
polices et bibliothèques servies en local), et un produit pensé dès la conception pour le marché
togolais : FCFA, français, mobile-first, fonctionne hors ligne une fois visité.

## 3. Aperçu

| Accueil | Catalogue |
|---|---|
| ![Accueil](assets/screenshots/accueil.jpg) | ![Catalogue](assets/screenshots/catalogue.jpg) |

| Fiche prestataire | Connexion |
|---|---|
| ![Fiche prestataire](assets/screenshots/fiche-prestataire.jpg) | ![Connexion](assets/screenshots/connexion.jpg) |

| Tableau de bord client | Espace prestataire |
|---|---|
| ![Espace client](assets/screenshots/espace-client.jpg) | ![Espace prestataire](assets/screenshots/espace-prestataire.jpg) |

| Administration | Mobile (390 px) |
|---|---|
| ![Administration](assets/screenshots/administration.jpg) | ![Mobile](assets/screenshots/mobile-catalogue.jpg) |

*Ces captures ont été prises sur l'application réellement en cours d'exécution, en mode
démonstration, dans Chrome à 1440 × 900 et 390 × 844. Les visuels des prestataires sont des
images de démonstration générées, et non des prestations réelles.*

## 4. Fonctionnalités

Légende : ✅ implémenté et vérifié par exécution · ⚙️ présent mais dépend d'une configuration
externe · ⛔ hors périmètre de la phase 1.

### Parcours visiteur

| Fonctionnalité | État | Détail |
|---|---|---|
| Catalogue | ✅ | recherche, filtres catégorie / quartier / budget / note / « vérifié », tris, 10 prestataires de démonstration |
| Fiche prestataire | ✅ | galerie, services et tarifs en FCFA, avis publiés, coordonnées, demande de devis intégrée |
| Pages d'information | ✅ | « Comment ça marche », contact, mentions légales, page 404 réelle (vrai statut HTTP au développement) |

### Comptes et rôles

| Fonctionnalité | État | Détail |
|---|---|---|
| Inscription / connexion / déconnexion | ✅ | trois rôles : client, prestataire, administrateur ; redirection vers l'espace du rôle |
| Connexion « Continuer avec Google » | ⚙️ | bouton sur connexion et inscription, retour OAuth avec **choix du rôle confirmé par l'utilisateur** (client ou prestataire, jamais administrateur) ; code en place et simulé, **jamais exercé contre le vrai fournisseur Google** (voir §7bis) |
| Gardes de session | ✅ | les 14 pages protégées redirigent sans session ; un client appelé sur `/admin/` revient sur son espace |
| Mot de passe oublié | ⚙️ | mode démo : **aucun e-mail n'est envoyé**, la page le dit. Mode réel : e-mail envoyé par Supabase, puis page [`auth/reinitialisation.html`](auth/reinitialisation.html) qui **ne propose le formulaire que si elle est atteinte par le lien** (sinon elle explique « lien manquant » ou « lien expiré ») ; son URL doit figurer dans les *Redirect URLs* du projet (§7bis) |

### Espace client

| Fonctionnalité | État | Détail |
|---|---|---|
| Tableau de bord | ✅ | messages non lus, demandes en cours / clôturées, derniers dossiers |
| Demandes de devis | ✅ | envoi depuis une fiche (date passée refusée), statut envoyé → en cours → clôturé |
| Messagerie | ✅ | un fil par demande, aller-retour, accusés de lecture ; **pas de temps réel** : rechargement à la demande |
| Avis | ✅ | dépôt possible uniquement après clôture de la prestation, en attente de modération |

### Espace prestataire

| Fonctionnalité | État | Détail |
|---|---|---|
| Demandes reçues | ✅ | accepter, refuser, clôturer |
| Services et tarifs | ✅ | création, modification, suppression des lignes d'offre |
| Profil public | ✅ | édition des informations de la fiche ; **le statut d'approbation et le badge « Vérifié » ne sont pas modifiables par le prestataire** |
| Messagerie | ✅ | même module que l'espace client, côté prestataire |

### Administration

| Fonctionnalité | État | Détail |
|---|---|---|
| Statistiques | ✅ | prestataires en ligne, fiches en attente, clients actifs, demandes sur 30 jours, graphique des inscriptions |
| Modération des prestataires | ✅ | approbation, suspension (la fiche sort du catalogue public et devient non réservable), badge « Vérifié » |
| Comptes utilisateurs | ✅ | consultation, suspension et réactivation ; un compte suspendu ne peut plus se connecter |
| Modération des avis | ✅ | file d'attente, publication, masquage ; l'avis publié apparaît sur la fiche publique |
| Catégories | ✅ | création (slug automatique), renommage, activation / désactivation ; repercute sur les filtres du catalogue |
| Messages du formulaire de contact | ⚙️ | enregistrés (`contact_messages` en mode réel) mais **aucun écran d'administration ne les consulte encore** : en mode réel, la lecture se fait depuis la console Supabase |

### Transverse

| Fonctionnalité | État | Détail |
|---|---|---|
| Mode démonstration | ✅ | tout est stocké dans le navigateur (`localStorage`) : aucun serveur, aucune base ; bannière permanente rappelant le caractère fictif des données |
| Connecteur Supabase | ⚙️ | authentification + PostgreSQL + règles RLS ; **interchangeable avec le mode démo sans toucher au code des pages**, mais jamais exercé contre une instance réelle (voir §8 et §10) |
| Responsive | ✅ | mobile-first, contrôlé de 360 à 1440 px |
| PWA | ✅ | manifeste, icônes, service worker hors ligne (réseau d'abord pour les pages, cache d'abord + révalidation pour les ressources) |
| Mode sombre · animations | ✅ | thème clair/sombre avec contrastes mesurés, animations GSAP neutralisées sous `prefers-reduced-motion` |
| Accessibilité | ✅ | lien d'évitement, focus toujours visible, navigation clavier, modales `role="dialog"` + Échap, échappement HTML systématique |
| Paiement, réservation, contrat en ligne | ⛔ | **absent du périmètre** : aucun moyen de paiement n'est intégré ; la mise en relation s'arrête au devis et à la messagerie |

## 5. Technologies

Ce qui est réellement dans le dépôt — pas de liste théorique :

- **HTML5** — 23 pages, multi-pages réel (pas de routeur, pas de SPA).
- **CSS3** natif — 12 feuilles : tokens de thème (`--accent`, `--surface`, thème sombre par
  `data-theme`), `grid`, `clamp()`, requêtes de médias. **Aucun framework CSS, aucune classe
  utilitaire générée** (vérifié : zéro occurrence de Bootstrap dans le dépôt).
- **JavaScript ES modules natif** — 35 modules, `import`/`export`, top-level `await`. Aucun
  bundler, aucune étape de compilation, `package.json` ne déclare aucune dépendance.
- **Supabase** — client `supabase-js` servi en local (`assets/vendor/`), adaptateur de données
  et authentification dans [assets/js/core/](assets/js/core/).
- **GSAP + ScrollTrigger** — animations d'apparition, pilotées depuis
  [assets/js/core/ui.js:141](assets/js/core/ui.js#L141), désactivées si le mouvement réduit est demandé.
- **PWA / Service Worker** — [manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js),
  icônes 192 / 512 / SVG.
- **Polices auto-hébergées** — Syne (titres) et Plus Jakarta Sans (interface) en `woff2` local,
  pour éviter une requête vers un CDN sur les connexions lentes.
- **Node.js (outillage)** — serveur de développement sans dépendance
  ([tools/serve.js](tools/serve.js)), générateur de seed ([tools/export-seed.mjs](tools/export-seed.mjs)),
  exécution des tests avec le `node:test` natif.
- **Git / GitHub** — historique de 29 commits sur la branche `main`.

**En chiffres :** ~7 400 lignes de HTML/CSS/JS écrits à la main (hors bibliothèques
`assets/vendor/`), 23 pages, 3 rôles, 3 fichiers SQL.

## 6. Installation locale

### Prérequis

**Node.js 18 ou plus récent.** C'est tout : aucune installation de dépendance (`npm install` est
inutile — le `package.json` ne déclare aucun paquet), aucun build, aucun framework.

### Lancer l'application

```bash
git clone https://github.com/arthurdevcod02/eventis.git
cd eventis

node tools/serve.js              # → http://localhost:4173
PORT=8080 node tools/serve.js    # autre port
```

Ouvrir **http://localhost:4173**. Arrêter le serveur avec `Ctrl+C`.

### Comptes de démonstration

Mot de passe commun : `demo1234` (la page de connexion propose une case « Afficher les
identifiants démo » qui remplit ces comptes en un clic).

| Rôle | E-mail |
|---|---|
| Client | `client@demo.tg` |
| Prestataire | `prestataire@demo.tg` |
| Administrateur | `admin@demo.tg` |

Le jeu de démonstration contient 10 prestataires de Lomé, leurs services, des demandes, des
messages et des avis — dont un avis en attente de modération, pour montrer la file administrative.
**Toutes les données sont fictives** : e-mails en `@demo.tg` / `@example.tg`, téléphones
normalisés non attribués, photos générées.

### Exécuter les tests

```bash
node --test "tests/*.test.js"
```

48 tests natifs : couche de données (mode démo), authentification démo et contrat OAuth
(`signInWithGoogle`, profil en attente, complément d'inscription), contrat de garde de session
Supabase, helpers de redirection Google, formats français (`Intl`, FCFA, dates).

## 7. Configuration Supabase (mode réel)

⚠️ **À lire avant de commencer :** ces fichiers SQL n'ont **jamais été exécutés sur une véritable
instance** — ni `schema.sql`, ni `rls.sql`, ni `seed.sql` (aucun Postgres disponible sur la
machine de développement, installation non autorisée). Ils ont été relus ligne à ligne, et cette
relecture a corrigé quatre trous de sécurité réels, mais **le mode réel doit être considéré comme
non validé** tant que la procédure ci-dessous n'a pas été jouée une fois sur un vrai projet.

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans le **SQL Editor**, exécuter dans cet ordre :
   - [`supabase/schema.sql`](supabase/schema.sql) — tables et contraintes,
   - [`supabase/rls.sql`](supabase/rls.sql) — règles de sécurité au niveau ligne + déclencheurs
     de modération,
   - [`supabase/seed.sql`](supabase/seed.sql) — jeu de démonstration (facultatif).
3. Renseigner dans [`assets/js/core/config.js`](assets/js/core/config.js) :
   `SUPABASE_URL` (URL du projet) et `SUPABASE_ANON_KEY` (**clé anonyme**, jamais la clé `service_role`).
4. Dans **Authentication → Sign In / Providers → Email**, « Confirm email » peut être **activé ou
   désactivé** : les deux parcours sont gérés. Désactivé, l'inscription ouvre une session et écrit
   la ligne `profiles` immédiatement. Activé, aucune session n'existe encore — et la politique RLS
   « profiles self insert » (`id = auth.uid()`) refuse toute écriture : l'application conserve donc
   le nom, le téléphone, le rôle et la version des CGU dans les **métadonnées** du compte, affiche
   « Confirmez votre adresse e-mail », et écrit le profil au retour du lien, sur la page de
   connexion (l'écran de rôle reprend le rôle choisi).
5. **Authentication → URL Configuration** : *Site URL* et *Redirect URLs*, listés au §7bis (ils
   décident où atterrissent le lien de confirmation d'inscription et le lien « Mot de passe oublié »).
6. Recharger la page : la bannière « Mode démonstration » disparaît, les données viennent de
   Supabase. Laisser les deux champs vides ramène au mode démonstration.

**Notes propres à ce projet**

- `seed.sql` crée aussi les lignes `auth.users` correspondantes (mot de passe `demo1234`) : sans
  elles, les `profiles` inserés violent la clé étrangère vers `auth.users` et **tout le script
  échoue**. Ce fichier est généré : `node tools/export-seed.mjs > supabase/seed.sql`.
- **Projet déjà provisionné avant l'ajout de la colonne `email`** : la table `profiles` ne l'a
  pas et l'inscription échoue à l'insertion. Corriger une fois :

  ```sql
  alter table public.profiles add column email text;
  update public.profiles p set email = u.email from auth.users u where p.id = u.id;
  ```

**Ce qui reste indisponible tant que cette configuration n'est pas faite :** persistance partagée
entre navigateurs, e-mail de réinitialisation de mot de passe, consultation des messages de
contact ailleurs que dans le navigateur qui les a saisis. Tout le reste fonctionne en démo.

## 7bis. Connexion Google (OAuth) — ce qui est fait, ce qui reste à configurer

**Ce qui est en place dans le code**

- Bouton **« Continuer avec Google »** sur [`auth/connexion.html`](auth/connexion.html) et
  [`auth/inscription.html`](auth/inscription.html), à côté de la connexion e-mail/mot de passe
  (inchangée). La connexion classique reste le chemin principal ; Google s'y ajoute.
- [`assets/js/core/oauth.js`](assets/js/core/oauth.js) porte les helpers sans DOM : URL de retour
  calculée depuis `location.origin` (la même ligne fonctionne en local et en production, sans
  constante d'environnement), contrôle anti-redirection ouverte (`safeNext` : chemins internes
  uniquement), intention de retour conservée en `sessionStorage`, et messages d'erreur français
  pour les pannes réellement observables (fournisseur non activé, URL de retour refusée, Supabase
  injoignable).
- Le rôle **n'est jamais attribué automatiquement** : au retour de Google, si aucune ligne
  `profiles` n'existe pour la session, la page d'authentification ouvre un écran « Je viens… »
  qui propose **client** ou **prestataire** et attend une confirmation explicite. Un compte Google
  ne peut pas devenir administrateur par ce chemin — la liste des rôles proposés l'exclut,
  `completeSignup()` le refuse, et côté base la politique RLS d'auto-insertion (`role <> 'admin'`)
  plus le déclencheur `guard_profile_privileges` réécrivent toute tentative.
- En **mode démonstration**, le bouton reste visible et un clic affiche ce message, sans
  simulation de session : « Connexion Google indisponible en mode démonstration : elle exige un
  projet Supabase avec le fournisseur Google activé. Utilisez les comptes de démonstration. »

**Ce qui n'est PAS encore opérationnel**

Le trajet réseau Google (consentement, échange du code, retour réel) **n'a jamais été exercé** :
il exige un projet Supabase et un client OAuth Google, deux choses qui n'existent pas encore.
Aucune donnée de session Google n'a été fabriquée pour faire croire au contraire.

**Configuration à réaliser (dans cet ordre)**

1. [Google Cloud Console](https://console.cloud.google.com) → *APIs & Services → Credentials* →
   **Create Credentials → OAuth client ID**, type *Web application*.
   - *Authorized JavaScript origins* : `http://localhost:4173` et l'URL du site en production.
   - *Authorized redirect URIs* : `https://<projet>.supabase.co/auth/v1/callback` (l'URL exacte est
     donnée par Supabase à l'étape 3).
   - Noter le **Client ID** et le **Client secret**.
2. Supabase → **Authentication → URL Configuration** :
   - *Site URL* : `https://<domaine>` (production),
   - *Redirect URLs* : les quatre retours attendus par l'application, chacun en local **et** en
     production —
     `http://localhost:4173/auth/connexion.html` et `https://<domaine>/auth/connexion.html`
     (retour Google et retour du lien de confirmation d'inscription),
     `http://localhost:4173/auth/reinitialisation.html` et
     `https://<domaine>/auth/reinitialisation.html` (lien « Mot de passe oublié »).
     Une `redirectTo` absente de cette liste est **silencieusement remplacée** par le *Site URL* :
     le lien tombe alors sur l'accueil au lieu du formulaire attendu.
3. Supabase → **Authentication → Sign In / Providers → Google** : activer le fournisseur et coller
   le Client ID / Client secret de l'étape 1.
4. Revenir sur la page de connexion et cliquer « Continuer avec Google » : le consentement
   s'ouvre, le retour ramène sur `connexion.html`, l'écran de rôle demande client ou prestataire.
   Le premier essai réel est le test qui manque.

**Rappels utiles**

- « Confirm email » ne bloque plus l'inscription (voir §7, point 4) : le compte connecté sans ligne
  `profiles` est exactement l'état que l'écran de rôle sait compléter, qu'il arrive de Google ou du
  lien de confirmation.
- Le nom affiché sur cet écran vient des métadonnées du fournisseur (`user_metadata.full_name`,
  sinon `name`, sinon la partie locale de l'adresse e-mail).
- Un compte Google suspendu par un administrateur est déconnecté dès la tentative d'accès.

## 8. Sécurité

**Ce qui est en place dans le code**

- **Clé anonyme uniquement.** [`assets/js/core/config.js`](assets/js/core/config.js) ne contient
  que des chaînes vides dans le dépôt ; la clé `service_role` ne doit **jamais** y figurer. La
  protection des données vient des règles RLS, pas du secret de la clé.
- **Règles RLS** ([`supabase/rls.sql`](supabase/rls.sql)) : lecture publique restreinte aux
  prestataires approuvés, écritures réservées au propriétaire de la fiche ou de la demande,
  avis insérables uniquement par le client concerné, modération réservée aux administrateurs.
- **Deux déclencheurs de modération**, parce qu'une politique RLS ne peut pas comparer l'ancienne
  et la nouvelle valeur d'une ligne : `providers.status`, `providers.is_verified`,
  `profiles.role` et `profiles.suspended` sont remis à leur valeur précédente si l'auteur de la
  requête n'est pas administrateur. Un prestataire ne peut donc pas approuver sa propre fiche ni
  se décerner le badge « Vérifié » ; un compte ne peut pas se promouvoir admin ni lever sa propre
  suspension.
- **Identité d'expéditeur contrôlée** : un message ne peut être inséré qu'avec
  `sender_id = auth.uid()`, donc pas d'usurpation dans le fil d'un autre participant.
- **Échappement HTML systématique** (`esc()` dans `ui.js`) : une charge utile
  `<img src=x onerror=…>` saisie dans un formulaire reste du texte affiché, jamais exécuté
  (contrôlé côté inscription, profil et tableau admin).
- **Service worker strict** : uniquement les `GET` de la même origine, aucune mise en cache des
  URLs paramétrées, `sw.js` jamais caché, et les appels vers `*.supabase.co` explicitement exclus.

**Ce qui n'est pas prouvé — à vérifier avant toute mise en production**

- L'exécution réelle de `schema.sql`, `rls.sql` et `seed.sql` sur une instance Supabase, et le
  parcours complet en mode réel (inscription, session qui expire, accusés de lecture, modération).
- Un audit de sécurité indépendant : la relecture et les tests couverts ici ne remplacent pas un
  pentest.
- Les en-têtes HTTP de production (CSP, HSTS) : le serveur de développement ne les pose pas ;
  cela relève de l'hébergeur.
- La protection contre l'abus du formulaire de contact (pas de limite de débit côté serveur).
- Le trajet OAuth Google de bout en bout (consentement réel, échange du code, retour sur
  `connexion.html`) : seul le câblage applicatif est éprouvé, par simulation avec un faux client
  (§7bis). L'interdiction faite à un compte Google de devenir administrateur repose sur trois
  garde-fous (liste de rôles côté application, politique RLS d'auto-insertion, déclencheur
  `guard_profile_privileges`), dont les deux derniers restent à valider sur une instance réelle.

## 9. Tests et état du projet

Phase 1 terminée, fusionnée dans `main`. Résultats ci-dessous **réellement obtenus par exécution**
le 15 octobre 2026, sur le code de la branche `main` :

| Campagne | Portée | Résultat |
|---|---|---|
| `node --test "tests/*.test.js"` | couche de données, authentification démo et contrat OAuth, gardes, formats `Intl` | **48 / 48** |
| QA écran headless | 23 pages : statuts HTTP, erreurs console, requêtes hors origine, débordements de 360 à 1440 px, clavier Tab/Échap, focus visibles, lien d'évitement, modales, échappement XSS, gardes de session, hors ligne, `config.js` vide, mouvement réduit | **47 / 47** |
| QA parcours d'écriture | inscription + validation de formulaires, persistance du profil, envoi de devis (date passée refusée), acceptation prestataire, messagerie aller-retour et accusés de lecture, clôture, avis → modération → publication → affichage public, badge « Vérifié », suspension prestataire et utilisateur, catégories, formulaire de contact, cloisonnement des rôles | **42 / 42** |
| QA Google (mode démonstration) | bouton présent sur les deux pages, message honnête au clic, aucune session fabriquée, connexion e-mail toujours fonctionnelle, mise en page et contrastes mesurés à 6 largeurs | **21 / 21** |
| QA Google (retour simulé, mode réel) | faux client Supabase injecté côté navigateur : session sans profil → écran de rôle, nom repris des métadonnées, aucune écriture avant confirmation, confirmation client (1 ligne `profiles`) et prestataire (`profiles` + `providers`), `?next` retrouvé, intention nettoyée, « Utiliser un autre compte », absence d'intention = page inchangée, clic Google → consentement avec `redirectTo` et `skipBrowserRedirect` | **24 / 24** |
| Contrôle du menu compte | ouvert/fermé, Échap, clic extérieur, 4 pages | **9 / 9** |
| Erreurs JavaScript | cumulé sur les campagnes ci-dessus | **0** |

La campagne « retour simulé » éprouve le **câblage de la page** (détection, écran de rôle,
écritures demandées, redirection) avec un faux client : elle ne prouve **pas** le trajet réseau
Google, qui demande un vrai fournisseur configuré (§7bis).

Trois défauts trouvés pendant cette phase de publication et corrigés depuis (`b5592bc`,
`232d13a`, `30c965c`) : un débordement horizontal de 2 px à 360 px sur la fiche prestataire
connectée, un menu du compte qui restait affiché en permanence (`display: grid` neutralisait
l'attribut `hidden`), et l'impossibilité de le refermer au clavier. Les trois campagnes ont été
rejouées après correction.

**Limites connues, assumées et non masquées**

- **Navigateurs** : seul **Chrome** a été piloté. **Firefox, Safari et Edge ne sont pas testés** —
  rien n'est revendiqué à leur sujet.
- **Supabase** : **non testé sur une instance réelle** (voir §7 et §8). Le mode réel est donc
  documenté, pas garanti.
- **Google OAuth** : chemin codé et simulé, **jamais exécuté contre le vrai fournisseur** — ni
  consentement, ni échange de code, ni retour réel (voir §7bis).
- **PWA** : manifeste et service worker validés par mesure interne ; l'invite « Installer
  l'application » n'est pas observable en headless et reste à confirmer sur mobile en HTTPS.
- **Photos** : visuels de démonstration générés (≈ 1,9 Mo au total, ré-encodés pour les connexions
  lentes), pas des prestations réelles.
- **Messagerie** : non temps réel (pas de notification push).
- **Périmètre** : pas de paiement, de réservation ni de contrat en ligne.

## 10. Roadmap

**Déjà fait (phase 1 — terminée)** : fondations et design system maison, catalogue et fiches,
authentification et trois rôles, espaces client / prestataire / administrateur, demandes de devis,
messagerie par fils, boucle d'avis complète avec modération, mode sombre, animations, PWA hors
ligne, README et documentation d'installation, tests Node + QA headless, règles RLS et déclencheurs
de modération.

**Prochain pas — avant toute mise en production**

1. Exécuter `schema.sql`, `rls.sql` et `seed.sql` sur un vrai projet Supabase et rejouer le
   parcours complet en mode réel (c'est la condition pour retirer la mention « non testé »).
2. Passer les politiques RLS au crible avec un second regard (test d'élévation de privilège).
3. Vérifier Firefox et Safari sur les parcours critiques et l'installabilité PWA en HTTPS.
4. Ajouter un écran d'administration pour les messages du formulaire de contact.

**Évolutions envisagées (phase 2+, non commencées)**

- Notifications (nouveau message, réponse à une demande) — Supabase Realtime ou e-mail.
- Calendrier / disponibilités des prestataires et pré-réservation de date.
- Vérification d'identité documentée (pièces justificatives) pour renforcer le badge « Vérifié ».
- Paiement ou acompte en ligne — **décision produit à prendre**, aucun moyen de paiement n'est
  intégré à ce jour.
- Multilingue (le socle est en français seul), SEO et pages catégories indexables.
- Tableaux de bord d'aide à la décision pour l'équipe (conversion des devis, catégories porteuses).

## 11. Auteur

**Nandja TANTE-NAKPANE** — développement, design et produit.

- GitHub : [@arthurdevcod02](https://github.com/arthurdevcod02)
- Profil : https://github.com/arthurdevcod02
- *À compléter par l'auteur : e-mail professionnel, LinkedIn, portfolio, autres réseaux.*

## 12. Licence

**Tous droits réservés (All rights reserved).** Aucun fichier `LICENSE` n'est distribué avec ce
projet : le code, les visuels et la documentation restent la propriété de leur auteur. Le présent
dépôt est publié à des fins de démonstration technique — le consulter, l'étudier et le cloner pour
un usage privé est autorisé ; **toute reproduction, réutilisation, redistribution ou exploitation
commerciale nécessite une autorisation écrite préalable.**

## 13. Contribution

Le projet n'ouvre pas de flux de contributions à ce stade. Pour un retour, une anomalie constatée
ou une proposition de collaboration : ouvrir une **issue** sur ce dépôt, ou contacter l'auteur via
son profil GitHub.

---

### Annexe — organisation du code

```
assets/css/            tokens de thème (clair/sombre), base, composants, pages
assets/js/core/        config, db (adaptateur démo / Supabase), auth, ui, guards, seed
assets/js/components/  navbar, footer, modale, messagerie, actions admin
assets/js/pages/       un module par page
assets/vendor/         GSAP, ScrollTrigger, supabase-js — fichiers locaux
assets/fonts/          Syne et Plus Jakarta Sans, servies en local
assets/screenshots/    captures du README
supabase/              schema.sql, rls.sql, seed.sql
tools/                 serve.js (serveur de développement), export-seed.mjs
tests/                 tests Node natifs (node:test)
docs/superpowers/      spec de design et plan d'implémentation de la phase 1
```

### Annexe — mettre en ligne (Netlify)

Le site est statique, mais **le dépôt ne se publie pas tel quel** : il contient `node_modules`
(32 Mo), les scripts SQL, les tests et la documentation d'agent. `tools/build-dist.mjs` assemble
dans `dist/` les 23 pages et les ressources du site uniquement (2,62 MiB), et refuse d'écrire le
résultat si une cible HTML manque ou si un fichier interdit s'y glisse.

```bash
node tools/build-dist.mjs          # produit dist/
PORT=4180 node tools/serve.js      # (depuis dist/) vérifier le site assemblé
```

Déploiement :

1. Créer un compte Netlify, **Import an existing project** → choisir le dépôt `eventis`.
2. Netlify lit [`netlify.toml`](netlify.toml) à la racine : commande de build
   `node tools/build-dist.mjs`, dossier public `dist`, Node 22, « pretty URLs » désactivées
   (les URLs gardent leur `.html`, ce qui doit correspondre exactement au retour OAuth déclaré).
3. Laisser les champs d'environnement vides : la configuration est dans
   `assets/js/core/config.js`, pas dans l'hébergeur. **Ne pas y mettre de clé `service_role`.**
4. Après le premier déploiement, Netlify attribue `https://<nom-du-site>.netlify.app`. Noter cette
   URL : c'est la valeur `<domaine>` des §7 et §7bis (Site URL, Redirect URLs, origines Google).
5. Domaines : ajouter un domaine dans les paramètres Netlify si besoin ; HTTPS est fourni
   automatiquement, condition du service worker et de l'installation PWA.

Contrôles rejoués sur le site **assemblé** (14 contrôles, tous verts) : les 24 URLs de pages
répondent, aucun fichier interne du dépôt n'est atteignable (`supabase/`, `tests/`, `docs/`,
`node_modules/`, `README.md` → 404), connexion de démonstration fonctionnelle, bouton Google
présent sur les deux pages et honnête en démo, service worker enregistré, manifeste référencé,
aucune requête hors de l'origine, aucune erreur console.

**Contrôles rejoués sur le site en ligne** (`https://eventis-app.netlify.app`, mode démonstration) :
les 23 pages HTML répondent, les fichiers internes du dépôt sont inaccessibles, les trois règles
d'en-têtes de `netlify.toml` sont appliquées, la page 404 personnalisée répond avec un vrai statut
404, `/auth/connexion.html` conserve son extension, `config.js` publié ne contient aucune clé, la
connexion de démonstration mène bien à `/compte/` avec le nom du compte et survit à un rechargement,
le service worker est enregistré et activé, le manifeste est servi en `application/manifest+json`,
aucune erreur console sur `/compte/`, `/compte/messages.html` et `/catalogue.html`.

**Ce qui n'est pas encore vérifié** : le parcours connecté prestataire et administrateur en ligne,
l'invite d'installation PWA, et surtout **tout ce qui dépend de Supabase en réel** — les scripts
`supabase/schema.sql`, `rls.sql` et `seed.sql` n'ont jamais été exécutés sur une instance, et
l'échange réseau OAuth Google n'a jamais eu lieu. Le site est publié **en mode démonstration**.
