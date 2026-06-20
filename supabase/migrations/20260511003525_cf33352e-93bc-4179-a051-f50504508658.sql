ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS price_dzd numeric;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS warranty text;
ALTER TABLE public.product_offers ADD COLUMN IF NOT EXISTS delivery_method text;