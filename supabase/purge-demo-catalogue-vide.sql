-- Eventis — purge des comptes de démonstration ET du catalogue fictif.
--
-- Variante « site honnêtement vide » de purge-demo-catalogue-intact.sql : même motif de
-- sécurité (les 14 identifiants de seed sont publics dans le dépôt, donc n'importe qui peut
-- ouvrir une session, y compris administratrice), mais ici rien n'est réattaché. Les
-- contenus produits par le seed s'en vont avec les comptes qui les portaient.
--
-- Ce que ce fichier supprime : les 10 fiches de démonstration, les 14 prestations
-- (providers -> services est en cascade, schema.sql:43), les avis de démonstration,
-- les 4 demandes et les 8 messages de démonstration, les 14 profils et les 14 comptes de
-- connexion.
--
-- Ce qu'il conserve : les 8 catégories (une taxonomie réelle, pas un contenu fictif — le
-- formulaire de dépôt de fiche et l'admin en ont besoin), le formulaire de contact,
-- la table site_settings avec la valeur actuelle du drapeau de maintenance, et tout
-- compte réel.
--
-- Effet visible : /catalogue.html, /prestataire.html et l'accueil basculent sur leurs
-- états vides (« aucun prestataire pour cette recherche »). C'est le résultat voulu si le
-- site doit se présenter sans faire croire à un place de marché déjà peuplée ; ce n'est
-- pas un résultat voulu si les captures du README et le portfolio comptent sur un site peuplé.
--
-- Ne relance JAMAIS supabase/seed.sql sur ce projet après cette purge : il réinsère les 14
-- comptes avec le mot de passe « demo1234 » et rouvre exactement le trou qu'on ferme ici.
-- Le mode démo du navigateur (assets/js/core/seed.js) est une autre mécanique, sans compte
-- réel, et n'est pas concerné.
--
-- Prérequis, identique à l'autre variante : un compte administrateur réel doit exister,
-- sinon /admin et la bascule de maintenance disparaissent avec admin@demo.tg.
--   a) /auth/inscription.html avec ta vraie adresse ;
--   b) update public.profiles set role = 'admin' where email = 'ton@adresse.tg';
--   c) purge-etat-des-lieux.sql, et vérifier « administrateurs_survivants » = 1.
--
-- Un seul bloc « do » = tout ou rien.

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
  n_admins_hors_demo integer;
  n integer;
begin
  select array_agg(u.id) into v_cibles from auth.users u where u.id = any (v_demo);
  if v_cibles is null then
    raise exception 'Aucun des 14 comptes de démonstration n''existe sur ce projet : rien à purger, aucune écriture exécutée.';
  end if;
  raise notice 'comptes de démonstration présents : % sur %', array_length(v_cibles, 1), array_length(v_demo, 1);

  select count(*) into n_admins_hors_demo from public.profiles p
    where p.role = 'admin' and not p.suspended and not (p.id = any (v_demo));
  if n_admins_hors_demo = 0 then
    raise exception 'Garde-fou : aucun administrateur hors démonstration. Cette purge supprime admin@demo.tg et laisserait /admin sans accès. Crée d''abord ton compte réel (inscription) puis promeus-le : update public.profiles set role = ''admin'' where email = ''ton@adresse''; Puis relance ce fichier. Rien n''a été modifié.';
  end if;

  -- Figés avant toute écriture, pour les mêmes raisons que dans l'autre variante.
  select coalesce(array_agg(pr.id), '{}'::uuid[]) into v_fiches
    from public.providers pr where pr.profile_id = any (v_cibles);
  select coalesce(array_agg(r.id), '{}'::uuid[]) into v_demandes
    from public.requests r
   where r.client_id = any (v_cibles) or r.provider_id = any (v_fiches);
  raise notice 'fiches à supprimer : %, demandes à supprimer : %',
    array_length(v_fiches, 1), array_length(v_demandes, 1);

  delete from public.reviews rv
   where rv.client_id = any (v_cibles)
      or rv.provider_id = any (v_fiches)
      or rv.request_id = any (v_demandes);
  get diagnostics n = row_count;
  raise notice 'avis supprimés : %', n;

  delete from public.messages m
   where m.sender_id = any (v_cibles) or m.request_id = any (v_demandes);
  get diagnostics n = row_count;
  raise notice 'messages supprimés : %', n;

  delete from public.requests r where r.id = any (v_demandes);
  get diagnostics n = row_count;
  raise notice 'demandes supprimées : %', n;

  delete from public.providers pr where pr.profile_id = any (v_cibles);
  get diagnostics n = row_count;
  raise notice 'fiches supprimées : % (prestations et avis rattachés suivent en cascade)', n;

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

-- Preuve : tout ce qui vient du seed doit être à zéro, les catégories à 8.
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
  (select count(*) from public.profiles where role = 'admin')   as administrateurs,
  (select count(*) from public.categories)                       as categories,
  (select count(*) from public.providers)                        as fiches,
  (select count(*) from public.services)                         as prestations,
  (select count(*) from public.reviews)                          as avis,
  (select count(*) from public.requests)                         as demandes,
  (select count(*) from public.messages)                         as messages;
