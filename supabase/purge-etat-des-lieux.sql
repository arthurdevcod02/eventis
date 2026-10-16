-- Eventis — état des lieux AVANT purge — LECTURE SEULE, aucune écriture.
--
-- À coller en entier dans l'éditeur SQL du projet Supabase hzhoddyrakfwpucyrcig et à
-- exécuter AVANT l'un des trois fichiers de purge. Il répond aux trois questions que
-- personne ne peut trancher à ta place : qui peut encore se connecter, à qui appartiennent
-- les fiches publiées, et combien de lignes chaque purge emporterait.
--
-- Why ce fichier existe séparément : les fichiers de purge sont atomiques (un seul bloc,
-- tout ou rien) mais irrévocables une fois exécutés. Une vérification de 30 secondes ici
-- coûte moins cher qu'une restauration depuis une sauvegarde que l'on n'a pas prise.
--
-- Ce fichier ne contient volontairement ni delete, update, insert, truncate ni drop :
-- tests/purge.test.js le vérifie, pour qu'une future retouche ne le transforme pas en
-- script de purge déguisé.

-- 1. Vue d'ensemble — l'état réel de la base en un regard.
select
  (select count(*) from auth.users)                                       as comptes_de_connexion,
  (select count(*) from public.profiles)                                  as profils,
  (select count(*) from public.profiles where role = 'admin')              as administrateurs,
  (select count(*) from public.categories)                                as categories,
  (select count(*) from public.providers)                                 as fiches,
  (select count(*) from public.services)                                  as prestations,
  (select count(*) from public.requests)                                  as demandes,
  (select count(*) from public.messages)                                  as messages,
  (select count(*) from public.reviews)                                   as avis,
  (select count(*) from public.reviews where visible)                     as avis_visibles,
  (select count(*) from public.contact_messages)                          as messages_de_contact,
  (select maintenance_enabled from public.site_settings where id = 1)      as maintenance_active;

-- 2. Chaque compte, classé. « sonde QA » = créé par mes scripts de test (adresses de
--    test, mot de passe connu) ; « seed démo » = les 14 comptes du jeu de démonstration,
--    dont le mot de passe « demo1234 » est publié dans le dépôt ; « à conserver » = tout
--    le reste, c'est-à-dire tes vrais comptes.
--    Le classement des comptes de démo se fait par identifiant (figure dans seed.sql),
--    pas par adresse e-mail : une adresse peut être rebaptisée, un uuid non.
select
  u.id,
  u.email,
  coalesce(p.role, '— profil manquant')                        as role,
  coalesce(p.suspended, false)                                 as suspendu,
  u.email_confirmed_at is not null                             as email_confirme,
  to_char(u.created_at, 'YYYY-MM-DD')                          as cree_le,
  case
    when lower(u.email) like 'qa.eventis.%'
      or lower(u.email) like '%.qa@%'
      or lower(u.email) like '%@qa.tg'
      or lower(u.email) = 'qa@demo.tg'                            then 'sonde QA'
    when u.id = any (array[
      'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9',
      '184d929d-42f8-98e7-0607-f44e11b24b61', '8812856e-0369-fe6b-1729-6ea03a6bb811',
      '88fa67ac-f20f-7fc1-597f-ee55f12c017c', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
      'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
      '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
      'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
      '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[])
                                                                 then 'seed démo'
    else 'à conserver'
  end                                                          as classification,
  (select count(*) from public.providers pr
    where pr.profile_id = u.id)                                as fiches_en_propriete,
  (select count(*) from public.requests r
    where r.client_id = u.id)                                  as demandes_emises,
  (select count(*) from public.reviews rv
    where rv.client_id = u.id)                                 as avis_ecrits
from auth.users u
left join public.profiles p on p.id = u.id
order by classification, u.created_at;

-- 3. Le catalogue publié, et ce qui disparaîtrait avec les comptes prestataires.
--    Une fiche appartient à un profil (providers.profile_id, cascade) : supprimer le
--    compte supprime la fiche, et supprimer la fiche supprime ses prestations (cascade)
--    et les avis qui la visent (cascade). C'est la décision que les deux variantes de
--    purge prennent différemment.
select
  pr.business_name                                             as fiche,
  coalesce(c.name, '— catégorie supprimée')                     as categorie,
  pr.status,
  pr.is_verified                                               as verifiee,
  u.email                                                      as compte_proprietaire,
  case when u.id = any (array[
      '8812856e-0369-fe6b-1729-6ea03a6bb811', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
      'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
      '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
      'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
      '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[])
    then 'démo' else 'réel' end                                as origine,
  (select count(*) from public.services s
    where s.provider_id = pr.id)                               as prestations,
  (select count(*) from public.reviews rv
    where rv.provider_id = pr.id and rv.visible)               as avis_visibles
from public.providers pr
left join auth.users u on u.id = pr.profile_id
left join public.categories c on c.id = pr.category_id
order by origine, fiche;

-- 4. Anomalies qui compliquent une purge : un compte sans profil ne peut pas ouvrir
--    l'espace privé mais peut exister (inscription interrompue, écriture de profil
--    refusée) ; un profil sans compte est une clé morte. Les deux sont à savoir avant,
--    pas après.
select 'profils sans compte de connexion' as controle, count(*) as lignes_concernees
  from public.profiles p
 where not exists (select 1 from auth.users u where u.id = p.id)
union all
select 'comptes de connexion sans profil', count(*)
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id)
union all
select 'avis rattachés à une demande (request_id non nul)', count(*)
  from public.reviews where request_id is not null
union all
select 'demandes dont le client est une sonde QA', count(*)
  from public.requests r join public.profiles p on p.id = r.client_id
 where lower(coalesce(p.email, '')) like 'qa.eventis.%'
    or lower(coalesce(p.email, '')) like '%.qa@%'
    or lower(coalesce(p.email, '')) like '%@qa.tg'
union all
select 'demandes dont la fiche appartient à une sonde QA', count(*)
  from public.requests r join public.providers pr on pr.id = r.provider_id
                      join public.profiles p on p.id = pr.profile_id
 where lower(coalesce(p.email, '')) like 'qa.eventis.%'
    or lower(coalesce(p.email, '')) like '%.qa@%'
    or lower(coalesce(p.email, '')) like '%@qa.tg'
union all
select 'messages de contact de test (adresses qa)', count(*)
  from public.contact_messages cm
 where lower(cm.email) like 'qa.eventis.%'
    or lower(cm.email) like '%.qa@%'
    or lower(cm.email) like '%@qa.tg'
    or lower(cm.email) = 'qa@demo.tg';

-- 5. Ce que chaque variante emporterait, chiffré avant décision. Les trois compteurs
--    « administrateurs survivants » sont les garde-fous des fichiers de purge : s'ils
--    valent 0, le fichier refuse de toucher à quoi que ce soit.
select
  'purge-sondes-qa' as variante,
  (select count(*) from auth.users u
    where lower(u.email) like 'qa.eventis.%' or lower(u.email) like '%.qa@%'
       or lower(u.email) like '%@qa.tg' or lower(u.email) = 'qa@demo.tg')     as comptes_supprimes,
  (select count(*) from public.providers pr join public.profiles p on p.id = pr.profile_id
    where lower(p.email) like 'qa.eventis.%' or lower(p.email) like '%.qa@%'
       or lower(p.email) like '%@qa.tg')                                      as fiches_supprimees,
  (select count(*) from public.profiles where role = 'admin')
  - (select count(*) from public.profiles p where p.role = 'admin'
       and (lower(p.email) like 'qa.eventis.%' or lower(p.email) like '%.qa@%'
            or lower(p.email) like '%@qa.tg' or lower(p.email) = 'qa@demo.tg')) as administrateurs_survivants
union all
select 'purge-demo-catalogue-intact (variantes 3 et 4)',
  14,
  0,
  (select count(*) from public.profiles p where p.role = 'admin'
     and not (p.id = any (array[
      'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9',
      '184d929d-42f8-98e7-0607-f44e11b24b61', '8812856e-0369-fe6b-1729-6ea03a6bb811',
      '88fa67ac-f20f-7fc1-597f-ee55f12c017c', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
      'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
      '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
      'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
      '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[])))
union all
select 'purge-demo-catalogue-vide',
  14,
  (select count(*) from public.providers pr
    where pr.profile_id = any (array[
      '8812856e-0369-fe6b-1729-6ea03a6bb811', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
      'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
      '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
      'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
      '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[])),
  (select count(*) from public.profiles p where p.role = 'admin'
     and not (p.id = any (array[
      'e1f65c57-0cb2-fe90-77fe-f824cd002d30', 'a5c0ab01-d0f2-a47f-86f3-85ef1c2a46a9',
      '184d929d-42f8-98e7-0607-f44e11b24b61', '8812856e-0369-fe6b-1729-6ea03a6bb811',
      '88fa67ac-f20f-7fc1-597f-ee55f12c017c', 'b1e45fa1-1436-67e7-afb2-b854a9ab088f',
      'e89198be-7b0b-1832-541b-78ff7f783674', '5c994d96-85ca-01fd-d45d-66b8f6f55325',
      '9bfc06d6-c11e-081a-7a4a-8c7a4f2d7a0b', '342c7e4e-9730-e498-c770-98d8f467d146',
      'b1c45833-8e3e-a3d2-8a1c-bab236b88bf7', 'ad6466f6-b69b-e0f7-5e40-a1f7e090df0c',
      '1ce8bf30-b3a2-a909-9530-0639dec62e7d', '242b8b03-b5c7-701b-b3e8-9c192ae3afc6']::uuid[])));
