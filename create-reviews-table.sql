-- ============================================
-- Create Product Reviews Table Only
-- ============================================

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON public.product_reviews(visible);

-- Enable Row Level Security
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view visible reviews" 
  ON public.product_reviews 
  FOR SELECT 
  USING (visible = true);

CREATE POLICY "Authenticated users can create reviews" 
  ON public.product_reviews 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own reviews" 
  ON public.product_reviews 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
  ON public.product_reviews 
  FOR DELETE 
  USING (auth.uid() = user_id);
