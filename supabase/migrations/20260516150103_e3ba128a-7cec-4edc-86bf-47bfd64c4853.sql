ALTER TABLE public.products ADD COLUMN IF NOT EXISTS family TEXT;
CREATE INDEX IF NOT EXISTS idx_products_family ON public.products(family);