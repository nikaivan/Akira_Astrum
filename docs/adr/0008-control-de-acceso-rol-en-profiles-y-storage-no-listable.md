# ADR 0008: Control de acceso: rol en `profiles`, `is_admin` en un esquema privado, privilegios mínimos y Storage no listable

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
`PLAN.md` §4 y §5 piden que solo el admin escriba, que el público lea únicamente lo publicado y que el rol se compruebe en servidor y en RLS (A01). Al diseñarlo había varios riesgos concretos:
- El rol podría leerse del token (JWT), pero `user_metadata` lo puede editar cada usuario.
- Supabase concede `ALL` por defecto a `anon` y `authenticated` sobre las tablas nuevas de `public`.
- Una política que consulta `profiles` para saber si alguien es admin puede volverse recursiva.
- En un bucket público, una política de lectura para `anon` permitiría listar los archivos y enumerar las portadas de los borradores.

## Decisión
- **El rol vive en `public.profiles.role`** (`'user'` o `'admin'`, por defecto `'user'`). **Nadie escribe en `profiles` por la API**, ni siquiera el admin: no hay política ni privilegio de escritura. El perfil admin se crea a mano con SQL, por ejemplo: `insert into public.profiles (id, display_name, role) values ('<uuid del usuario>', 'Admin', 'admin');`.
- **`private.is_admin()` determina el admin.** Consulta `profiles` por `auth.uid()` y `role = 'admin'`. **No lee el JWT** (ni `user_metadata` ni `app_metadata`) y se evalúa en cada petición, así que degradar o borrar a un admin surte efecto de inmediato. `exists(...)` devuelve `false`, nunca `null`: sin sesión, sin perfil o con otro rol se deniega (A10).
- **La función es `SECURITY DEFINER` con `search_path` vacío**, nombres cualificados y `EXECUTE` revocado a `PUBLIC` (concedido solo a `anon` y `authenticated`). Vive en el esquema `private`, que PostgREST no expone, por lo que no se puede llamar por `/rpc`. Es la única función `SECURITY DEFINER` de la aplicación.
- **Sin recursión:** la política de `profiles` solo usa `auth.uid()`; `is_admin()` lee `profiles` como propietaria, sin pasar por RLS (por eso no se usa `FORCE ROW LEVEL SECURITY`); `posts` y `post_categories` llaman a `is_admin()`, nunca a sí mismas. `post_categories` consulta `posts` con los derechos de quien llama, así que hereda su filtro y no filtra las categorías de los borradores.
- **Privilegios mínimos explícitos.** Se revoca todo a `anon` y `authenticated` y se concede solo lo necesario, aunque RLS ya filtre filas (segunda barrera). `author_id` y `created_at` no se pueden actualizar (privilegio por columna). `service_role` conserva todos los privilegios.
- **La base de datos repite como `CHECK` las reglas de la aplicación:** slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, hasta 80), título (1 a 200), `published_at` ligado al estado (ADR 0006) y `cover_image_path` con forma `UUID.jpg|png|webp` (sin rutas del cliente).
- **Storage:** bucket `post-images` público, de 2 MiB y solo JPEG, PNG y WebP (lo aplica el servicio de Storage). **Sin política de lectura para `anon`:** las URL públicas se ven, pero nadie puede listar el bucket. Solo el admin sube, reemplaza y borra, y el nombre del archivo debe ser un UUID con extensión permitida.

## Consecuencias
- Cambiar el rol de alguien exige SQL manual; no hay pantalla para ello. Si algún día hubiera más roles, haría falta un ADR nuevo.
- El conjunto exacto de políticas, privilegios y funciones lo vigila `tests/integration/structure.test.ts`: añadir o cambiar una política obliga a cambiar ese test.
- La expresión regular del nombre de archivo aparece dos veces en la migración de Storage (inserción y reemplazo). Es deliberado: factorizarla exigiría una tercera función en `private`, y el test pide exactamente dos.
- La firma real del archivo no se comprueba en la base de datos; el bucket solo ve el `Content-Type` que declara el cliente. La validación por contenido es de la aplicación (Fase 2, `PLAN.md` §5).
- Las migraciones (`supabase/migrations/`) no son repetibles y se aplican a mano.
- Relacionado: ADR 0003 (seguridad en profundidad) y ADR 0006 (`published_at`).
