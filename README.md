# Eventis

**L'excellence événementielle, connectée et sécurisée.**

Plateforme de mise en relation entre clients et prestataires événementiels, conçue pour le
Togo (Lomé) et l'Afrique de l'Ouest. Les prix sont en FCFA, l'interface est intégralement en
français, et l'ensemble est pensé pour rester utilisable sur des connexions lentes.

Principe directeur du projet : **aucune fonctionnalité n'est présentée comme opérationnelle si
elle ne l'est pas réellement.** Le badge « Vérifié » vient d'une décision prise dans l'espace
d'administration, pas d'un champ de démonstration.

---

## 1. Ce qui est inclus

| Domaine | État |
|---|---|
| Catalogue (recherche, filtres catégorie / quartier / budget / note / vérifié, tri) | opérationnel |
| Fiche prestataire (galerie, services & tarifs, avis, demande de devis) | opérationnel |
| Comptes client / prestataire / administrateur, inscription, connexion | opérationnel |
| Demandes de devis : envoi, acceptation, refus, clôture | opérationnel |
| Messagerie par fil de discussion (liée à une demande) | opérationnel — **pas de temps réel**, rechargement à la demande |
| Avis : dépôt après demande clôturée, file de modération, publication | opérationnel |
| Administration : statistiques, approbation / suspension de prestataires, comptes, catégories, avis | opérationnel |
| Mode sombre, animations, PWA (manifeste + service worker hors ligne) | opérationnel |
| **Paiement en ligne** | **absent du périmètre** — aucun moyen de paiement n'est intégré |

Deux modes de fonctionnement, interchangeables sans changer le code des pages :

- **Mode démonstration** (par défaut) : tout est stocké dans le navigateur (`localStorage`),
  aucun serveur ni base de données n'est nécessaire. Une bannière « Mode démonstration »
  rappelle en permanence que les données sont fictives.
- **Mode réel** : Supabase (authentification + PostgreSQL + règles de sécurité au niveau ligne).

## 2. Prérequis et lancement

Node.js 18 ou plus récent suffit. **Il n'y a aucune installation de dépendance, aucun build et
aucun framework** : le site est en HTML, CSS et JavaScript modules natifs.

```bash
node tools/serve.js            # http://localhost:4173
PORT=8080 node tools/serve.js  # autre port
```

Tests (27 tests natifs : couche de données, authentification démo et contrat de garde de
session Supabase, formats français) :

```bash
node --test "tests/*.test.js"
```

### Comptes de démonstration

Mot de passe commun : `demo1234`

| Rôle | E-mail |
|---|---|
| Client | `client@demo.tg` |
| Prestataire | `prestataire@demo.tg` |
| Administrateur | `admin@demo.tg` |

La page de connexion propose une case « Afficher les identifiants démo » qui remplit ces
comptes en un clic. Le jeu de démonstration contient 10 prestataires de Lomé, leurs services,
des demandes, des messages et des avis, dont un avis en attente de modération pour montrer la
file administrative.

## 3. Basculer sur Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans le **SQL Editor**, exécuter dans cet ordre :
   - [`supabase/schema.sql`](supabase/schema.sql) — tables et contraintes,
   - [`supabase/rls.sql`](supabase/rls.sql) — règles de sécurité au niveau ligne,
   - [`supabase/seed.sql`](supabase/seed.sql) — jeu de démonstration (facultatif).
3. Renseigner dans [`assets/js/core/config.js`](assets/js/core/config.js) :
   `SUPABASE_URL` (URL du projet) et `SUPABASE_ANON_KEY` (**clé anonyme**).
4. Recharger la page : la bannière « Mode démonstration » disparaît, les données viennent de
   Supabase. Laisser les deux champs vides ramène au mode démonstration.

`seed.sql` crée aussi les lignes `auth.users` correspondantes (mot de passe `demo1234`), sans
quoi les `profiles` inserés violent la clé étrangère vers `auth.users` et **tout le script
échoue**. Ce fichier est généré : `node tools/export-seed.mjs > supabase/seed.sql`.

**Projet déjà provisionné avant l'ajout de la colonne `email`** : la table `profiles` n'a pas
cette colonne et l'inscription échoue à l'insertion. Corriger une fois :

```sql
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where p.id = u.id;
```

### Sécurité

- **Ne jamais mettre la clé `service_role` dans le code.** Seule la clé anonyme, publique par
  conception, est utilisée ; la protection des données vient des règles RLS.
- `config.js` fait partie du dépôt : **retirer les clés du fichier avant tout commit ou
  partage**, ou passer par un fichier ignoré par Git.
- Un mot de passe oublié en mode démonstration n'envoie aucun e-mail : la page le dit et
  renvoie vers les comptes de démonstration. En mode réel, l'e-mail est envoyé par Supabase
  (configurer l'URL du site dans Authentication → URL Configuration).

## 4. Mettre en ligne

Le projet est statique : n'importe quel hébergeur convient (Netlify, Vercel, Cloudflare Pages,
GitHub Pages…). Copier la racine du dépôt telle quelle, sans commande de build.

- **HTTPS obligatoire** pour le service worker, le manifeste et l'installation PWA.
- Configurer les **redirections 404 → `/404.html`** si l'hébergeur ne le fait pas déjà ; le
  serveur de développement, lui, renvoie le vrai statut HTTP.
- En mode réel, ajouter l'URL du site dans les **redirect URLs** de Supabase (Authentification).

## 5. Organisation du code

```
assets/css/        tokens (thème clair/sombre), base, composants, pages
assets/js/core/    config, db (adaptateur démo / Supabase), auth, ui, guards
assets/js/components/  navbar, footer, modale, messagerie, actions admin
assets/js/pages/   un module par page
assets/vendor/     GSAP, ScrollTrigger, supabase-js (fichiers locaux)
assets/fonts/      Syne et Plus Jakarta Sans, servies en local
supabase/          schema.sql, rls.sql, seed.sql
tools/             serve.js (serveur de dev), export-seed.mjs
tests/             tests Node natifs
```

## 6. Navigateurs et vérifications

**Ce qui a été testé :** Chrome de bureau (1440 px) et Chrome en émulation mobile (360, 390,
641, 700, 841, 1024 px), en clair et en sombre, avec 47 contrôles automatisés sur les 23 pages
(statuts HTTP, erreurs console, requêtes réseau, débordements, clavier Tab/Échap, focus
visibles, lien d'évitement, modales, formats `Intl` français, échappement HTML, gardes de
session, hors ligne).

**Ce qui n'a pas pu être testé ici — à vérifier de votre côté :**

- **Firefox, Safari et Edge** : aucun de ces navigateurs n'était pilotable sur la machine de
  développement. Les tests se limitent à Chrome. Rien n'a été écrit « testé sur Firefox » faute
  de preuve.
- **Installabilité PWA** : le manifeste et le service worker sont validés, mais la fenêtre
  « Installer l'application » n'apparaît pas en headless ; elle demande un vrai Chrome sur HTTPS.
- **Trafic Supabase réel** : les appels réseau n'ont pas été exercés contre un projet Supabase ;
  la bascule suppose donc un premier parcours manuel.

## 7. Limites assumées

- Pas de paiement, de réservation ni de contrat en ligne : la mise en relation s'arrête au devis
  et à la messagerie.
- Messagerie non temps réel : pas de notification push, recharger la page pour voir un nouveau
  message.
- Les photos de démonstration sont des visuels générés (1,9 Mo au total, ré-encodés pour les
  connexions lentes), pas des prestations réelles.
- Le badge « Vérifié » n'est attribué que par l'administrateur ; en mode démonstration, cette
  attribution reste locale au navigateur.
