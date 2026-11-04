# ADR 0020: Registro de eventos de seguridad sin datos personales, límites en serverless y fallo cerrado

- **Estado:** Aceptado (2026-11-04)
- **Fecha:** 2026-11-04

## Contexto
`PLAN.md` §5 pide para A07 un límite de intentos de login, para A09 registrar los eventos de seguridad (y documentar cuáles generarían una alerta) y para A10 fallar cerrado sin revelar detalles. Los límites ya existían y estaban probados (login 5 fallos cada 15 minutos por IP, ADR 0011; calculadora 30 consultas cada 10 minutos, ADR 0012; subidas 20 cada 10 minutos por admin, ADR 0016) y el fallo cerrado también (ADR 0010, 0015). **No existía ningún registro de eventos.** Mi encargo añadió que el registro no llevara datos personales, contraseñas ni las fechas de la calculadora. Decidí yo: identificar al cliente con un hash por instancia, registrar solo los eventos de mi lista (sin las acciones del admin) y permitir `console` solo en un archivo.

## Decisión
- **Vocabulario cerrado de eventos** (`lib/security/events.ts`): `login_succeeded`, `login_failed` (motivo: `invalid_input`, `credentials`, `not_admin`, `service_error`), `access_denied` (motivo: `forbidden`, `service_error`; capa: `proxy` o `page`), `upload_rejected` (motivo: `rate_limited`, `too_large`, `invalid_content`) y `rate_limited` (ámbito: `login` o `calculator`). Un evento, motivo, ámbito o capa fuera de esa lista no genera evento y no rompe la petición.
- **Lista blanca de campos:** `ts`, `level`, `event`, `reason`, `scope`, `layer`, `route`, `user` y `client`. Todo lo demás se descarta: correo, contraseña, fechas, nombres de archivo, tipos declarados, mensajes de error y trazas. La ruta es solo la ruta (sin consulta ni hash, hasta 100 caracteres, relativa al sitio); `user` solo se admite si es un UUID.
- **Cliente sin IP:** `clientId(ip)` es el SHA-256 de la IP con una **sal aleatoria que cambia en cada arranque**, recortado a 12 caracteres hexadecimales. Permite ver «el mismo cliente falló cinco veces» dentro de una instancia sin guardar la IP ni poder revertirla, y no necesita variables de entorno nuevas. No sirve para seguir a un cliente entre arranques ni entre instancias.
- **Una sola salida (`lib/security/log.ts`):** una línea JSON por evento (`console.warn` para avisos, `console.info` para informativos; Vercel la recoge). **No lanza nunca y no cambia el resultado** de quien lo llama. En `NODE_ENV=test` es silencioso salvo que un test instale un destino con `setSecuritySink()`, por lo que los tests aprobados que espían la consola siguen igual. Es el único archivo de la aplicación que escribe en la consola (un test de arquitectura lo vigila en `app/`, `lib/`, `components/` y `proxy.ts`).
- **Dónde se registra (una llamada por punto, sin cambiar firmas ni respuestas):** `performLogin` (el motivo solo existe en el registro; al usuario se le sigue devolviendo el mismo mensaje, ADR 0011), `recordAccessDenied` (el proxy y la capa 2: `requireAdmin` y `withAdminRoute`), `inspectCover` (punto único de portadas e imágenes del contenido) y la acción de la calculadora, que solo mira si el resultado es el mensaje de límite y **nunca lee las fechas**. Un cupo de subidas agotado se registra solo como `upload_rejected/rate_limited`, sin duplicarlo.
- **Qué NO se registra:** una visita a `/admin` sin sesión (cada visita anónima es normal y llenaría el registro), las fechas inválidas de la calculadora y las subidas correctas.
- **Fallo cerrado (A10):** el registro nunca altera la decisión (un destino que lanza una excepción deja el mismo 403, 503 o mensaje). Un barrido de tests comprueba que, con la autenticación caída, sin sesión o con un no admin, ninguna de las 9 acciones del panel escribe, sube ni borra, y que ninguna respuesta contiene detalles internos; y que `app/error.tsx` no muestra el mensaje, la traza ni el digest de un error.

## Límites en entornos serverless
Los limitadores son **en memoria y por instancia** (ADR 0011): cada instancia cuenta aparte, un arranque en frío los reinicia, quien disponga de muchas IPs los esquiva y quien comparta IP con un atacante queda bloqueado. Frenan la fuerza bruta casual; no son una garantía. Un límite persistente exigiría un servicio de pago o la clave `service_role`, que la aplicación no usa. Se apoyan en los límites propios de Supabase Auth y en una contraseña fuerte. En la Fase 4 se evaluarán las reglas de límite del propio hosting si son gratuitas (sin afirmar su disponibilidad hasta comprobarla en el despliegue). **MFA con TOTP sigue pendiente.** El identificador de cliente tiene el mismo alcance: por instancia.

## Qué generaría una alerta (documentado; no hay alertas automáticas)
| Evento | Umbral sugerido | Qué indica |
|---|---|---|
| `login_failed` / `rate_limited(login)` | 5 o más del mismo `client` en 15 minutos | Fuerza bruta o contraseña olvidada |
| `login_failed` / `service_error` | Varios seguidos de cualquier cliente | Supabase Auth caído o mal configurado |
| `access_denied` / `forbidden` | Cualquiera | Un usuario autenticado que no es admin intenta entrar al panel |
| `access_denied` / `service_error` | Varios en pocos minutos | La comprobación de rol falla (se deniega a todos) |
| `upload_rejected` | Ráfagas del mismo `user` | Subida de archivos hostiles o un cliente roto |
| `rate_limited(calculator)` | Muchos `client` distintos a la vez | Abuso distribuido de la calculadora |

## Consecuencias
- **Tests:** unitarios del vocabulario, la lista blanca, el identificador, el destino y la arquitectura; de los eventos de login, accesos, subidas y calculadora (sin correo, contraseña, fechas, nombres de archivo ni IP); de bloqueo y recuperación de login y subidas con reloj inyectado; y el barrido de fugas. Los de integración y e2e existentes no cambian y siguen en verde.
- **Sin e2e del registro:** Playwright no expone la salida del servidor y capturarla exigiría cambiar `playwright.config.ts`. Se comprobó a mano con `next build` y `next start`: seis intentos de login produjeron cinco `login_failed` y un `rate_limited`, sin el correo, la contraseña, la IP ni la consulta de la URL.
- **Pendiente declarado:** las acciones del admin (crear, publicar, borrar) no se registran; no hay alertas automáticas ni retención definida del registro (la fija el hosting); el identificador de cliente es por instancia.
- **Quien añada un evento** debe ampliar el vocabulario y su test; un campo nuevo exige una decisión explícita sobre si es un dato personal.
- **Lecciones:** los tests aprobados (nada de `console` en `lib/auth`, `lib/admin`, `lib/compatibility`; la calculadora no escribe en la consola) obligaron a un único punto de salida silencioso en test en lugar de registrar en cada módulo; y el mapeo decisión → motivo estaba duplicado en el proxy y la capa 2, así que se extrajo a `lib/auth/access-denied.ts`.
- Relacionado: ADR 0010 y 0011 (autorización y login), ADR 0012 (calculadora), ADR 0015 y 0016 (acciones y subidas) y ADR 0019 (CSP).
