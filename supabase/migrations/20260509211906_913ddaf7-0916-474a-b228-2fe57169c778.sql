
-- =============================================================
-- ENUMS
-- =============================================================
create type public.app_role as enum ('admin', 'customer');
create type public.order_status as enum ('pending','submitted','verified','processing','delivered','completed','cancelled','refunded','disputed');
create type public.payment_status as enum ('pending','submitted','approved','rejected');
create type public.delivery_type as enum ('auto','manual');
create type public.payment_method as enum ('binance','baridimob','ccp');
create type public.coupon_type as enum ('percent','fixed');

-- =============================================================
-- PROFILES
-- =============================================================
create table public.profiles (
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
create table public.user_roles (
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
create table public.categories (
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
create table public.products (
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
create index on public.products (category_id);
create index on public.products (visible);

-- =============================================================
-- PRODUCT OFFERS
-- =============================================================
create table public.product_offers (
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
create index on public.product_offers (product_id);

-- =============================================================
-- AUTO-DELIVERY STOCK
-- =============================================================
create table public.auto_delivery_stock (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.product_offers(id) on delete cascade,
  payload text not null,            -- credentials / code
  used boolean not null default false,
  used_at timestamptz,
  used_by_order uuid,
  created_at timestamptz not null default now()
);
alter table public.auto_delivery_stock enable row level security;
create index on public.auto_delivery_stock (offer_id, used);

-- =============================================================
-- COUPONS
-- =============================================================
create table public.coupons (
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
create table public.exchange_rate (
  id uuid primary key default gen_random_uuid(),
  rate numeric(10,2) not null,        -- DZD per 1 USD
  set_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.exchange_rate enable row level security;

-- =============================================================
-- PAYMENT METHODS (settings)
-- =============================================================
create table public.payment_methods (
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
create table public.orders (
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
create index on public.orders (user_id);
create index on public.orders (status);
create index on public.orders (created_at desc);

-- =============================================================
-- PAYMENT RECEIPTS
-- =============================================================
create table public.payment_receipts (
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
create index on public.payment_receipts (order_id);
create index on public.payment_receipts (status);

-- =============================================================
-- ORDER MESSAGES (realtime chat)
-- =============================================================
create table public.order_messages (
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
create index on public.order_messages (order_id, created_at);
alter publication supabase_realtime add table public.order_messages;

-- =============================================================
-- AUDIT LOGS
-- =============================================================
create table public.audit_logs (
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
create index on public.audit_logs (created_at desc);

-- =============================================================
-- NOTIFICATIONS (admin-facing)
-- =============================================================
create table public.notifications (
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
create policy "users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id);
create policy "admins update any profile"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "users see own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- categories — public read, admin write
create policy "public read visible categories"
  on public.categories for select using (visible or public.has_role(auth.uid(),'admin'));
create policy "admins manage categories"
  on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- products — public read, admin write
create policy "public read visible products"
  on public.products for select using (visible or public.has_role(auth.uid(),'admin'));
create policy "admins manage products"
  on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- product_offers
create policy "public read active offers"
  on public.product_offers for select using (active or public.has_role(auth.uid(),'admin'));
create policy "admins manage offers"
  on public.product_offers for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- auto_delivery_stock — admin only
create policy "admins manage stock"
  on public.auto_delivery_stock for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- coupons
create policy "public read active coupons"
  on public.coupons for select using (active or public.has_role(auth.uid(),'admin'));
create policy "admins manage coupons"
  on public.coupons for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- exchange_rate — public read, admin write
create policy "public read rate"
  on public.exchange_rate for select using (true);
create policy "admins manage rate"
  on public.exchange_rate for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- payment_methods
create policy "public read active payment methods"
  on public.payment_methods for select using (active or public.has_role(auth.uid(),'admin'));
create policy "admins manage payment methods"
  on public.payment_methods for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- orders
create policy "users read own orders"
  on public.orders for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "users create own orders"
  on public.orders for insert to authenticated
  with check (user_id = auth.uid());
create policy "admins update orders"
  on public.orders for update to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- payment_receipts
create policy "users read own receipts"
  on public.payment_receipts for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "users create own receipts"
  on public.payment_receipts for insert to authenticated
  with check (user_id = auth.uid());
create policy "admins update receipts"
  on public.payment_receipts for update to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- order_messages
create policy "participants read messages"
  on public.order_messages for select to authenticated
  using (
    (not internal_note and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()))
    or public.has_role(auth.uid(),'admin')
  );
create policy "participants send messages"
  on public.order_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and (
      public.has_role(auth.uid(),'admin')
      or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    )
  );

-- audit_logs — admin only
create policy "admins read audit"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "admins write audit"
  on public.audit_logs for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));

-- notifications — admin only
create policy "admins read notifications"
  on public.notifications for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "admins update notifications"
  on public.notifications for update to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "system insert notifications"
  on public.notifications for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));

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
create policy "public read product images"
  on storage.objects for select using (bucket_id = 'product-images');
create policy "public read category banners"
  on storage.objects for select using (bucket_id = 'category-banners');

-- admin writes to public buckets
create policy "admins write product images"
  on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
create policy "admins write category banners"
  on storage.objects for all to authenticated
  using (bucket_id = 'category-banners' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'category-banners' and public.has_role(auth.uid(),'admin'));

-- receipts: user uploads own (path prefix = user id), admins read all
create policy "users upload own receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(auth.uid(),'admin')
    )
  );

-- delivery-files: admin uploads, buyer reads via order
create policy "admins manage delivery files"
  on storage.objects for all to authenticated
  using (bucket_id = 'delivery-files' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'delivery-files' and public.has_role(auth.uid(),'admin'));
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
