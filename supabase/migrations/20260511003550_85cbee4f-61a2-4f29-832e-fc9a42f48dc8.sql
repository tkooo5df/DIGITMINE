ALTER TABLE public.products DROP COLUMN IF EXISTS supplier;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS supplier text;