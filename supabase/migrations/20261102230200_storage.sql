-- Bucket de imágenes de las entradas (PLAN.md §5).
-- Público para ver las imágenes por URL; solo el admin sube, reemplaza y borra.
-- El tipo y el tamaño los aplica el servicio de Storage con la configuración del bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Sin política de lectura para anon: las URL públicas funcionan, pero nadie puede listar
-- el bucket ni enumerar las portadas de borradores.
create policy post_images_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'post-images' and (select private.is_admin()));

-- Solo nombres generados: UUID con extensión permitida, sin carpetas ni rutas.
create policy post_images_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

create policy post_images_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and (select private.is_admin()))
  with check (
    bucket_id = 'post-images'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

create policy post_images_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (select private.is_admin()));
