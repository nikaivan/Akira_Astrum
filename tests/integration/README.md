# Tests de integración (proyecto de Supabase de test)

Comprueban contra la **API real** (PostgREST, Auth y Storage) de un proyecto de Supabase
**aparte** que el esquema, las políticas RLS y el bucket de imágenes cumplen `PLAN.md` §4 y §5.

> **Nunca los ejecutes contra producción.** Los tests abortan antes de hacer ninguna petición
> si `SUPABASE_TEST_URL` no es exactamente `https://<SUPABASE_TEST_PROJECT_REF>.supabase.co`
> (ver `support/environment.ts`).

## Variables (solo los nombres; los valores van en `.env.test.local`, ignorado por Git)

| Variable | Contenido |
|---|---|
| `SUPABASE_TEST_PROJECT_REF` | El *project ref* del proyecto de test |
| `SUPABASE_TEST_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_TEST_ANON_KEY` | Clave anónima del proyecto de test |
| `SUPABASE_TEST_SERVICE_ROLE_KEY` | Clave `service_role` del proyecto de test |

El archivo se carga solo desde `vitest.integration.config.mts`. Vite **no** carga ningún otro `.env*`.

## Preparar el proyecto de test (una vez)

1. En *Authentication → Sign In / Providers*, desactiva el registro de nuevos usuarios. Un test lo comprueba.
2. En el editor SQL del proyecto de test, pega y ejecuta, en este orden:
   1. `support/test-project-helper.sql` (solo para test; crea `test_catalog_report()`).
   2. Las cuatro migraciones de `supabase/migrations/`, por orden de nombre (la cuarta, `20261104000000_cover_alt.sql`, añade `posts.cover_alt` para el texto alternativo de la portada).
   Antes de ejecutar, comprueba en pantalla que el proyecto es el de test.
3. Crea el perfil de un administrador real solo si lo necesitas fuera de los tests; los tests crean los suyos.

## Ejecutar

```bash
npm run test:integration
```

`npm test` **no** ejecuta estos tests (solo los unitarios).

## Uso de `service_role` (documentado)

La clave `service_role` salta RLS, así que su uso está acotado. **Solo** aparece en
`support/service-role.ts` (y la lee la guarda `support/environment.ts`). **Nunca** en `app/` ni en `lib/`.

| Uso | Dónde |
|---|---|
| Crear y borrar usuarios de prueba (`auth.admin`) | `createTestUser`, `deleteTestUser`, `withTempUser`, `createSessions` |
| Crear y borrar perfiles, entradas, categorías y objetos de Storage temporales | `seedContent`, `deleteProfile`, `cleanupPrefix`, `removeStorageObjects` |
| Intentar insertar un perfil con un rol inválido (debe fallar) | `tryInsertProfile` |
| Leer metadatos de la base de datos (solo lectura) | `catalogReport` |

**No** se usa para comprobar el estado tras un intento denegado: eso se hace con la sesión del
administrador de prueba, para que `service_role` no oculte un fallo de RLS.

Todo lo que se crea lleva un prefijo único por ejecución (`itest-<id>`) y solo se borra lo que lo lleva.
Los objetos de Storage no pueden llevarlo (sus nombres deben ser un UUID), así que cada test borra los
que sube; si una ejecución se interrumpe, puede quedar alguna imagen de prueba en el bucket.

## Notas

- Se inicia sesión una sola vez por usuario de prueba (3 por ejecución) para no acercarse a los
  límites de Auth. Los correos son `<prefijo>@example.test`; si tu proyecto los rechaza, cambia el dominio
  en `createTestUser`.
- `test-project-helper.sql` **no** es una migración y no debe aplicarse a producción.
- Límite de esta capa: el bucket solo ve el `Content-Type` que declara el cliente. La comprobación de la
  firma real del archivo es de la aplicación (Fase 2).
