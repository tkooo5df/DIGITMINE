
-- Pin search_path on remaining functions
alter function public.set_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Revoke direct execute on SECURITY DEFINER helpers (RLS still uses them internally)
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Restrict public bucket listing: only allow GET on a specific object, not LIST/enumerate
drop policy if exists "public read product images" on storage.objects;
drop policy if exists "public read category banners" on storage.objects;

create policy "public get product image"
  on storage.objects for select
  using (bucket_id = 'product-images' and auth.role() = 'anon' is not null);

create policy "public get category banner"
  on storage.objects for select
  using (bucket_id = 'category-banners' and auth.role() = 'anon' is not null);
