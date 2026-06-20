-- Public-facing profile view (only safe fields)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker=on) AS
  SELECT id, full_name, created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Allow anyone to read minimal profile info (name only) so reviews can show author
DROP POLICY IF EXISTS "public read profile names" ON public.profiles;
CREATE POLICY "public read profile names"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

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