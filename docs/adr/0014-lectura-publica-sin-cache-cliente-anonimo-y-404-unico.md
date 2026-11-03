# ADR 0014: Lectura pública sin caché: cliente anónimo sin cookies, `force-dynamic` y un único 404

- **Estado:** Propuesto (2026-11-03), pendiente de que lo acepte el humano
- **Fecha:** 2026-11-03

## Contexto
El blog público (`/`, `/blog`, `/blog/[slug]`, `/categorias/[slug]`) muestra solo entradas publicadas. Las políticas RLS (ADR 0008) ya impiden que `anon` lea un borrador, pero el diseño de las páginas puede reabrir el problema de dos formas: usar el cliente con cookies de sesión (el admin con sesión abierta vería sus borradores en una página pública) y servir una copia en caché de una entrada que acaba de despublicarse. Además, un 404 distinto para "borrador" y "no existe" revelaría que el borrador existe.

## Decisión
- **Cliente anónimo sin sesión** (`createPublicClient`, `lib/supabase/public.ts`): clave pública, `persistSession: false` y sin cookies. Las páginas públicas nunca usan el cliente con cookies, el del navegador ni la clave de servicio. Un e2e comprueba que, con la sesión del admin abierta, el borrador sigue dando 404.
- **Siempre dinámico, sin ninguna caché:** cada página pública exporta `dynamic = "force-dynamic"` y `next.config.ts` fija `Cache-Control: no-store` (sin `noindex`: es público e indexable). No hay `unstable_cache`, ni `revalidate`, ni `force-cache`, ni `generateStaticParams`. Una despublicación surte efecto en la siguiente petición. Un test de arquitectura lo vigila y un e2e despublica y publica y recarga.
- **Doble barrera:** RLS es la fuente de verdad y, además, cada consulta lleva `.eq("status", "published")`. Un test de integración pasa el cliente de un admin a las funciones de lectura y comprueba que aun así solo salen publicadas.
- **Un único 404:** borrador, entrada despublicada, slug inexistente y slug raro dan exactamente la misma página (`app/not-found.tsx`), sin eco del slug. El slug se valida con `isValidSlug` (la misma regla que la lógica de slugs, reutilizada y no copiada) **antes** de consultar la base de datos.
- **Una caída de infraestructura no es un 404 ni una lista vacía:** las funciones de lectura devuelven `ok`, `not-found` o `error`; el `error` muestra una página de error genérica, sin mensaje ni traza (A10).
- **Columnas explícitas** en las consultas: nunca `*`, nunca el autor ni el estado. `cache()` de React comparte la lectura entre la página y sus metadatos dentro de **una** petición; no guarda nada entre peticiones.
- **`next build` debe poder prerenderizar todo lo demás:** cualquier `catch` alrededor de `cookies()` o `headers()` debe dejar pasar los errores internos de Next con `unstable_rethrow`. Esto se descubrió al ejecutar el `build` por primera vez: el bloque 4 lo capturaba todo y `/admin` no se podía compilar (corregido en `f8af840`).

## Consecuencias
- **Coste:** una consulta a Supabase por visita (y por página de entrada una sola gracias a `cache()`), y ninguna caché de CDN. Se acepta por el tamaño del blog.
- **Límites declarados:** hasta 50 entradas por listado y sin paginación; la página de categoría obtiene primero los identificadores de sus entradas y luego las entradas, lo que no escalaría a miles de entradas por categoría.
- **Si más adelante se quiere ISR** hará falta revalidación bajo demanda desde el CRUD del panel (`revalidatePath`) y un nuevo ADR; hasta entonces una ventana de caché permitiría ver una entrada despublicada.
- **El service worker de la PWA (Fase 3) no debe cachear estas rutas.**
- La portada y el resto de páginas públicas dejan de funcionar sin Supabase (muestran el error genérico); la comprobación de arranque de los e2e usa `/login`, que no lee datos.
- Relacionado: ADR 0003, ADR 0008 (RLS), ADR 0010 (autorización), ADR 0012 y ADR 0013 (Markdown sanitizado).
