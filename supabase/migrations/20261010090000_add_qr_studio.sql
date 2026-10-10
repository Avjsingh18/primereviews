-- QR Studio stores compact configuration and an optional optimised WebP only.
-- Rendered QR files are deliberately not persisted.
alter table public.businesses add column if not exists category_slug varchar(40) not null default 'other';
alter table public.businesses add constraint businesses_category_slug_check check (category_slug in ('cafes','restaurants','hotels','pg','salons','clinics','coaching_centres','plant_nurseries','day_care','preschools','gyms','other'));

create table if not exists public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  mime varchar(30) not null default 'image/webp' check (mime = 'image/webp'),
  data bytea not null,
  bytes integer not null check (bytes > 0 and bytes <= 81920),
  width integer not null check (width = 720),
  height integer not null check (height = 960),
  sha256 char(64) not null,
  palette jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qr_studio_designs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_slug varchar(40) not null default 'other',
  variant_index smallint not null default 0 check (variant_index >= 0 and variant_index < 12),
  palette_source varchar(10) not null default 'theme' check (palette_source in ('theme','photo')),
  photo_sha256 char(64),
  tagline_source varchar(10) not null default 'preset' check (tagline_source in ('preset','custom')),
  tagline_id varchar(120),
  tagline_custom varchar(60),
  bw_mode boolean not null default false,
  seen_variants jsonb not null default '[]'::jsonb,
  render_hash char(64) not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_studio_tagline_source_check check ((tagline_source = 'custom' and tagline_custom is not null) or (tagline_source = 'preset' and tagline_id is not null))
);
create unique index if not exists one_active_qr_studio_design_per_business on public.qr_studio_designs(business_id) where is_active;
create index if not exists qr_studio_designs_business_updated on public.qr_studio_designs(business_id, updated_at desc);

create table if not exists public.qr_taglines (
  id uuid primary key default gen_random_uuid(),
  category_slug varchar(40) not null,
  tone varchar(20) not null check (tone in ('funny','friendly','professional')),
  text varchar(44) not null,
  language varchar(10) not null default 'en',
  is_active boolean not null default true,
  unique(category_slug, text)
);

alter table public.business_photos enable row level security;
alter table public.qr_studio_designs enable row level security;
alter table public.qr_taglines enable row level security;
revoke all on table public.business_photos, public.qr_studio_designs, public.qr_taglines from anon, authenticated;
grant all privileges on table public.business_photos, public.qr_studio_designs, public.qr_taglines to service_role;

-- The app accesses owner records through server routes using service_role only.
-- Keep explicit deny-by-default RLS policies so browser clients cannot enumerate photos or designs.
