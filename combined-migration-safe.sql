-- ============================================
-- Combined Migration File
-- Generated: 2026-06-17T19:58:19.064Z
-- Total Files: 30
-- ============================================

-- ============================================
-- Migration: 20260509211906_913ddaf7-0916-474a-b228-2fe57169c778.sql
-- ============================================


-- =============================================================
-- ENUMS
-- =============================================================
DO $$ BEGIN
  create type public.app_role as enum ('admin', 'customer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.order_status as enum ('pending','submitted','verified','processing','delivered','completed','cancelled','refunded','disputed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.payment_status as enum ('pending','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.delivery_type as enum ('auto','manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.payment_method as enum ('binance','baridimob','ccp');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  create type public.coupon_type as enum ('percent','fixed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =============================================================
-- PROFILES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  country text default 'DZ',
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =============================================================
-- USER ROLES (separate table — prevents privilege escalation)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer function to check roles (avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- =============================================================
-- AUTO-CREATE PROFILE + CUSTOMER ROLE ON SIGNUP
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================
-- CATEGORIES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  icon text,
  banner_url text,
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;

-- =============================================================
-- PRODUCTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  tags text[] default '{}',
  main_image text,
  gallery text[] default '{}',
  banner_image text,
  delivery_type public.delivery_type not null default 'manual',
  featured boolean not null default false,
  visible boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_products_category_id on public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_visible on public.products (visible);

-- =============================================================
-- PRODUCT OFFERS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  duration text,
  price_usd numeric(10,2) not null,
  discount_usd numeric(10,2),
  stock int not null default 0,
  delivery_type public.delivery_type not null default 'manual',
  delivery_notes text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.product_offers enable row level security;
CREATE INDEX IF NOT EXISTS idx_product_offers_product_id on public.product_offers (product_id);

-- =============================================================
-- AUTO-DELIVERY STOCK
-- =============================================================
CREATE TABLE IF NOT EXISTS public.auto_delivery_stock (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.product_offers(id) on delete cascade,
  payload text not null,            -- credentials / code
  used boolean not null default false,
  used_at timestamptz,
  used_by_order uuid,
  created_at timestamptz not null default now()
);
alter table public.auto_delivery_stock enable row level security;
CREATE INDEX IF NOT EXISTS idx_auto_delivery_stock_offer_id_used on public.auto_delivery_stock (offer_id, used);

-- =============================================================
-- COUPONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type public.coupon_type not null,
  value numeric(10,2) not null,
  min_order_usd numeric(10,2) default 0,
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  product_id uuid references public.products(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

-- =============================================================
-- EXCHANGE RATE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.exchange_rate (
  id uuid primary key default gen_random_uuid(),
  rate numeric(10,2) not null,        -- DZD per 1 USD
  set_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.exchange_rate enable row level security;

-- =============================================================
-- PAYMENT METHODS (settings)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  method public.payment_method not null unique,
  display_name text not null,
  account_info text,                  -- wallet/RIP/CCP number
  qr_code_url text,
  instructions text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
create trigger payment_methods_updated_at before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- =============================================================
-- ORDERS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('VLT-' || to_char(now(),'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,5)),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  offer_id uuid not null references public.product_offers(id),
  quantity int not null default 1,
  unit_price_usd numeric(10,2) not null,
  total_usd numeric(10,2) not null,
  total_dzd numeric(12,2) not null,
  exchange_rate_used numeric(10,2) not null,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  status public.order_status not null default 'pending',
  delivery_type public.delivery_type not null,
  coupon_id uuid references public.coupons(id),
  internal_notes text,
  delivered_payload text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_orders_user_id on public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status on public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at on public.orders (created_at desc);

-- =============================================================
-- PAYMENT RECEIPTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  amount_claimed numeric(10,2),
  status public.payment_status not null default 'submitted',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
alter table public.payment_receipts enable row level security;
CREATE INDEX IF NOT EXISTS idx_payment_receipts_order_id on public.payment_receipts (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status on public.payment_receipts (status);

-- =============================================================
-- ORDER MESSAGES (realtime chat)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  body text,
  attachment_url text,
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.order_messages enable row level security;
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id_created_at on public.order_messages (order_id, created_at);
alter publication supabase_realtime add table public.order_messages;

-- =============================================================
-- AUDIT LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  ip text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at on public.audit_logs (created_at desc);

-- =============================================================
-- NOTIFICATIONS (admin-facing)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
alter publication supabase_realtime add table public.notifications;

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read own profile') THEN
    create policy "users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users update own profile') THEN
    create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins update any profile') THEN
    create policy "admins update any profile"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- user_roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users see own roles') THEN
    create policy "users see own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage roles') THEN
    create policy "admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- categories — public read, admin write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read visible categories') THEN
    create policy "public read visible categories"
  on public.categories for select using (visible or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage categories') THEN
    create policy "admins manage categories"
  on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- products — public read, admin write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read visible products') THEN
    create policy "public read visible products"
  on public.products for select using (visible or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage products') THEN
    create policy "admins manage products"
  on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- product_offers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read active offers') THEN
    create policy "public read active offers"
  on public.product_offers for select using (active or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage offers') THEN
    create policy "admins manage offers"
  on public.product_offers for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- auto_delivery_stock — admin only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage stock') THEN
    create policy "admins manage stock"
  on public.auto_delivery_stock for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- coupons
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read active coupons') THEN
    create policy "public read active coupons"
  on public.coupons for select using (active or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage coupons') THEN
    create policy "admins manage coupons"
  on public.coupons for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- exchange_rate — public read, admin write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read rate') THEN
    create policy "public read rate"
  on public.exchange_rate for select using (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage rate') THEN
    create policy "admins manage rate"
  on public.exchange_rate for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- payment_methods
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read active payment methods') THEN
    create policy "public read active payment methods"
  on public.payment_methods for select using (active or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage payment methods') THEN
    create policy "admins manage payment methods"
  on public.payment_methods for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read own orders') THEN
    create policy "users read own orders"
  on public.orders for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users create own orders') THEN
    create policy "users create own orders"
  on public.orders for insert to authenticated
  with check (user_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins update orders') THEN
    create policy "admins update orders"
  on public.orders for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- payment_receipts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read own receipts') THEN
    create policy "users read own receipts"
  on public.payment_receipts for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users create own receipts') THEN
    create policy "users create own receipts"
  on public.payment_receipts for insert to authenticated
  with check (user_id = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins update receipts') THEN
    create policy "admins update receipts"
  on public.payment_receipts for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- order_messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'participants read messages') THEN
    create policy "participants read messages"
  on public.order_messages for select to authenticated
  using (
    (not internal_note and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()))
    or public.has_role(auth.uid(),'admin')
  );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'participants send messages') THEN
    create policy "participants send messages"
  on public.order_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and (
      public.has_role(auth.uid(),'admin')
      or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    )
  );
  END IF;
END $$;

-- audit_logs — admin only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins read audit') THEN
    create policy "admins read audit"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins write audit') THEN
    create policy "admins write audit"
  on public.audit_logs for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- notifications — admin only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins read notifications') THEN
    create policy "admins read notifications"
  on public.notifications for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins update notifications') THEN
    create policy "admins update notifications"
  on public.notifications for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'system insert notifications') THEN
    create policy "system insert notifications"
  on public.notifications for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- =============================================================
-- STORAGE BUCKETS
-- =============================================================
insert into storage.buckets (id, name, public) values
  ('product-images','product-images', true),
  ('category-banners','category-banners', true),
  ('receipts','receipts', false),
  ('delivery-files','delivery-files', false)
on conflict (id) do nothing;

-- public buckets read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read product images') THEN
    create policy "public read product images"
  on storage.objects for select using (bucket_id = 'product-images');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read category banners') THEN
    create policy "public read category banners"
  on storage.objects for select using (bucket_id = 'category-banners');
  END IF;
END $$;

-- admin writes to public buckets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins write product images') THEN
    create policy "admins write product images"
  on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins write category banners') THEN
    create policy "admins write category banners"
  on storage.objects for all to authenticated
  using (bucket_id = 'category-banners' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'category-banners' and public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- receipts: user uploads own (path prefix = user id), admins read all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users upload own receipts') THEN
    create policy "users upload own receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read own receipts') THEN
    create policy "users read own receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(),'admin')
    )
  );
  END IF;
END $$;

-- delivery-files: admin uploads, buyer reads via order
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage delivery files') THEN
    create policy "admins manage delivery files"
  on storage.objects for all to authenticated
  using (bucket_id = 'delivery-files' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'delivery-files' and public.has_role(auth.uid(),'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read delivery files for own orders') THEN
    create policy "users read delivery files for own orders"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'delivery-files' and (
      public.has_role(auth.uid(),'admin') or exists (
        select 1 from public.orders o
        where o.user_id = auth.uid()
        and (storage.foldername(name))[1] = o.id::text
      )
    )
  );
  END IF;
END $$;


-- ============================================
-- Migration: 20260509211929_d7be5c6d-854c-47ab-955f-8bd58034bc8b.sql
-- ============================================


-- Pin search_path on remaining functions
alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Revoke direct execute on SECURITY DEFINER helpers (RLS still uses them internally)
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Restrict public bucket listing: only allow GET on a specific object, not LIST/enumerate
drop policy if exists "public read product images" on storage.objects;
drop policy if exists "public read category banners" on storage.objects;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public get product image') THEN
    create policy "public get product image"
  on storage.objects for select
  using (bucket_id = 'product-images' and auth.role() = 'anon' is not null);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public get category banner') THEN
    create policy "public get category banner"
  on storage.objects for select
  using (bucket_id = 'category-banners' and auth.role() = 'anon' is not null);
  END IF;
END $$;


-- ============================================
-- Migration: 20260511003525_cf33352e-93bc-4179-a051-f50504508658.sql
-- ============================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS price_dzd numeric;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS warranty text;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS delivery_method text;

-- ============================================
-- Migration: 20260511003550_85cbee4f-61a2-4f29-832e-fc9a42f48dc8.sql
-- ============================================

ALTER TABLE public.products DROP COLUMN IF EXISTS supplier;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS supplier text;

-- ============================================
-- Migration: 20260511004519_150d7d2f-82dc-4e43-a5b7-df67f01e2f35.sql
-- ============================================

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- ============================================
-- Migration: 20260511083644_0c581145-9245-4982-bdde-379872abf2c1.sql
-- ============================================


-- enable realtime for order chat
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='order_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages';
  END IF;
END $$;

-- storage policies for receipts bucket: users can upload/read in their own folder (user_id/...)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users upload own receipts') THEN
    CREATE POLICY "users upload own receipts" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id='receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users read own receipts') THEN
    CREATE POLICY "users read own receipts" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id='receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
  END IF;
END $$;


-- ============================================
-- Migration: 20260511090127_6d8f88f5-086b-4b17-87ec-b0d8903c8288.sql
-- ============================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rating numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_price_dzd numeric;

-- ============================================
-- Migration: 20260511094125_6c3896d6-27a9-42f4-86de-7a90395a476e.sql
-- ============================================

CREATE INDEX IF NOT EXISTS idx_order_messages_created_at_desc
ON public.order_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_created_desc
ON public.order_messages (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
ON public.orders (created_at DESC);

-- ============================================
-- Migration: 20260511095131_3b73e94e-d528-48e9-9df5-1a71135ecddd.sql
-- ============================================

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================
-- Migration: 20260511102721_a12f634b-8dec-4d28-af83-328e9a501405.sql
-- ============================================

create or replace function public.confirm_order_receipt(_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_already_completed boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select exists (
    select 1
    from public.orders
    where id = _order_id
      and user_id = v_user_id
      and status = 'completed'
  ) into v_already_completed;

  if v_already_completed then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true);
  end if;

  update public.orders
  set status = 'completed', updated_at = now()
  where id = _order_id
    and user_id = v_user_id
    and delivered_payload is not null
    and status = 'delivered'
  returning id into v_order_id;

  if v_order_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_confirmable');
  end if;

  insert into public.order_messages (order_id, sender_id, is_admin, internal_note, body)
  values (v_order_id, v_user_id, false, false, '✅ أكدت استلام المنتج. شكراً لكم!');

  return jsonb_build_object('ok', true, 'alreadyConfirmed', false);
end;
$$;

grant execute on function public.confirm_order_receipt(uuid) to authenticated;

-- ============================================
-- Migration: 20260511102745_a69f35cd-a733-4dd2-83ff-3037b67a7f5b.sql
-- ============================================

revoke all on function public.confirm_order_receipt(uuid) from public;
revoke all on function public.confirm_order_receipt(uuid) from anon;
grant execute on function public.confirm_order_receipt(uuid) to authenticated;

-- ============================================
-- Migration: 20260511102833_35fc0a04-f067-4c3e-a01c-84292fc57927.sql
-- ============================================

drop function if exists public.confirm_order_receipt(uuid);

create or replace function public.prevent_customer_order_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if auth.uid() = old.user_id
    and old.status = 'delivered'
    and new.status = 'completed'
    and old.delivered_payload is not null
    and new.id = old.id
    and new.order_number = old.order_number
    and new.user_id = old.user_id
    and new.product_id = old.product_id
    and new.offer_id = old.offer_id
    and new.quantity = old.quantity
    and new.unit_price_usd = old.unit_price_usd
    and new.total_usd = old.total_usd
    and new.total_dzd = old.total_dzd
    and new.exchange_rate_used = old.exchange_rate_used
    and new.payment_method = old.payment_method
    and new.payment_status = old.payment_status
    and new.delivery_type = old.delivery_type
    and new.coupon_id is not distinct from old.coupon_id
    and new.internal_notes is not distinct from old.internal_notes
    and new.delivered_payload is not distinct from old.delivered_payload
    and new.delivered_at is not distinct from old.delivered_at
    and new.created_at = old.created_at
  then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'Only receipt confirmation is allowed';
end;
$$;

revoke all on function public.prevent_customer_order_tampering() from public;
revoke all on function public.prevent_customer_order_tampering() from anon;
revoke all on function public.prevent_customer_order_tampering() from authenticated;

drop trigger if exists prevent_customer_order_tampering on public.orders;
create trigger prevent_customer_order_tampering
before update on public.orders
for each row
execute function public.prevent_customer_order_tampering();

drop policy if exists "users confirm delivered orders" on public.orders;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users confirm delivered orders') THEN
    create policy "users confirm delivered orders"
on public.orders
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'delivered'
  and delivered_payload is not null
)
with check (
  user_id = auth.uid()
  and status = 'completed'
);
  END IF;
END $$;

-- ============================================
-- Migration: 20260511103008_826d10c2-7871-41c6-99f3-711412fe0697.sql
-- ============================================

create or replace function public.prevent_customer_order_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_same_order_data boolean;
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  v_same_order_data := auth.uid() = old.user_id
    and new.id = old.id
    and new.order_number = old.order_number
    and new.user_id = old.user_id
    and new.product_id = old.product_id
    and new.offer_id = old.offer_id
    and new.quantity = old.quantity
    and new.unit_price_usd = old.unit_price_usd
    and new.total_usd = old.total_usd
    and new.total_dzd = old.total_dzd
    and new.exchange_rate_used = old.exchange_rate_used
    and new.payment_method = old.payment_method
    and new.delivery_type = old.delivery_type
    and new.coupon_id is not distinct from old.coupon_id
    and new.internal_notes is not distinct from old.internal_notes
    and new.delivered_payload is not distinct from old.delivered_payload
    and new.delivered_at is not distinct from old.delivered_at
    and new.created_at = old.created_at;

  if v_same_order_data
    and old.status = 'delivered'
    and new.status = 'completed'
    and new.payment_status = old.payment_status
    and old.delivered_payload is not null
  then
    new.updated_at = now();
    return new;
  end if;

  if v_same_order_data
    and old.payment_status = 'pending'
    and new.payment_status = 'submitted'
    and new.status = 'submitted'
    and exists (
      select 1 from public.payment_receipts r
      where r.order_id = old.id and r.user_id = auth.uid()
    )
  then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'Only payment submission or receipt confirmation is allowed';
end;
$$;

revoke all on function public.prevent_customer_order_tampering() from public;
revoke all on function public.prevent_customer_order_tampering() from anon;
revoke all on function public.prevent_customer_order_tampering() from authenticated;

drop policy if exists "users mark payment submitted" on public.orders;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users mark payment submitted') THEN
    create policy "users mark payment submitted"
on public.orders
for update
to authenticated
using (
  user_id = auth.uid()
  and payment_status = 'pending'
  and exists (
    select 1 from public.payment_receipts r
    where r.order_id = orders.id and r.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and payment_status = 'submitted'
  and status = 'submitted'
);
  END IF;
END $$;

-- ============================================
-- Migration: 20260511103315_3d1b9cf7-d045-452d-a8cf-e98f34e9a4c7.sql
-- ============================================

create or replace function public.prevent_customer_order_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_same_order_data boolean;
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  v_same_order_data := auth.uid() = old.user_id
    and new.id = old.id
    and new.order_number = old.order_number
    and new.user_id = old.user_id
    and new.product_id = old.product_id
    and new.offer_id = old.offer_id
    and new.quantity = old.quantity
    and new.unit_price_usd = old.unit_price_usd
    and new.total_usd = old.total_usd
    and new.total_dzd = old.total_dzd
    and new.exchange_rate_used = old.exchange_rate_used
    and new.payment_method = old.payment_method
    and new.delivery_type = old.delivery_type
    and new.coupon_id is not distinct from old.coupon_id
    and new.internal_notes is not distinct from old.internal_notes
    and new.delivered_payload is not distinct from old.delivered_payload
    and new.delivered_at is not distinct from old.delivered_at
    and new.created_at = old.created_at;

  if v_same_order_data
    and old.status = 'delivered'
    and new.status = 'completed'
    and new.payment_status = old.payment_status
    and old.delivered_payload is not null
  then
    new.updated_at = now();
    return new;
  end if;

  if v_same_order_data
    and old.payment_status = 'pending'
    and new.payment_status = 'submitted'
    and new.status = 'submitted'
    and exists (
      select 1 from public.payment_receipts r
      where r.order_id = old.id and r.user_id = auth.uid()
    )
  then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'Only payment submission or receipt confirmation is allowed';
end;
$$;

revoke all on function public.prevent_customer_order_tampering() from public;
revoke all on function public.prevent_customer_order_tampering() from anon;
revoke all on function public.prevent_customer_order_tampering() from authenticated;

with target_order as (
  select id
  from public.orders
  where order_number = 'VLT-260511-1e73f'
)
update public.orders o
set payment_status = 'submitted', updated_at = now()
from target_order t
where o.id = t.id
  and o.payment_status = 'pending'
  and exists (select 1 from public.payment_receipts r where r.order_id = o.id);

with target_order as (
  select id
  from public.orders
  where order_number = 'VLT-260511-1e73f'
), duplicate_confirms as (
  select m.id,
         row_number() over (partition by m.order_id, m.body order by m.created_at asc) as rn
  from public.order_messages m
  join target_order t on t.id = m.order_id
  where m.body = '✅ أكدت استلام المنتج. شكراً لكم!'
)
delete from public.order_messages m
using duplicate_confirms d
where m.id = d.id
  and d.rn > 1;

-- ============================================
-- Migration: 20260511111025_963f673a-5fc5-4329-9a07-d73863e8e293.sql
-- ============================================


CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  suggestions text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id, created_at DESC);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read reviews') THEN
    CREATE POLICY "public read reviews"
ON public.product_reviews FOR SELECT
USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users insert own reviews on completed orders') THEN
    CREATE POLICY "users insert own reviews on completed orders"
ON public.product_reviews FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.user_id = auth.uid()
      AND o.product_id = product_reviews.product_id
      AND o.status = 'completed'
  )
);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users update own reviews') THEN
    CREATE POLICY "users update own reviews"
ON public.product_reviews FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage reviews') THEN
    CREATE POLICY "admins manage reviews"
ON public.product_reviews FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
  END IF;
END $$;


-- ============================================
-- Migration: 20260511121400_f8c255d9-9ae9-4008-9a30-f1c081efeb71.sql
-- ============================================

-- Public-facing profile view (only safe fields)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker=on) AS
  SELECT id, full_name, created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Allow anyone to read minimal profile info (name only) so reviews can show author
DROP POLICY IF EXISTS "public read profile names" ON public.profiles;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read profile names') THEN
    CREATE POLICY "public read profile names"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);
  END IF;
END $$;

-- Function: buyer count (distinct paid users) for a product
CREATE OR REPLACE FUNCTION public.product_buyer_count(_product_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::int
  FROM public.orders
  WHERE product_id = _product_id
    AND status IN ('delivered','completed');
$$;

-- Function: user public score (completed orders, total spent dzd, review count)
CREATE OR REPLACE FUNCTION public.user_public_stats(_user_id uuid)
RETURNS TABLE(orders_count int, total_spent_dzd numeric, reviews_count int, score int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH o AS (
    SELECT COUNT(*)::int AS cnt, COALESCE(SUM(total_dzd),0) AS spent
    FROM public.orders
    WHERE user_id = _user_id AND status = 'completed'
  ),
  r AS (
    SELECT COUNT(*)::int AS cnt FROM public.product_reviews WHERE user_id = _user_id
  )
  SELECT o.cnt, o.spent, r.cnt,
    (o.cnt * 10 + (o.spent / 1000)::int + r.cnt * 5)::int AS score
  FROM o, r;
$$;

GRANT EXECUTE ON FUNCTION public.product_buyer_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_public_stats(uuid) TO anon, authenticated;

-- ============================================
-- Migration: 20260511121420_0cb6c6df-603c-4de9-9b6e-fd56a96c9b6d.sql
-- ============================================

DROP POLICY IF EXISTS "public read profile names" ON public.profiles;

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
  SELECT id, full_name, created_at FROM public.profiles;
ALTER VIEW public.public_profiles OWNER TO postgres;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS TABLE(id uuid, full_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, created_at FROM public.profiles WHERE id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- ============================================
-- Migration: 20260511121432_b463d792-bc03-4f04-acec-b982f8b12388.sql
-- ============================================

DROP VIEW IF EXISTS public.public_profiles;

-- ============================================
-- Migration: 20260516115335_eb7ecc2f-699e-4b52-8ccc-2c658351c2b1.sql
-- ============================================

-- Allow admins to delete order messages (clear conversations)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins delete messages') THEN
    CREATE POLICY "admins delete messages"
ON public.order_messages
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ============================================
-- Migration: 20260516135056_9682a98f-fcd3-445e-83ea-2de989353fb7.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true,
  ad_banner_url text,
  ad_banner_link text,
  ad_banner_visible boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = true)
);

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public read site settings') THEN
    CREATE POLICY "public read site settings" ON public.site_settings FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage site settings') THEN
    CREATE POLICY "admins manage site settings" ON public.site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- Migration: 20260516150103_e3ba128a-7cec-4edc-86bf-47bfd64c4853.sql
-- ============================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS family TEXT;
CREATE INDEX IF NOT EXISTS idx_products_family ON public.products(family);

-- ============================================
-- Migration: 20260516210941_0c13c72d-6701-4189-a589-938cf5bf4d7b.sql
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins delete orders') THEN
    CREATE POLICY "admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins delete receipts') THEN
    CREATE POLICY "admins delete receipts" ON public.payment_receipts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ============================================
-- Migration: 20260516213532_13d38ec6-137d-469e-b3c1-7c0dd466024d.sql
-- ============================================


ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

CREATE TABLE IF NOT EXISTS public.telegram_admin_state (
  chat_id BIGINT PRIMARY KEY,
  awaiting_note_order_id UUID,
  awaiting_note_receipt_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_admin_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage telegram state') THEN
    CREATE POLICY "admins manage telegram state"
ON public.telegram_admin_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;


-- ============================================
-- Migration: 20260516214615_0b7e6132-89be-40a1-9450-ba8dc49e66df.sql
-- ============================================


-- Telegram → website user linking
CREATE TABLE IF NOT EXISTS public.telegram_users (
  chat_id bigint primary key,
  user_id uuid not null,
  username text,
  first_name text,
  linked_at timestamptz not null default now()
);

alter table public.telegram_users enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users see own telegram link') THEN
    create policy "users see own telegram link"
  on public.telegram_users for select
  to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage telegram users') THEN
    create policy "admins manage telegram users"
  on public.telegram_users for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Temporary link tokens generated by the bot
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token text primary key,
  chat_id bigint not null,
  username text,
  first_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used boolean not null default false
);

alter table public.telegram_link_tokens enable row level security;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage link tokens') THEN
    create policy "admins manage link tokens"
  on public.telegram_link_tokens for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Extend state table to track customer purchase flow
alter table public.telegram_admin_state
  add column if not exists awaiting_receipt_offer_id uuid,
  add column if not exists awaiting_receipt_payment_method text,
  add column if not exists awaiting_receipt_quantity integer;


-- ============================================
-- Migration: 20260516220019_f8880099-63f1-4060-a0e9-a71045baea67.sql
-- ============================================


CREATE TABLE IF NOT EXISTS public.telegram_chat_prefs (
  chat_id bigint PRIMARY KEY,
  language text NOT NULL DEFAULT 'ar',
  currency text NOT NULL DEFAULT 'DZD',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_chat_prefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage chat prefs') THEN
    CREATE POLICY "admins manage chat prefs"
ON public.telegram_chat_prefs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;


-- ============================================
-- Migration: 20260516224322_d74b8bea-3c53-425f-b3ba-57ef4c19c939.sql
-- ============================================

ALTER TABLE public.payment_receipts
ADD COLUMN IF NOT EXISTS telegram_notified_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_payment_receipts_telegram_notified
ON public.payment_receipts (telegram_notified_at)
WHERE telegram_notified_at IS NOT NULL;

-- ============================================
-- Migration: 20260516224348_83a068e9-af80-4b1c-babf-ff527f31a4be.sql
-- ============================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
ADD COLUMN IF NOT EXISTS telegram_message_id bigint,
ADD COLUMN IF NOT EXISTS telegram_notified_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_orders_telegram_notified
ON public.orders (telegram_notified_at)
WHERE telegram_notified_at IS NOT NULL;

-- ============================================
-- Migration: 20260516224421_3358e5e5-71a8-4f27-af9f-091b937b23ae.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id bigint PRIMARY KEY,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admins manage processed telegram updates') THEN
    CREATE POLICY "admins manage processed telegram updates"
    ON public.telegram_processed_updates
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ============================================
-- Migration: 20260516225210_b150e71d-5a86-480a-a418-30e0ea17bc9d.sql
-- ============================================

ALTER TABLE public.telegram_admin_state
ADD COLUMN IF NOT EXISTS app_message_id bigint;

-- ============================================
-- Migration: 20260615143000_add_product_url_to_offers.sql
-- ============================================

ALTER TABLE product_offers ADD COLUMN IF NOT EXISTS product_url TEXT;


