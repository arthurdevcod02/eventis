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

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.requests enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.contact_messages enable row level security;

create policy "profiles read all" on public.profiles for select using (true);
create policy "profiles update self" on public.profiles for update using (auth.uid() = id);
create policy "profiles admin all" on public.profiles for all using (is_admin());

create policy "categories public read" on public.categories for select using (active or is_admin());
create policy "categories admin write" on public.categories for all using (is_admin());

create policy "providers public read approved" on public.providers for select
  using (status = 'approved' or profile_id = auth.uid() or is_admin());
create policy "providers owner insert" on public.providers for insert with check (profile_id = auth.uid());
create policy "providers owner update" on public.providers for update using (profile_id = auth.uid());
create policy "providers admin all" on public.providers for all using (is_admin());

create policy "services public read" on public.services for select using (true);
create policy "services owner write" on public.services for all using (is_provider_owner(provider_id));

create policy "requests party read" on public.requests for select using (is_request_party(id) or is_admin());
create policy "requests client insert" on public.requests for insert with check (client_id = auth.uid());
create policy "requests party update" on public.requests for update using (is_request_party(id) or is_admin());

create policy "messages party read" on public.messages for select using (is_request_party(request_id) or is_admin());
create policy "messages party insert" on public.messages for insert with check (is_request_party(request_id));

create policy "reviews read" on public.reviews for select using (visible or client_id = auth.uid() or is_admin());
create policy "reviews client insert" on public.reviews for insert with check (client_id = auth.uid());
create policy "reviews admin update" on public.reviews for update using (is_admin());

create policy "contact insert" on public.contact_messages for insert with check (true);
