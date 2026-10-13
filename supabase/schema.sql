create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('client','prestataire','admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  icon text not null default 'star',
  active boolean not null default true
);

create table public.providers (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id),
  business_name text not null,
  description text not null default '',
  city text not null default 'Lomé',
  quarter text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  price_from integer not null default 0,
  price_to integer not null default 0,
  cover_url text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  label text not null,
  description text not null default '',
  price integer not null default 0
);

create table public.requests (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.providers(id),
  event_type text not null,
  event_date date,
  guests integer,
  budget integer,
  message text not null,
  status text not null default 'sent' check (status in ('sent','in_progress','accepted','declined','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null references public.requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid unique references public.requests(id),
  client_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.providers(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null, email text not null, message text not null,
  created_at timestamptz not null default now()
);

create index on public.providers(category_id);
create index on public.providers(status);
create index on public.services(provider_id);
create index on public.requests(client_id);
create index on public.requests(provider_id);
create index on public.messages(request_id);
create index on public.reviews(provider_id);
