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