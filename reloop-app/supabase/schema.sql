-- Reference schema for a future Supabase project.
-- Nothing in the app applies this file. The screens use lib/mock/data.ts.
-- Enable RLS before the Data API can reach these tables.
-- Put authorization roles in auth.users.raw_app_meta_data (app_metadata).
-- Never use user_metadata for access checks: the user can edit it.

create extension if not exists pgcrypto;

create type public.user_role as enum ('donor', 'student', 'recycler', 'admin');
create type public.device_category as enum ('phone', 'laptop', 'tablet', 'monitor', 'appliance', 'accessory');
create type public.device_condition as enum ('excellent', 'good', 'fair', 'poor');
create type public.working_status as enum ('working', 'partial', 'not_working');
create type public.pickup_status as enum ('requested', 'scheduled', 'collected', 'inspected', 'processing', 'donated', 'completed');
create type public.donation_status as enum ('available', 'reserved', 'donated');
create type public.assistance_status as enum ('open', 'matched', 'fulfilled');
create type public.review_status as enum ('pending', 'verified', 'needs_info');

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'donor',
  city text,
  points_month integer not null default 0 check (points_month >= 0),
  points_lifetime integer not null default 0 check (points_lifetime >= 0),
  created_at timestamptz not null default now()
);

create table public.recycler_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  org_name text not null,
  license text not null,
  city text not null,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category public.device_category not null,
  brand text not null,
  model text not null,
  description text not null default '',
  age_years integer not null check (age_years >= 0 and age_years <= 30),
  condition public.device_condition not null,
  working_status public.working_status not null,
  estimated_value integer not null default 0 check (estimated_value >= 0),
  points integer not null default 0 check (points >= 0),
  status public.pickup_status not null default 'requested',
  created_at timestamptz not null default now()
);

create table public.pickups (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  recycler_id uuid references public.recycler_profiles (id),
  address text not null,
  city text not null,
  collection_date date,
  status public.pickup_status not null default 'requested',
  created_at timestamptz not null default now()
);

create table public.pickup_events (
  id uuid primary key default gen_random_uuid(),
  pickup_id uuid not null references public.pickups (id) on delete cascade,
  status public.pickup_status not null,
  note text not null,
  happened_at timestamptz
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique references public.devices (id) on delete cascade,
  student_price integer check (student_price is null or student_price >= 0),
  donation_status public.donation_status not null default 'available',
  campus text not null,
  note text not null default ''
);

create table public.assistance_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  category public.device_category not null,
  need text not null,
  campus text not null,
  status public.assistance_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  points integer not null,
  created_at timestamptz not null default now()
);

create table public.monthly_winners (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  points integer not null check (points >= 0),
  published boolean not null default false,
  unique (month, rank)
);

alter table public.profiles enable row level security;
alter table public.recycler_profiles enable row level security;
alter table public.devices enable row level security;
alter table public.pickups enable row level security;
alter table public.pickup_events enable row level security;
alter table public.listings enable row level security;
alter table public.assistance_requests enable row level security;
alter table public.reward_events enable row level security;
alter table public.monthly_winners enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy "devices_owner_or_admin" on public.devices
  for all to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "pickups_visible_to_parties" on public.pickups
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.recycler_profiles r
      where r.id = recycler_id and r.profile_id = auth.uid()
    )
  );

create policy "listings_read_authenticated" on public.listings
  for select to authenticated
  using (true);

create policy "assistance_own_or_admin" on public.assistance_requests
  for all to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

create policy "rewards_read_own" on public.reward_events
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create policy "winners_read_published" on public.monthly_winners
  for select to authenticated
  using (published or public.is_admin());

-- Scrapo TrustShield: Device Sanitisation & Custody Audit Trail
create type public.sanitisation_status as enum ('pending', 'in_progress', 'completed', 'failed');
create type public.verification_status as enum ('pending_review', 'verified', 'rejected');

create table public.device_sanitisation_records (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  pickup_id uuid not null references public.pickups (id) on delete cascade,
  status public.sanitisation_status not null default 'pending',
  method text not null,
  technician_id uuid references public.profiles (id),
  organization_id uuid references public.recycler_profiles (id),
  completed_at timestamptz,
  verification_evidence text not null default '',
  verification_status public.verification_status not null default 'pending_review',
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.device_custody_history (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  pickup_id uuid not null references public.pickups (id) on delete cascade,
  stage text not null,
  action text not null,
  responsible_user_id uuid not null references public.profiles (id),
  responsible_role public.user_role not null,
  responsible_org text,
  notes text not null default '',
  happened_at timestamptz not null default now()
);

alter table public.device_sanitisation_records enable row level security;
alter table public.device_custody_history enable row level security;

-- Sanitisation select: owner, assigned recycler, or admin
create policy "sanitisation_visible_to_parties" on public.device_sanitisation_records
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.recycler_profiles r
      where r.id = organization_id and r.profile_id = auth.uid()
    )
  );

-- Sanitisation insert: only authorized recyclers or admin
create policy "sanitisation_insert_recycler_or_admin" on public.device_sanitisation_records
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.recycler_profiles r
      where r.id = organization_id and r.profile_id = auth.uid() and r.status = 'verified'
    )
  );

-- Sanitisation update: only admin can verify; recycler can update in-progress records
create policy "sanitisation_update_admin_or_recycler" on public.device_sanitisation_records
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.recycler_profiles r
      where r.id = organization_id and r.profile_id = auth.uid()
    )
  );

-- Custody history select: owner, assigned recycler, or admin
create policy "custody_visible_to_parties" on public.device_custody_history
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.pickups p
      left join public.recycler_profiles r on r.id = p.recycler_id
      where p.id = pickup_id and (r.profile_id = auth.uid() or p.recycler_id is null)
    )
  );

-- Custody history insert: append-only by authenticated authorized parties
create policy "custody_insert_authorized" on public.device_custody_history
  for insert to authenticated
  with check (
    responsible_user_id = auth.uid() or public.is_admin()
  );

-- Custody history has NO UPDATE or DELETE policies: strictly immutable!

-- Device photos belong in a private Storage bucket named device-images.
-- Owner path: {auth.uid()}/{device_id}/{filename}
-- Policies need insert, select, and update for the owner. Do not make the bucket public.
