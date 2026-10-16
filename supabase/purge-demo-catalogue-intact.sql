-- Eventis — purge des comptes de démonstration EN CONSERVANT le catalogue public.
--
-- Pourquoi ce fichier existe : supabase/seed.sql est publié dans le dépôt GitHub et le
-- README donne « admin@demo.tg / demo1234 ». Tant que ces 14 comptes existent sur le
-- projet en ligne, n'importe qui peut ouvrir une session — y compris une session
-- administratrice — avec des identifiants publics. C'est un trou de contrôle d'accès,
-- pas une simple curiosité. La purge est donc une correction de sécurité, et la fermer
-- sans vider le site est possible : les fiches et les prestations sont des *contenus*,
-- elles peuvent être réattachées à un compte qui survit.
--
-- Ce que fait ce fichier, dans cet ordre :
--   1. il vérifie qu'un administrateur HORS démo survit (sinon il refuse tout) ;
--   2. il réattache au compte admin conservé les 10 fiches de démonstration ;
--   3. il réattache au même compte les avis écrits par les clients de démonstration,
--      en détachant leur référence de demande (les demandes de démo, elles, sont supprimées) ;
--   4. il supprime demandes et messages de démonstration ;
--   5. il supprime les 14 profils et les 14 comptes de connexion.
--
-- Effet visible : /catalogue.html, /prestataire.html et les cartes d'accueil restent
-- peuplées (10 fiches, 14 prestations, 8 catégories, avis conservés). Seule la
-- connexion de démonstration disparaît. Contrepartie à connaître : la file d'avis de
-- /admin/avis.html joint le nom du compte auteur (db.js:777) — les avis de démo
-- réattachés afficheront donc le nom de ton compte admin, alors que le public ne voit
-- jamais de nom (déc produit « avis anonymes », db.js:745 qui renvoie clientName vide).
--
-- Ce que NE fait pas ce fichier : il ne touche ni aux catégories, ni aux prestations, ni
-- aux fiches réelles, ni aux messages du formulaire de contact, ni à la table
-- site_settings (le drapeau de maintenance conserve sa valeur). Si tu veux au contraire
-- un catalogue vide — choix honnête si le site doit se présenter sans contenu fictif —,
-- c'est purge-demo-catalogue-vide.sql, pas celui-ci.
--
-- Prérequis AVANT d'exécuter : un compte administrateur réel doit exister.
--   a) inscris-toi sur /auth/inscription.html avec ta vraie adresse ;
--   b) dans l'éditeur SQL : update public.profiles set role = 'admin' where email = 'ton@adresse.tg';
--   c) lance purge-etat-des-lieux.sql et confirme que « administrateurs_survivants » vaut bien 1.
--
-- Un seul bloc « do » = tout ou rien : si une vérification échoue, rien n'a été modifié.

do $$
declare
  v_demo constant uuid[] := array[
    'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9',
    '184d929d-42f8-98e7-0607-f44e11b24b61', '8812856e-0369-fe6b-1729-6ea03a6bb811',
    '88fa67ac-f20f-7fc1-597f-ee55f12c017c', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
    'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
    '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
    'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
    '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[];
  v_cibles uuid[];
  v_fiches uuid[];
  v_demandes uuid[];
  v_admin uuid;
  n_admins_hors_demo integer;
  n integer;
begin
  select array_agg(u.id) into v_cibles from auth.users u where u.id = any (v_demo);
  if v_cibles is null then
    raise exception 'Aucun des 14 comptes de démonstration n''existe sur ce projet : rien à purger, aucune écriture exécutée.';
  end if;
  raise notice 'comptes de démonstration présents : % sur %', array_length(v_cibles, 1), array_length(v_demo, 1);

  -- Le destinataire des contenus conservés : un administrateur non suspendu qui ne fait
  -- pas partie de la liste ci-dessus. admin@demo.tg étant dans la liste, il ne peut pas
  -- se choisir lui-même — c'est exactement ce qu'on cherche.
  select count(*) into n_admins_hors_demo from public.profiles p
    where p.role = 'admin' and not p.suspended and not (p.id = any (v_demo));
  if n_admins_hors_demo = 0 then
    raise exception 'Garde-fou : aucun administrateur hors démonstration. /admin et la bascule de maintenance appartiennent aujourd''hui au seul compte admin@demo.tg, que cette purge supprime. Crée d''abord ton compte réel (inscription) puis promeus-le : update public.profiles set role = ''admin'' where email = ''ton@adresse''; Puis relance ce fichier. Rien n''a été modifié.';
  end if;
  if n_admins_hors_demo > 1 then
    raise notice 'attention : % administrateurs hors démo, le plus ancien reçoit les fiches', n_admins_hors_demo;
  end if;

  select p.id into v_admin from public.profiles p
    where p.role = 'admin' and not p.suspended and not (p.id = any (v_demo))
    order by p.created_at limit 1;

  -- Les identifiants des fiches et des demandes de démo sont figés AVANT toute écriture :
  -- après le réattachage des fiches, providers.profile_id ne pointerait plus vers un compte
  -- visé et les requêtes « où le compte est un compte de démo » ne rapporteraient plus rien,
  -- laissant des demandes orphelines dans la base.
  select coalesce(array_agg(pr.id), '{}'::uuid[]) into v_fiches
    from public.providers pr where pr.profile_id = any (v_cibles);
  select coalesce(array_agg(r.id), '{}'::uuid[]) into v_demandes
    from public.requests r
   where r.client_id = any (v_cibles) or r.provider_id = any (v_fiches);
  raise notice 'fiches à réattacher : %, demandes à supprimer : %',
    array_length(v_fiches, 1), array_length(v_demandes, 1);

  -- Détacher les avis de leurs demandes avant de supprimer celles-ci : reviews.request_id
  -- n'a pas de cascade (schema.sql:74), la suppression échouerait sinon. Les avis eux-mêmes
  -- survivent, rattachés à une fiche qui survit.
  update public.reviews rv set request_id = null
    where rv.request_id = any (v_demandes) and rv.request_id is not null;
  get diagnostics n = row_count;
  raise notice 'avis détachés de leur demande de démo : %', n;

  update public.reviews rv set client_id = v_admin
    where rv.client_id = any (v_cibles);
  get diagnostics n = row_count;
  raise notice 'avis réattachés au compte conservé : %', n;

  delete from public.messages m
   where m.sender_id = any (v_cibles) or m.request_id = any (v_demandes);
  get diagnostics n = row_count;
  raise notice 'messages supprimés : %', n;

  delete from public.requests r where r.id = any (v_demandes);
  get diagnostics n = row_count;
  raise notice 'demandes supprimées : %', n;

  update public.providers pr set profile_id = v_admin
    where pr.profile_id = any (v_cibles);
  get diagnostics n = row_count;
  raise notice 'fiches réattachées au compte conservé : %', n;

  delete from public.profiles p where p.id = any (v_cibles);
  get diagnostics n = row_count;
  raise notice 'profils supprimés : %', n;

  -- Le profil est déjà parti : il ne reste que la ligne d'authentification. Identités,
  -- sessions et jetons du schéma auth sont rattachés à auth.users en cascade ; si une
  -- version de Supabase refusait pourtant la suppression directe, CE bloc échoue et tout
  -- le fichier revient en arrière — rien de semi-supprimé. Repli dans ce cas : supprimer
  -- les comptes un par un depuis Supabase → Authentication → Users, qui fait la même
  -- chose par l'API.
  delete from auth.users u where u.id = any (v_cibles);
  raise notice 'comptes de démonstration supprimés : %', row_count;
end $$;

-- Preuve : les identifiants de démo doivent avoir disparu d'auth.users, et le catalogue
-- doit compter les mêmes lignes qu'avant (10 fiches, 14 prestations, 8 catégories).
select
  (select count(*) from auth.users u where u.id = any (array[
    'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9',
    '184d929d-42f8-98e7-0607-f44e11b24b61', '8812856e-0369-fe6b-1729-6ea03a6bb811',
    '88fa67ac-f20f-7fc1-597f-ee55f12c017c', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
    'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
    '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
    'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
    '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[]))
    as comptes_de_demo_restants,
  (select count(*) from public.profiles where role = 'admin')                as administrateurs,
  (select count(*) from public.categories)                                   as categories,
  (select count(*) from public.providers)                                    as fiches,
  (select count(*) from public.services)                                     as prestations,
  (select count(*) from public.reviews)                                      as avis,
  (select count(*) from public.reviews where visible)                         as avis_visibles,
  (select count(*) from public.requests)                                      as demandes,
  (select count(*) from public.providers pr join public.profiles p on p.id = pr.profile_id
     where p.role = 'admin')                                                 as fiches_la_propriete_d_un_admin;
