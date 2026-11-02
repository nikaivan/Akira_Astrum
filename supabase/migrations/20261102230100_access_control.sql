-- Control de acceso (PLAN.md §4 y §5): quién es admin, privilegios mínimos y políticas RLS.

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- El admin se determina SOLO por la tabla profiles, nunca por el contenido del JWT
-- (user_metadata lo puede editar cada usuario). SECURITY DEFINER para leer profiles sin
-- pasar por su RLS (así no hay políticas recursivas); search_path fijo y sin EXECUTE para PUBLIC.
-- exists() devuelve false, nunca null: sin sesión, sin perfil o con otro rol, se deniega.
create function private.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Privilegios mínimos. Supabase concede ALL por defecto en public: se revoca y se concede
-- solo lo necesario (RLS filtra las filas; esto es una segunda barrera).
revoke all on public.profiles, public.posts, public.categories, public.post_categories
  from anon, authenticated;
grant all on public.profiles, public.posts, public.categories, public.post_categories
  to service_role;

grant select on public.posts, public.categories, public.post_categories to anon;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.posts, public.post_categories to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
-- author_id y created_at no se pueden actualizar.
grant update (title, slug, content_md, cover_image_path, status, published_at)
  on public.posts to authenticated;

alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.posts           enable row level security;
alter table public.post_categories enable row level security;

-- profiles: cada usuario lee solo su fila; nadie escribe por la API (ni siquiera el admin).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- categories: lectura pública; escribe el admin.
create policy categories_select on public.categories
  for select to anon, authenticated using (true);
create policy categories_insert_admin on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy categories_update_admin on public.categories
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete_admin on public.categories
  for delete to authenticated using ((select private.is_admin()));

-- posts: el público ve solo lo publicado; el admin ve y escribe todo.
create policy posts_select on public.posts
  for select to anon, authenticated
  using (status = 'published' or (select private.is_admin()));
create policy posts_insert_admin on public.posts
  for insert to authenticated
  with check ((select private.is_admin()) and author_id = (select auth.uid()));
create policy posts_update_admin on public.posts
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy posts_delete_admin on public.posts
  for delete to authenticated using ((select private.is_admin()));

-- post_categories: la subconsulta a posts hereda su RLS, así que solo se ven las
-- categorías de las entradas visibles (no se filtran las de los borradores).
create policy post_categories_select on public.post_categories
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_categories_insert_admin on public.post_categories
  for insert to authenticated with check ((select private.is_admin()));
create policy post_categories_delete_admin on public.post_categories
  for delete to authenticated using ((select private.is_admin()));
