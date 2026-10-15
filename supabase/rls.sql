-- RLS Eventis — helpers security definer paramétrés (ruling R1) + politiques inline.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not suspended) $$;

create or replace function public.is_provider_owner(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.providers where id = p_provider and profile_id = auth.uid()) $$;

create or replace function public.is_request_party(p_request uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.requests r where r.id = p_request
   and (r.client_id = auth.uid() or is_provider_owner(r.provider_id))) $$;

-- Un profil ne se lit que par son titulaire, un admin, ou quelqu'un avec qui une
-- demande a été ouverte. `security definer` : la fonction lit `requests` et
-- `providers` par-dessus leur RLS, ce qui coupe la récursion qu'une sous-requête
-- inline dans la politique aurait déclenchée (politique de `profiles` interrogeant
-- `requests`, dont la politique interroge `profiles`).
create or replace function public.is_request_counterparty(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.requests r
     join public.providers pv on pv.id = r.provider_id
     where auth.uid() is not null
       and ((r.client_id = p_profile and pv.profile_id = auth.uid())
         or (pv.profile_id = p_profile and r.client_id = auth.uid()))) $$;

-- Masquage public d'un prestataire dont le gérant est suspendu. Fait dans la
-- politique plutôt que côté client : la liste publique lisait `profiles.suspended`
-- par jointure, et la lecture des profils est désormais restreinte — un visiteur
-- non connecté aurait donc vu des prestataires masqués en démo. La politique
-- s'applique à tous, et `getProvider` (`.single()`) rend « Prestataire introuvable. »
-- comme l'adaptateur démo.
create or replace function public.is_provider_suspended(p_provider uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.providers pv
     join public.profiles pr on pr.id = pv.profile_id
     where pv.id = p_provider and pr.suspended) $$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;

-- Le profil est créé par l'utilisateur lui-même à l'inscription (auth-supabase.js).
-- Sans cette politique, seule « profiles admin all » autoriserait l'insertion :
-- aucune inscription ne passerait en mode réel.
drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert
  with check (id = auth.uid() and role <> 'admin' and not suspended);
drop policy if exists "profiles read all" on public.profiles;
drop policy if exists "profiles read self admin or counterpart" on public.profiles;
-- Lecture restreinte : la table porte e-mail et téléphone. Une lecture ouverte à
-- tous (l'ancienne « profiles read all using (true) ») livrait la liste complète
-- des adresses e-mail et des rôles à n'importe quel visiteur non connecté.
-- Les avis publics n'affichent donc plus le nom de leur auteur (db.js ne demande
-- plus `profiles(full_name)`), et les écrans admin gardent l'accès complet.
create policy "profiles read self admin or counterpart" on public.profiles for select
  using (auth.uid() = id or is_admin() or is_request_counterparty(id));
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles for all using (is_admin());

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories for select using (active or is_admin());
drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write" on public.categories for all using (is_admin());

drop policy if exists "providers public read approved" on public.providers;
-- Voie publique : prestataires approuvés dont le gérant n'est pas suspendu.
create policy "providers public read approved" on public.providers for select
  using ((status = 'approved' and not is_provider_suspended(id))
    or profile_id = auth.uid() or is_admin());
drop policy if exists "providers owner insert" on public.providers;
create policy "providers owner insert" on public.providers for insert with check (profile_id = auth.uid());
drop policy if exists "providers owner update" on public.providers;
create policy "providers owner update" on public.providers for update using (profile_id = auth.uid());
drop policy if exists "providers admin all" on public.providers;
create policy "providers admin all" on public.providers for all using (is_admin());

drop policy if exists "services public read" on public.services;
create policy "services public read" on public.services for select using (true);
drop policy if exists "services owner write" on public.services;
create policy "services owner write" on public.services for all using (is_provider_owner(provider_id));

drop policy if exists "requests party read" on public.requests;
-- La politique de lecture de `requests` ne doit PAS rappeler `is_request_party(id)` :
-- cette fonction relit `requests` par sa clé, et une sous-requête ne voit pas la ligne
-- en cours d'insertion dans la même commande. Résultat mesuré le 15/10 : `INSERT` seul =
-- 201, mais `INSERT ... RETURNING` (ce que fait db.js avec `.select().single()`) = 403
-- « new row violates row-level security policy », parce que Postgres applique la
-- politique de SELECT à la ligne qu'il vient de créer. On n'utilise donc que des
-- colonnes de la ligne elle-même ; `is_provider_owner` lit `providers`, jamais `requests`.
create policy "requests party read" on public.requests for select
  using (client_id = auth.uid() or is_provider_owner(provider_id) or is_admin());
drop policy if exists "requests client insert" on public.requests;
create policy "requests client insert" on public.requests for insert with check (client_id = auth.uid());
drop policy if exists "requests party update" on public.requests;
create policy "requests party update" on public.requests for update
  using (client_id = auth.uid() or is_provider_owner(provider_id) or is_admin())
  with check (client_id = auth.uid() or is_provider_owner(provider_id) or is_admin());

drop policy if exists "messages party read" on public.messages;
create policy "messages party read" on public.messages for select using (is_request_party(request_id) or is_admin());
drop policy if exists "messages party insert" on public.messages;
create policy "messages party insert" on public.messages for insert
  with check (is_request_party(request_id) and sender_id = auth.uid());
-- Accusés de lecture : db.js marque les messages lus (markRequestRead) par un UPDATE ;
-- sans politique d'update, les pastilles « non lu » ne se vident jamais en mode réel.
drop policy if exists "messages party update" on public.messages;
create policy "messages party update" on public.messages for update
  using (is_request_party(request_id) or is_admin())
  with check (is_request_party(request_id) or is_admin());

drop policy if exists "reviews read" on public.reviews;
create policy "reviews read" on public.reviews for select using (visible or client_id = auth.uid() or is_admin());
drop policy if exists "reviews client insert" on public.reviews;
create policy "reviews client insert" on public.reviews for insert with check (client_id = auth.uid());
drop policy if exists "reviews admin update" on public.reviews;
create policy "reviews admin update" on public.reviews for update using (is_admin());

drop policy if exists "contact insert" on public.contact_messages;
create policy "contact insert" on public.contact_messages for insert with check (true);

-- Champs de modération : « Vérifié », statut du prestataire, rôle et suspension
-- ne peuvent être posés que par un admin (brief maître : aucune auto-décoration,
-- aucun mécanisme annoncé et inexistant). Une politique RLS ne peut pas comparer
-- l'ancienne et la nouvelle valeur d'une ligne, ni restreindre des colonnes :
-- un déclencheur BEFORE remet les colonnes protégées à leur valeur précédente.
-- `auth.uid()` est nul depuis l'éditeur SQL et service_role : le seed et les
-- corrections manuelles de l'équipe ne sont donc pas filtrés.

create or replace function public.guard_provider_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_verified := false;
  else
    new.status := old.status;
    new.is_verified := old.is_verified;
  end if;
  return new;
end $$;

create or replace function public.guard_profile_privileges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role = 'admin' then
    new.role := case when tg_op = 'UPDATE' then old.role else 'client' end;
  end if;
  new.suspended := case when tg_op = 'UPDATE' then old.suspended else false end;
  return new;
end $$;

drop trigger if exists providers_guard_moderation on public.providers;
create trigger providers_guard_moderation
  before insert or update on public.providers
  for each row execute function public.guard_provider_moderation();

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();
