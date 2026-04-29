-- SnapSell database schema
-- Run in Supabase SQL editor (or supabase db push) AFTER creating the project.

-- =========================================================
-- Tables
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  whatsapp text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null check (category in ('Cars','Real Estate','Electronics','Furniture','Services','Other')),
  price numeric not null check (price >= 0),
  location text,
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','flagged','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_status_created_idx on listings(status, created_at desc);
create index if not exists listings_category_idx on listings(category);
create index if not exists listings_seller_idx on listings(seller_id);

create table if not exists favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('view','whatsapp','email','phone')),
  created_at timestamptz not null default now()
);
create index if not exists leads_listing_idx on leads(listing_id);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'none', -- active | trialing | past_due | canceled | incomplete | unpaid | none
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- When subscription becomes inactive, deactivate all listings
-- =========================================================
create or replace function public.sync_listings_on_sub_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status not in ('active','trialing')) and (old.status is distinct from new.status) then
    update public.listings set status = 'inactive'
      where seller_id = new.user_id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_listings_on_sub on public.subscriptions;
create trigger trg_sync_listings_on_sub
  after update on public.subscriptions
  for each row execute procedure public.sync_listings_on_sub_change();

-- =========================================================
-- Row-level security
-- =========================================================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table favorites enable row level security;
alter table leads enable row level security;
alter table subscriptions enable row level security;

-- profiles: anyone can read (for seller name on listings); user can update own; admin all.
drop policy if exists "profiles read all" on profiles;
create policy "profiles read all" on profiles for select using (true);

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles for update using (auth.uid() = id);

drop policy if exists "profiles admin all" on profiles;
create policy "profiles admin all" on profiles for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- listings: public read of active; sellers manage own; admin all.
drop policy if exists "listings public read active" on listings;
create policy "listings public read active" on listings for select
  using (status = 'active' or seller_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "listings insert own" on listings;
create policy "listings insert own" on listings for insert with check (auth.uid() = seller_id);

drop policy if exists "listings update own" on listings;
create policy "listings update own" on listings for update using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "listings delete own" on listings;
create policy "listings delete own" on listings for delete using (auth.uid() = seller_id);

drop policy if exists "listings admin all" on listings;
create policy "listings admin all" on listings for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- favorites: only owner.
drop policy if exists "favorites own" on favorites;
create policy "favorites own" on favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- leads: buyer can insert; seller can read leads on their listings; admin all.
drop policy if exists "leads insert own" on leads;
create policy "leads insert own" on leads for insert with check (auth.uid() = buyer_id);

drop policy if exists "leads read seller" on leads;
create policy "leads read seller" on leads for select
  using (
    exists (select 1 from listings l where l.id = leads.listing_id and l.seller_id = auth.uid())
    or auth.uid() = buyer_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- subscriptions: only owner can read; service role writes (edge function).
drop policy if exists "subscriptions read own" on subscriptions;
create policy "subscriptions read own" on subscriptions for select using (auth.uid() = user_id
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- (writes happen via service role, RLS bypassed)

-- =========================================================
-- Storage bucket (run in Storage > New bucket: name "listing-photos", public)
-- Or via SQL:
-- =========================================================
insert into storage.buckets (id, name, public)
  values ('listing-photos', 'listing-photos', true)
  on conflict (id) do nothing;

-- Allow authenticated users to upload into folders matching their UID
drop policy if exists "Public read photos" on storage.objects;
create policy "Public read photos" on storage.objects for select using (bucket_id = 'listing-photos');

drop policy if exists "Auth upload own folder" on storage.objects;
create policy "Auth upload own folder" on storage.objects for insert
  with check (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Auth delete own" on storage.objects;
create policy "Auth delete own" on storage.objects for delete
  using (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);
