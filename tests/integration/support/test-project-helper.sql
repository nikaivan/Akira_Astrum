-- =====================================================================================
-- SOLO PARA EL PROYECTO DE SUPABASE DE TEST. NO LO EJECUTES EN PRODUCCIÓN.
--
-- Crea public.test_catalog_report(): un informe de solo lectura con metadatos del
-- catálogo (tablas con su RLS, políticas, privilegios, funciones y el bucket) que los
-- tests de integración usan para comprobar la estructura. No lee ni escribe datos de
-- usuarios. Solo puede ejecutarla service_role.
--
-- No es una migración: no está en supabase/migrations/ y no debe llegar a producción.
-- Se puede ejecutar más de una vez.
-- =====================================================================================

create or replace function public.test_catalog_report()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tables', coalesce((
      select jsonb_agg(
        jsonb_build_object('schema', n.nspname, 'name', c.relname, 'rls', c.relrowsecurity)
        order by n.nspname, c.relname)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'storage') and c.relkind in ('r', 'p')
    ), '[]'::jsonb),

    'policies', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'schema', p.schemaname, 'table', p.tablename, 'name', p.policyname,
          'command', p.cmd, 'roles', to_jsonb(p.roles))
        order by p.schemaname, p.tablename, p.policyname)
      from pg_catalog.pg_policies p
      where p.schemaname in ('public', 'storage')
    ), '[]'::jsonb),

    'table_privileges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'table', t.relname, 'grantee', r.rolname,
          'privileges', (
            select coalesce(jsonb_agg(priv order by priv), '[]'::jsonb)
            from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as priv
            where pg_catalog.has_table_privilege(r.rolname, t.oid, priv)))
        order by t.relname, r.rolname)
      from pg_catalog.pg_class t
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
      cross join (select rolname from pg_catalog.pg_roles where rolname in ('anon', 'authenticated')) r
      where n.nspname = 'public' and t.relkind in ('r', 'p')
    ), '[]'::jsonb),

    'update_columns', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'table', t.relname, 'grantee', r.rolname,
          'columns', (
            select coalesce(jsonb_agg(a.attname order by a.attname), '[]'::jsonb)
            from pg_catalog.pg_attribute a
            where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
              and pg_catalog.has_column_privilege(r.rolname, t.oid, a.attnum, 'UPDATE')))
        order by t.relname, r.rolname)
      from pg_catalog.pg_class t
      join pg_catalog.pg_namespace n on n.oid = t.relnamespace
      cross join (select rolname from pg_catalog.pg_roles where rolname in ('anon', 'authenticated')) r
      where n.nspname = 'public' and t.relkind in ('r', 'p')
    ), '[]'::jsonb),

    'functions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'schema', n.nspname, 'name', p.proname, 'security_definer', p.prosecdef,
          'config', to_jsonb(coalesce(p.proconfig, array[]::text[])),
          'public_execute', exists (
            select 1
            from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
            where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
        order by n.nspname, p.proname)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.proname <> 'test_catalog_report'
    ), '[]'::jsonb),

    'bucket', (
      select to_jsonb(b)
      from (
        select id, name, public, file_size_limit, allowed_mime_types
        from storage.buckets
        where id = 'post-images'
      ) b
    )
  );
$$;

revoke all on function public.test_catalog_report() from public, anon, authenticated;
grant execute on function public.test_catalog_report() to service_role;
