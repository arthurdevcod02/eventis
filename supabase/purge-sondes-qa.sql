-- Eventis — purge des sondes QA — COMPTES DE TEST, pas le jeu de démonstration.
--
-- Ce fichier supprime les comptes que mes scripts de test ont créés sur le projet en
-- ligne (hzhoddyrakfwpucyrcig) pendant la campagne de vérification : adresses en
-- qa.eventis.*@gmail.com, *.qa@…, …@qa.tg et qa@demo.tg, avec leurs demandes, leurs
-- messages, leurs avis, les fiches qu'ils ont pu déposer et les messages qu'ils ont pu
-- laisser dans le formulaire de contact.
--
-- Ce qu'il ne touche PAS : les 8 catégories, les 10 fiches et les 14 prestations du jeu
-- de démonstration, les 14 comptes de seed, et tout compte dont l'adresse ne correspond
-- pas aux motifs ci-dessus. Le catalogue public reste donc tel quel.
--
-- À exécuter dans l'éditeur SQL du projet (rôle postgres : l'éditeur ne passe pas par RLS,
-- les déclencheurs de modération ne filtrent rien ici puisqu'ils n'existent qu'en
-- before insert/update et que ce fichier ne fait que des suppressions).
--
-- Un seul bloc « do » = une seule instruction = tout ou rien : si le garde-fou d'administrateur
-- déclenche, aucune ligne n'a été supprimée et la base est intacte. Le select final sert de
-- preuve visuelle ; il ne s'exécute que si le bloc a réussi.

do $$
declare
  v_cibles uuid[];
  n_admins_total integer;
  n_admins_cibles integer;
  n integer;
begin
  -- Le motif est écrit une seule fois, ici : tout le reste du fichier travaille sur la
  -- liste d'identifiants qu'il produit. Une adresse de test rebaptisée ne peut donc pas
  -- se retrouver à moitié supprimée.
  select array_agg(u.id) into v_cibles
    from auth.users u
   where lower(u.email) like 'qa.eventis.%'
      or lower(u.email) like '%.qa@%'
      or lower(u.email) like '%@qa.tg'
      or lower(u.email) = 'qa@demo.tg';

  if v_cibles is null then
    raise exception 'Aucun compte de sonde QA dans cette base : rien à purger, aucune écriture exécutée.';
  end if;

  -- Garde-fou : une purge qui retirerait le dernier administrateur fermerait /admin et
  -- la bascule de maintenance sans moyen de revenir. Un admin suspendu ne compte pas :
  -- is_admin() (rls.sql:5) exige « not suspended », donc un compte suspendu ne rattrape
  -- pas l'accès — le garder en mémoire, c'est refuser le scénario du pire. On refuse,
  -- plutôt que de le découvrir après coup.
  select count(*) into n_admins_total from public.profiles
    where role = 'admin' and not suspended;
  select count(*) into n_admins_cibles from public.profiles
    where role = 'admin' and not suspended and id = any (v_cibles);
  if n_admins_total - n_admins_cibles < 1 then
    raise exception 'Garde-fou : tes % administrateur(s) sont tous des sondes QA. Crée et promeus un vrai compte admin avant de lancer ce fichier (update public.profiles set role = ''admin'' where id = …).', n_admins_total;
  end if;

  raise notice 'comptes de sonde visés : %', array_length(v_cibles, 1);

  -- Ordre imposé par les clés étrangères de schema.sql : messages.sender_id,
  -- requests.client_id, requests.provider_id et reviews.client_id n'ont PAS de cascade.
  -- Supprimer un profil avant ces lignes échouerait ; en cascade, cela emporterait des
  -- lignes que ce fichier ne vise pas. On commence donc par la feuille, on finit par la
  -- racine.

  delete from public.messages m
   where m.sender_id = any (v_cibles)
      or m.request_id in (
        select r.id from public.requests r
         where r.client_id = any (v_cibles)
            or r.provider_id in (select pr.id from public.providers pr
                                  where pr.profile_id = any (v_cibles)));
  get diagnostics n = row_count;
  raise notice 'messages supprimés : %', n;

  delete from public.reviews rv
   where rv.client_id = any (v_cibles)
      or rv.request_id in (select r.id from public.requests r
                            where r.client_id = any (v_cibles))
      or rv.provider_id in (select pr.id from public.providers pr
                             where pr.profile_id = any (v_cibles));
  get diagnostics n = row_count;
  raise notice 'avis supprimés : %', n;

  delete from public.requests r
   where r.client_id = any (v_cibles)
      or r.provider_id in (select pr.id from public.providers pr
                            where pr.profile_id = any (v_cibles));
  get diagnostics n = row_count;
  raise notice 'demandes supprimées : %', n;

  delete from public.providers pr
   where pr.profile_id = any (v_cibles);
  get diagnostics n = row_count;
  raise notice 'fiches déposées par une sonde supprimées : % (leurs prestations suivent en cascade)', n;

  delete from public.contact_messages cm
   where lower(cm.email) like 'qa.eventis.%'
      or lower(cm.email) like '%.qa@%'
      or lower(cm.email) like '%@qa.tg'
      or lower(cm.email) = 'qa@demo.tg';
  get diagnostics n = row_count;
  raise notice 'messages de contact de test supprimés : %', n;

  delete from public.profiles p where p.id = any (v_cibles);
  get diagnostics n = row_count;
  raise notice 'profils supprimés : %', n;

  -- Le profil est déjà parti : il ne reste que la ligne d'authentification (identités,
  -- sessions et jetons du schéma auth suivent en cascade).
  delete from auth.users u where u.id = any (v_cibles);
  raise notice 'comptes de connexion supprimés : %', row_count;
end $$;

-- Preuve : les compteurs doivent être revenus à zéro pour tout ce qui porte le motif QA,
-- et le catalogue de démonstration doit afficher exactement ce qu'il affichait avant.
select
  (select count(*) from auth.users u
    where lower(u.email) like 'qa.eventis.%' or lower(u.email) like '%.qa@%'
       or lower(u.email) like '%@qa.tg' or lower(u.email) = 'qa@demo.tg') as sondes_restantes,
  (select count(*) from public.contact_messages cm
    where lower(cm.email) like 'qa.eventis.%' or lower(cm.email) like '%.qa@%'
       or lower(cm.email) like '%@qa.tg' or lower(cm.email) = 'qa@demo.tg') as contacts_de_test_restants,
  (select count(*) from public.profiles where role = 'admin')              as administrateurs,
  (select count(*) from public.categories)                                 as categories,
  (select count(*) from public.providers)                                  as fiches,
  (select count(*) from public.services)                                   as prestations,
  (select count(*) from public.reviews where visible)                      as avis_visibles;
