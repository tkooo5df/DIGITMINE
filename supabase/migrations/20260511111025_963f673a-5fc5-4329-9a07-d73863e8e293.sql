
CREATE TABLE public.product_reviews (
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

CREATE POLICY "public read reviews"
ON public.product_reviews FOR SELECT
USING (true);

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

CREATE POLICY "users update own reviews"
ON public.product_reviews FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins manage reviews"
ON public.product_reviews FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
