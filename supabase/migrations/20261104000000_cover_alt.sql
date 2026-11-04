-- Texto alternativo de la portada de una entrada (Fase 2, bloque 4).
-- La aplicación lo exige siempre que haya portada; la base de datos solo acota su longitud.
-- Es una migración nueva: no modifica las tres anteriores.

alter table public.posts
  add column cover_alt text
  check (cover_alt is null or char_length(cover_alt) between 1 and 200);

-- El resto de columnas de escritura de posts ya tienen su privilegio de columna (ver 20261102230100).
grant update (cover_alt) on public.posts to authenticated;
