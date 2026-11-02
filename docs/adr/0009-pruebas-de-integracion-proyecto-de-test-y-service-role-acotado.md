# ADR 0009: Pruebas de integración contra un proyecto de test aparte, con guarda por ref y `service_role` acotado

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
RLS, los privilegios y Storage no se pueden probar de verdad con simulaciones: hay que ejecutarlos contra Supabase (`PLAN.md` §3). Eso trae riesgos:
- ejecutar los tests o las migraciones contra producción por error;
- que la clave `service_role`, que salta RLS, oculte un fallo de permisos;
- cargar por accidente las claves de producción (`.env.local`);
- que el entorno donde trabaja la IA no llegue a Supabase.

## Decisión
- **Proyecto de Supabase de test aparte**, con sus claves en `.env.test.local` (ignorado por Git). Se usan **solo los nombres** de las variables: `SUPABASE_TEST_PROJECT_REF`, `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` y `SUPABASE_TEST_SERVICE_ROLE_KEY`. La IA no lee ni escribe ningún `.env*`.
- **Guarda del entorno** (`tests/integration/support/environment.ts`), que aborta antes de cualquier petición si falta una variable, si la URL no es exactamente `https://<SUPABASE_TEST_PROJECT_REF>.supabase.co`, si las claves (JWT clásicos) no pertenecen a ese proyecto o no tienen el rol esperado, o si coincide con producción. Sus mensajes nombran la regla o la variable, nunca el valor. La cubren 34 tests unitarios que corren en `npm test`.
- **Solo se carga `.env.test.local`**: `vitest.integration.config.mts` usa `process.loadEnvFile` y `envDir: false`, para que Vite no cargue `.env.local`.
- **`npm test` ejecuta solo las pruebas unitarias.** Las de integración van aparte (`npm run test:integration`), sin paralelismo entre archivos, y no están en la CI porque necesitan secretos.
- **`service_role` acotada y documentada** (`tests/integration/README.md`). Solo en `support/service-role.ts`, para: crear y borrar usuarios de prueba; crear y borrar perfiles, entradas, categorías y objetos de Storage temporales; y leer metadatos con `test_catalog_report()`. **Nunca** en `app/` ni en `lib/`, y **nunca** para comprobar estados: eso se hace con la sesión del admin de prueba, para que no oculte un fallo de RLS.
- **Utilidad `test_catalog_report()`**: función de solo lectura de metadatos, ejecutable solo con `service_role`, que se pega a mano en el proyecto de test. **No es una migración y no se aplica a producción.**
- **Las migraciones se aplican a mano** en el editor SQL del proyecto de test, sin la CLI de Supabase (no hay estado local que pueda apuntar a producción).
- **Datos de prueba con prefijo único** por ejecución (`itest-<id>`); solo se borra lo que lo lleva. Cada usuario de prueba inicia sesión una sola vez por ejecución, para no acercarse a los límites de Auth.

## Consecuencias
- La integración real solo la ejecuta el humano. El entorno de la IA no llega a Supabase, así que la IA comprueba el SQL con una emulación en un PostgreSQL desechable. La emulación **no sustituye** a la ejecución real: en este bloque no detectó un fallo de preparación de un test que sí salió en Supabase.
- El proyecto de test necesita el registro de usuarios desactivado (A02), y un test lo comprueba.
- Los tests dependen de comportamientos de Supabase, por ejemplo que Storage responda 400 con un "404" en el cuerpo al pedir un objeto borrado. Una actualización de Supabase puede obligar a ajustar algún test.
- Los objetos de Storage no pueden llevar prefijo (su nombre debe ser un UUID), así que si una ejecución se interrumpe puede quedar alguna imagen de prueba en el bucket.
- Las pruebas de integración no corren en la CI. Si más adelante se quisiera, haría falta un proyecto efímero o un Supabase local en el pipeline.
- Relacionado: ADR 0002 (TDD), ADR 0003 (seguridad en profundidad) y ADR 0008 (control de acceso).
