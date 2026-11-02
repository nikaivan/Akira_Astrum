# ADR 0010: Autorización en capas (proxy, `requireAdmin` y RLS) que falla cerrado

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
La intranet (`/admin/*`) solo debe ser accesible para el admin (A01, A07, A10). En Next.js 16 el `proxy.ts` (antes `middleware`) no es una frontera de seguridad suficiente: la guía de Next recomienda comprobaciones solo "optimistas" en él, y los Server Actions y Route Handlers no pasan por el render de la página, de modo que cada uno puede invocarse directamente. Además, `supabase.auth.getSession()` lee la cookie sin validarla contra Supabase Auth y no sirve para autorizar. Los bloques anteriores ya fijaron el rol en `profiles.role` y las políticas RLS (ADR 0008).

## Decisión
- **Tres capas independientes**, de modo que si falla una, las otras siguen denegando:
  1. **`proxy.ts`** (solo `/admin/:path*`): sesión y rol. Sin sesión → redirección a `/login?next=…`; usuario sin rol admin → **403**; fallo de infraestructura → **503** genérico. Añade siempre `noindex` y `no-store`.
  2. **Acceso a datos** (`lib/auth/require-admin.ts`): `requireAdmin()` para páginas y layouts, `withAdminAction()` para Server Actions y `withAdminRoute()` para Route Handlers (401, 403 o 503 en JSON genérico). Se repite en cada uno, también el layout, que no se vuelve a ejecutar al navegar.
  3. **RLS en Postgres** (ADR 0008): aunque las dos anteriores fallaran, solo el admin escribe.
- **`getUser()`, nunca `getSession()`**, para autorizar. Un test de arquitectura vigila que `getSession(` no aparezca en `app/`, `lib/` ni `proxy.ts`.
- **El rol se lee de `profiles` con el JWT del propio usuario** (política `profiles_select_own`), sin `service_role` y sin leerlo del token: `user_metadata` lo puede editar cada usuario. No se llama a `private.is_admin()` desde la aplicación porque la API no expone el esquema `private`.
- **Falla cerrado (A10)**: cualquier excepción, dato ausente, respuesta malformada o rol distinto de la cadena exacta `"admin"` deniega. Los errores de autenticación del cliente (400, 401 y 403) son "no autenticado"; los de red o 5xx, "error de infraestructura" y nunca "permitido".
- **El 403 lo da el proxy**, porque `forbidden()` de Next es experimental (`experimental.authInterrupts`). La página y las acciones, si se llegaran a ejecutar sin permiso, lanzan un error genérico.
- **Tests de arquitectura** (análisis del código fuente) exigen que todo layout o página de `/admin` use `requireAdmin`, y que todo Server Action o Route Handler de `/admin` use `requireAdmin`, `withAdminAction` o `withAdminRoute`. La excepción explícita es `lib/auth/actions.ts` (login y logout).

## Consecuencias
- **Una consulta extra a Supabase por cada petición a `/admin`** (el proxy valida el token y lee el rol), y otra en la página. La guía de Next lo desaconseja por los prefetch; se acepta por el tamaño de la intranet.
- Un rol revocado o un perfil borrado dejan de valer en la siguiente petición, aunque la sesión siga viva (lo prueban los tests de integración).
- El 503 ante un fallo de Supabase es una denegación sin información, no una redirección.
- Los tests de arquitectura son análisis de texto: comprueban que se usan los envoltorios, no que se usen bien.
- Relacionado: ADR 0003 (seguridad en profundidad), ADR 0008 (control de acceso) y ADR 0011 (login y sesión).
