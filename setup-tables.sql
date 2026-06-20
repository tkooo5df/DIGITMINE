-- Create minimal schema for product import

-- Create enums
DO $$ BEGIN
  CREATE TYPE public.delivery_type AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  category_id uuid,
  tags text[] DEFAULT '{}',
  main_image text,
  gallery text[] DEFAULT '{}',
  banner_image text,
  delivery_type public.delivery_type NOT NULL DEFAULT 'manual',
  featured boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  seo_title text,
  seo_description text,
  account_type text,
  offer_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create product_offers table
CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration text,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  price_dzd numeric(10,2) NOT NULL DEFAULT 0,
  discount_usd numeric(10,2),
  stock int NOT NULL DEFAULT 0,
  delivery_type public.delivery_type NOT NULL DEFAULT 'manual',
  delivery_notes text,
  delivery_method text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  account_type text,
  offer_type text,
  original_title text,
  supplier text,
  product_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_visible ON public.products(visible);
CREATE INDEX IF NOT EXISTS idx_offers_product_id ON public.product_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_active ON public.product_offers(active);

-- Create product_reviews table
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text,
  verified_purchase boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON public.product_reviews(visible);
