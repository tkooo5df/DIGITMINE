ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rating numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_price_dzd numeric;