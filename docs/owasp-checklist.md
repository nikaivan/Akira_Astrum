# Checklist OWASP Top 10:2025

Estado de cada categoría de [OWASP Top 10:2025](https://top10.owasp.org/2025/) en Akira Astrum, con la evidencia que lo demuestra. Cumple la fila «checklist OWASP completada con evidencias» de la definición de terminado (`PLAN.md` §11). Última revisión: 2026-11-04.

**Cómo leerlo.** Cada fila indica la medida, su estado y la evidencia (un archivo o un test del repositorio) con el comando para comprobarla. Lo que no se ha hecho figura como no hecho y no cita evidencia; lo que está a medias explica qué falta. Un test (`tests/unit/docs/owasp-checklist.test.ts`) vigila que toda ruta citada exista y que el resumen final enumere todo lo pendiente.

| Estado | Significado |
|---|---|
| ✅ Hecho | Implementado y demostrado por un archivo o un test que se puede ejecutar |
| ⚠️ Parcial | Hecho en parte; la columna «Qué falta» dice qué queda |
| ❌ No hecho | No implementado o no comprobado; sin evidencia |

Comandos de verificación habituales: `npm test` (unitarios), `npm run test:integration` (contra el proyecto de Supabase de test) y `npm run test:e2e` (Playwright en escritorio y móvil).

## A01 Broken Access Control

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Las políticas RLS limitan la escritura al admin y la lectura pública a lo publicado | ✅ Hecho | `supabase/migrations/20261102230100_access_control.sql`, `tests/integration/posts-unprivileged.test.ts`, `tests/integration/posts-admin.test.ts`, `tests/integration/profiles-role.test.ts` | — | `npm run test:integration` |
| El rol admin se comprueba en el servidor en cada capa (proxy, páginas y Server Actions) | ✅ Hecho | `proxy.ts`, `lib/auth/require-admin.ts`, `lib/auth/authorize.ts`, `tests/unit/auth/authorize.test.ts`, `tests/unit/auth/require-admin.test.ts`, `tests/unit/admin/actions-authorization.test.ts`, `tests/integration/authorize-real.test.ts` | — | `npm test` |
| Sin sesión se redirige a `/login` y sin rol admin se recibe un 403 | ✅ Hecho | `tests/e2e/auth.spec.ts`, `tests/e2e/admin.spec.ts` | — | `npm run test:e2e -- tests/e2e/auth.spec.ts` |
| Storage: solo el admin sube y borra; la lectura es pública | ✅ Hecho | `supabase/migrations/20261102230200_storage.sql`, `tests/integration/storage.test.ts` | — | `npm run test:integration` |

## A02 Security Misconfiguration

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Cabeceras de seguridad y CSP con nonce por petición | ✅ Hecho | `lib/security/csp.ts`, `lib/security/headers.ts`, `proxy.ts`, `tests/unit/security/csp.test.ts`, `tests/unit/security/headers.test.ts`, `tests/unit/security/proxy.test.ts`, `tests/e2e/security-headers.spec.ts`, `docs/adr/0019-csp-con-nonce-por-peticion-excepcion-de-estilos-en-atributos-y-cabeceras-estaticas.md` | — | `npm run test:e2e -- tests/e2e/security-headers.spec.ts` |
| `X-Powered-By` desactivado | ✅ Hecho | `next.config.ts`, `tests/unit/security/headers.test.ts` | — | `npm test` |
| Registro público desactivado en el proyecto de test | ✅ Hecho | `tests/integration/auth-api.test.ts`, `tests/e2e/auth.spec.ts` | — | `npm run test:integration` |
| Registro público desactivado en producción | ⚠️ Parcial | `docs/ai-log.md` | Se desactivó y se comprobó a mano en el panel de Supabase el 2026-11-03; no hay un test que lo confirme en producción. Repetir la comprobación tras el despliegue final | Panel de Supabase de producción: Authentication, Sign In / Providers |
| Bucket de imágenes con tipos y tamaño limitados | ✅ Hecho | `supabase/migrations/20261102230200_storage.sql`, `tests/integration/storage.test.ts`, `tests/unit/storage/image-validation.test.ts` | — | `npm run test:integration` |
| HSTS en producción | ⚠️ Parcial | `lib/security/headers.ts`, `tests/unit/security/headers.test.ts` | El test comprueba la cabecera solo en la configuración de producción; falta comprobarla en la URL desplegada (Fase 4) | `npm test` |
| Escaneo ZAP baseline | ❌ No hecho | — | El script está preparado (`npm run zap`) pero aún no se ha ejecutado y no hay informe. Ver la sección «Escaneo ZAP baseline» | `npm run zap` |

## A03 Software Supply Chain Failures

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Versiones exactas, lockfile íntegro, sin scripts de instalación de terceros y licencias revisadas | ✅ Hecho | `tests/unit/supply-chain/dependencies.test.ts`, `docs/adr/0021-cadena-de-suministro-versiones-exactas-lista-de-dependencias-revisadas-y-auditoria-en-la-ci.md` | — | `npm test` |
| `npm ci` y `npm audit` en cada PR, con producción sin ningún aviso | ✅ Hecho | `.github/workflows/ci.yml` | — | `npm audit --omit=dev` |
| Revisión manual de cada dependencia nueva (nombre exacto, mantenimiento y licencia) | ✅ Hecho | `docs/ai-log.md`, `tests/unit/supply-chain/dependencies.test.ts` | — | `npm test` |
| Dependabot agrupado, sin saltos mayores de npm | ✅ Hecho | `.github/dependabot.yml`, `tests/unit/supply-chain/dependabot-majors.test.ts` | — | `npm test` |
| Avisos de desarrollo de `deepmerge` y `minimatch` (vía `shadcn`) | ⚠️ Parcial | `docs/adr/0021-cadena-de-suministro-versiones-exactas-lista-de-dependencias-revisadas-y-auditoria-en-la-ci.md` | Son 2 avisos de desarrollo aceptados en el ADR (no están en producción). Falta decidir si se descartan en GitHub, en Security, Dependabot, con su razón | `npm audit` |
| Acciones de GitHub fijadas por hash de commit | ❌ No hecho | — | Van fijadas por versión mayor (por ejemplo `actions/checkout@v7`), no por hash; Dependabot las mantiene al día, pero un tag movido por un tercero no se detectaría | Revisar `.github/workflows/ci.yml` |

## A04 Cryptographic Failures

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Sin secretos en el repositorio ni en su historial | ✅ Hecho | `.gitignore`, `tests/unit/auth/architecture.test.ts` | — | `git log -p --all` filtrado con `grep -cE 'eyJ[A-Za-z0-9_-]{20,}\.'` da 0 coincidencias en los 125 commits revisados el 2026-11-04 |
| La clave de rol de servicio no aparece en `app/`, `lib/` ni `proxy.ts`, ni llega al cliente | ✅ Hecho | `tests/unit/auth/architecture.test.ts`, `tests/integration/support/environment.ts` | — | `npm test` |
| Cookies de sesión `httpOnly`, `sameSite: lax`, de 8 horas y `secure` en producción | ✅ Hecho | `lib/supabase/cookie-options.ts`, `tests/unit/auth/cookie-options.test.ts`, `tests/unit/auth/cookie-enforcement.test.ts`, `tests/e2e/auth.spec.ts` | — | `npm test` |
| Contraseñas y sesiones gestionadas por Supabase Auth, sin código propio de cifrado | ✅ Hecho | `lib/auth/login.ts`, `tests/integration/login-real.test.ts` | — | `npm run test:integration` |
| Solo HTTPS en producción (HSTS y `upgrade-insecure-requests`) | ⚠️ Parcial | `tests/unit/security/headers.test.ts`, `tests/unit/security/csp.test.ts` | Las cabeceras están probadas por test; falta comprobar que el despliegue real sirve solo por HTTPS (Fase 4) | `npm test` |

## A05 Injection

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| El Markdown se sanitiza con una lista blanca explícita y sin HTML crudo | ✅ Hecho | `lib/markdown/sanitize-schema.ts`, `tests/unit/markdown/sanitize.test.ts`, `tests/unit/markdown/links.test.ts`, `docs/adr/0013-markdown-publico-sanitizado-react-markdown-y-lista-blanca-explicita.md` | — | `npm test` |
| Las imágenes del Markdown solo pueden ser del Storage del proyecto | ✅ Hecho | `tests/unit/markdown/images.test.ts`, `tests/unit/markdown/content-images-render.test.ts` | — | `npm test` |
| Validación con Zod en el servidor (login, calculadora, panel y subidas) | ✅ Hecho | `lib/auth/schema.ts`, `lib/compatibility/schema.ts`, `lib/admin/posts/schema.ts`, `tests/unit/auth/schema.test.ts`, `tests/unit/compatibility/schema.test.ts`, `tests/unit/admin/post-schema.test.ts` | — | `npm test` |
| Todo el acceso a datos pasa por el cliente de Supabase, que parametriza las consultas, sin SQL escrito a mano | ✅ Hecho | `lib/blog/queries.ts`, `lib/admin/queries.ts` | — | `git grep -n -e ".rpc(" -e ".query(" -- app lib proxy.ts` no devuelve nada |
| Subidas: lista blanca por contenido, tamaño máximo y nombre generado | ✅ Hecho | `lib/storage/image-validation.ts`, `tests/unit/storage/image-validation.test.ts`, `tests/unit/admin/cover-service.test.ts` | — | `npm test` |
| Contenido hostil en el navegador (e2e) | ✅ Hecho | `tests/e2e/blog.spec.ts` | — | `npm run test:e2e -- tests/e2e/blog.spec.ts` |
| La CSP bloquea los scripts en línea no autorizados | ✅ Hecho | `tests/unit/security/csp.test.ts`, `tests/e2e/security-headers.spec.ts` | — | `npm test` |

## A06 Insecure Design

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Modelo de amenazas (STRIDE ligero) | ⚠️ Parcial | `docs/threat-model.md` | El documento sigue marcado «BORRADOR para revisión del arquitecto»: falta que se revise y se quite esa marca | Leer `docs/threat-model.md` |
| Decisiones de diseño relevantes registradas como ADR | ✅ Hecho | `docs/adr/README.md`, `docs/ai-log.md` | — | Leer `docs/adr/README.md` |
| Defensa en profundidad: proxy, capa 2 y RLS | ✅ Hecho | `docs/adr/0010-autorizacion-en-capas-proxy-requireadmin-y-rls.md`, `docs/adr/0003-seguridad-en-profundidad-rls-y-servidor.md` | — | `npm test` |
| La calculadora no guarda, registra ni envía las fechas | ✅ Hecho | `tests/unit/compatibility/no-persistence.test.ts`, `tests/unit/security/events-calculator.test.ts` | — | `npm test` |

## A07 Authentication Failures

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Límite de intentos de login, con bloqueo y recuperación | ✅ Hecho | `lib/auth/rate-limit.ts`, `tests/unit/auth/rate-limit.test.ts`, `tests/unit/security/events-login.test.ts`, `tests/e2e/auth.spec.ts` | — | `npm test` |
| Mensaje único ante cualquier fallo, sin enumeración de usuarios | ✅ Hecho | `tests/unit/auth/login.test.ts`, `tests/e2e/auth.spec.ts` | — | `npm test` |
| Sesión de 8 horas en una cookie `httpOnly` | ✅ Hecho | `tests/unit/auth/cookie-options.test.ts`, `tests/e2e/auth.spec.ts` | — | `npm test` |
| Sin registro de usuarios ni restablecimiento de contraseña | ✅ Hecho | `tests/unit/auth/architecture.test.ts` | — | `npm test` |
| Límite de consultas de la calculadora y de subidas del admin | ✅ Hecho | `tests/unit/compatibility/calculate-limit.test.ts`, `tests/unit/admin/image-action-limit.test.ts` | — | `npm test` |
| Los límites se comparten entre las instancias del servidor | ⚠️ Parcial | `docs/adr/0011-login-y-sesion-mensaje-unico-limitador-en-memoria-y-cookies.md`, `docs/adr/0020-registro-de-eventos-de-seguridad-sin-datos-personales-limites-en-serverless-y-fallo-cerrado.md` | Los límites son en memoria y por instancia: en serverless cada instancia cuenta aparte y un arranque en frío los reinicia | Leer los dos ADR |
| Autenticación multifactor (MFA con TOTP) | ❌ No hecho | — | No se ha implementado; Supabase la ofrece sin coste y queda como mejora pendiente | — |

## A08 Software or Data Integrity Failures

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| CI en cada PR y en `main` con lint, tests y auditoría | ✅ Hecho | `.github/workflows/ci.yml` | — | Pestaña Actions del repositorio |
| Instalación con `npm ci` y lockfile exacto | ✅ Hecho | `tests/unit/supply-chain/dependencies.test.ts`, `.github/workflows/ci.yml` | — | `npm test` |
| Sin scripts externos: la CSP solo admite el propio origen y el nonce de cada petición | ✅ Hecho | `lib/security/csp.ts`, `tests/unit/security/csp.test.ts` | — | `npm test` |
| Una versión nueva de la caché del service worker sustituye a la anterior | ✅ Hecho | `public/sw.js`, `tests/unit/pwa/service-worker.test.ts` | — | `npm test` |
| Comprobación manual tras un despliegue de que la caché nueva sustituye a la anterior | ⚠️ Parcial | `docs/adr/0022-pwa-minima-manifiesto-service-worker-que-solo-sirve-la-pagina-sin-conexion-y-nunca-guarda-contenido.md` | Los pasos están escritos en el ADR; se harán tras el despliegue (Fase 4) | Seguir el ADR |
| Despliegue solo desde `main` con los tests en verde | ❌ No hecho | — | Aún no hay despliegue (Fase 4, Vercel) | — |

## A09 Security Logging and Alerting Failures

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Eventos de seguridad estructurados y sin datos personales (login, acceso denegado, subida rechazada y límites) | ✅ Hecho | `lib/security/events.ts`, `lib/security/log.ts`, `tests/unit/security/events.test.ts`, `tests/unit/security/events-login.test.ts`, `tests/unit/security/events-access.test.ts`, `tests/unit/security/events-upload.test.ts`, `docs/adr/0020-registro-de-eventos-de-seguridad-sin-datos-personales-limites-en-serverless-y-fallo-cerrado.md` | — | `npm test` |
| Ni las fechas de la calculadora ni las contraseñas llegan al registro | ✅ Hecho | `tests/unit/security/events-calculator.test.ts`, `tests/unit/auth/login.test.ts` | — | `npm test` |
| Alertas automáticas ante esos eventos | ❌ No hecho | — | Solo está documentado qué eventos generarían una alerta y con qué umbral (ADR 0020); no hay ningún sistema de alertas | — |
| Registro de las acciones del admin (crear, publicar, borrar) | ❌ No hecho | — | Quedó fuera por decisión del arquitecto; es un pendiente declarado | — |

## A10 Mishandling of Exceptional Conditions

| Medida | Estado | Evidencia | Qué falta | Cómo verificarlo |
|---|---|---|---|---|
| Fallar cerrado: si falla la sesión, el rol o Supabase, se deniega | ✅ Hecho | `lib/auth/authorize.ts`, `tests/unit/auth/authorize.test.ts`, `tests/unit/security/proxy.test.ts`, `tests/integration/fail-closed.test.ts` | — | `npm run test:integration` |
| Mensajes genéricos, sin trazas ni detalles internos (acciones del panel, login, calculadora y página de error) | ✅ Hecho | `app/error.tsx`, `tests/unit/security/fail-closed-leaks.test.ts`, `tests/unit/compatibility/calculate-failure.test.ts` | — | `npm test` |
| Limpieza si una subida o un guardado se queda a medias | ✅ Hecho | `tests/unit/admin/image-cleanup.test.ts`, `tests/unit/admin/cover-service.test.ts`, `tests/integration/admin-cover.test.ts` | — | `npm run test:integration` |
| El registro de eventos nunca altera la respuesta | ✅ Hecho | `tests/unit/security/events-login.test.ts`, `tests/unit/security/events-access.test.ts` | — | `npm test` |

## Escaneo ZAP baseline

**Estado:** Pendiente de ejecutar

[OWASP ZAP](https://www.zaproxy.org/) en modo baseline: rastrea la aplicación y analiza las respuestas, sin lanzar ataques. Cumple la fila «escaneo ZAP baseline sin alertas altas pendientes» de la definición de terminado (`PLAN.md` §11).

**Cómo ejecutarlo** con `npm run zap` (en tu máquina, con Docker y un archivo `.env.test.local` con el proyecto de Supabase de test):

```bash
npm run zap
```

- `scripts/zap-baseline.sh` compila y arranca el **build de producción** en local (puerto 3300), porque la CSP y las cabeceras reales solo existen en producción, y ejecuta la imagen oficial `ghcr.io/zaproxy/zaproxy:stable` con `zap-baseline.py` (rastreo limitado a 3 minutos).
- **Solo el proyecto de test:** el script aborta si la URL de Supabase no es exactamente `https://<ref>.supabase.co`, con la referencia del proyecto de test. Lee solo tres variables del archivo, no usa la clave de rol de servicio ni imprime ninguna variable.
- Los informes quedan en `zap-reports/zap-baseline.html` y `zap-reports/zap-baseline.json` (carpeta ignorada por Git; no contienen secretos).
- En Linux usa la red del anfitrión; en macOS y Windows, `host.docker.internal`. En Windows hace falta WSL o Git Bash para ejecutar el script.
- **Límite:** no escanea la intranet, porque el baseline va sin sesión. Esa parte la cubren los tests de integración y los e2e (secciones A01, A07 y A10).
- **Plan B** si Docker no funciona: ZAP de escritorio apuntando a `http://localhost:3300`, con el mismo modo de rastreo y análisis pasivo; habría que anotar aquí qué se usó.

**Qué se rellena al ejecutarlo:** fecha, versión de ZAP, número de alertas por nivel, y qué se hizo con cada alerta. Una alerta alta se corrige antes de dar el sitio por terminado; las medias y las bajas se corrigen o se documentan con su motivo. Hasta entonces este apartado no lleva cifras ni fecha.

## Resumen de lo no hecho

Todo lo que no está completamente hecho en las tablas de arriba, sin esconder nada. Cada punto es una medida de su tabla.

**No hecho**
- Escaneo ZAP baseline
- Acciones de GitHub fijadas por hash de commit
- Autenticación multifactor (MFA con TOTP)
- Despliegue solo desde `main` con los tests en verde
- Alertas automáticas ante esos eventos
- Registro de las acciones del admin (crear, publicar, borrar)

**Parcial**
- Registro público desactivado en producción
- HSTS en producción
- Avisos de desarrollo de `deepmerge` y `minimatch` (vía `shadcn`)
- Solo HTTPS en producción (HSTS y `upgrade-insecure-requests`)
- Modelo de amenazas (STRIDE ligero)
- Los límites se comparten entre las instancias del servidor
- Comprobación manual tras un despliegue de que la caché nueva sustituye a la anterior
