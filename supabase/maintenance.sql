-- maintenance.sql — migration du mode maintenance, à coller TEL QUEL dans l'éditeur SQL
-- du projet Supabase déjà en ligne (Authentication n'y change rien : c'est du SQL).
--
-- `schema.sql` et `rls.sql` sont la source de vérité d'un projet NEUF, mais ils recréent
-- des objets qui existent déjà sur `eventis`. Ci-dessous, tout est `if not exists` ou
-- `drop … if exists` : le fichier peut être relancé, il ne remet jamais le site en
-- service en cachette (`insert … do nothing`) et n'écrase aucune table déjà en place.
--
-- Ce que ce fichier ajoute : une table `site_settings` d'une seule ligne, lisible par
-- tout le monde (le drapeau s'affiche publiquement), modifiable uniquement par un
-- administrateur connecté (politique RLS sur `public.is_admin()`, définie dans rls.sql
-- et recréée ici pour que ce fichier se suffise à lui seul).

create table if not exists public.site_settings (
  id smallint primary key default 1 constraint site_settings_single_row check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text constraint site_settings_message_length
    check (maintenance_message is null or length(maintenance_message) <= 500),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- La garde `is_admin()` est reprise de rls.sql (same definition, `create or replace`) :
-- sans elle, les politiques ci-dessous échoueraient sur un projet où rls.sql n'aurait
-- pas encore tourné.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not suspended) $$;

alter table public.site_settings enable row level security;

drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read" on public.site_settings for select
  using (true);

drop policy if exists "site_settings admin update" on public.site_settings;
create policy "site_settings admin update" on public.site_settings for update
  to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "site_settings admin insert" on public.site_settings;
create policy "site_settings admin insert" on public.site_settings for insert
  to authenticated with check (is_admin());

drop policy if exists "site_settings admin delete" on public.site_settings;
create policy "site_settings admin delete" on public.site_settings for delete
  to authenticated using (is_admin());

-- Contrôle après exécution : la ligne doit exister, en service, sans message personnalisé.
-- Attendu : 1 ligne, maintenance_enabled = false, maintenance_message = null.
select id, maintenance_enabled, maintenance_message, updated_at
  from public.site_settings order by id;
