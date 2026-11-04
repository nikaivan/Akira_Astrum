# ADR 0023: Escaneo ZAP baseline y checklist OWASP verificable

- **Estado:** Aceptado (2026-11-04)
- **Fecha:** 2026-11-04

## Contexto
`PLAN.md` §8 (Fase 3) y §11 exigen un escaneo OWASP ZAP, el `npm audit` y una «checklist OWASP completada con evidencias», y que no queden alertas altas. Mi encargo añadió: preparar cómo ejecutar ZAP en modo baseline contra la aplicación en local y rellenar `docs/owasp-checklist.md` con evidencias reales por categoría (A01 a A10), marcando como no hecho lo que no lo esté y sin inventar evidencias. El entorno de la IA no puede ejecutar ZAP (hay cliente de Docker pero ningún demonio, y el proxy bloquea las descargas de GitHub y de `ghcr.io`), así que **lo ejecuta el arquitecto** en su máquina (un Mac, con Docker Desktop) y la IA prepara el script, analiza el informe y documenta.

## Decisión
- **ZAP en modo baseline: análisis pasivo.** `scripts/zap-baseline.sh` (`npm run zap`) usa la imagen oficial `ghcr.io/zaproxy/zaproxy:stable` con `zap-baseline.py`: rastrea la aplicación y analiza las respuestas, sin ataques activos (nunca `zap-full-scan` ni `zap-api-scan`; un test lo vigila). Rastreo limitado a 3 minutos.
- **Contra el build de producción en local**, no `next dev` ni un despliegue: la CSP estricta y las cabeceras reales solo existen en producción (ADR 0019).
- **Solo contra el proyecto de Supabase de test, nunca producción:** el script lee del `.env.test.local` únicamente tres variables (la referencia, la URL y la clave pública) y **aborta si la URL no es exactamente `https://<ref>.supabase.co`**, con la misma guarda que los e2e. La aplicación solo recibe las dos variables públicas; nunca se usa la clave de rol de servicio, ni se imprime ningún valor, ni se activa `set -x`. Acepta los formatos habituales de `.env` (con o sin `export`, con espacios alrededor del `=`, con comillas, con comentarios y con saltos de línea de Windows), y si falta algo, dice qué variable (por su nombre). `ZAP_CHECK_ONLY=1 npm run zap` verifica el entorno sin compilar ni escanear.
- **Informes en `zap-reports/`** (HTML y JSON), ignorada por Git; el contenedor se borra (`--rm`), solo se monta esa carpeta y el servidor se apaga siempre (`trap`). En Linux usa `--network host`; en macOS y Windows, `host.docker.internal`.
- **Checklist verificable por tests.** `docs/owasp-checklist.md` tiene una tabla por categoría con medida, estado (✅ Hecho, ⚠️ Parcial, ❌ No hecho), evidencia, qué falta y cómo verificarla. Dos archivos de tests (`tests/unit/docs/owasp-checklist.test.ts` y `owasp-checklist-rows.test.ts`) exigen: las diez categorías con su nombre; un estado válido por fila; **que toda ruta de evidencia exista** y que los tests citados contengan tests; que una fila ✅ cite evidencia y una ❌ no cite ninguna; que todo ⚠️ y ❌ explique qué falta y figure en el resumen final; que ninguna fila quede sin analizar; y que la sección de ZAP, si dice «Pendiente», no lleve cifras, y si dice «Ejecutado», lleve fecha, versión, recuento por nivel y ninguna alerta alta pendiente.

## Resultado del escaneo (2026-11-04, ZAP 2.17.0)
**Ninguna alerta alta en ninguno de los dos escaneos.** Reglas: 0 fallos, 5 avisos y 63 superadas. Alertas del segundo escaneo: 1 media, 1 baja y 5 informativas.
- **Absence of Anti-CSRF Tokens (media, confianza baja): aceptada.** Los formularios usan Server Actions, que solo aceptan `POST` y comparan `Origin` con `Host`; la cookie es `sameSite: lax` (ADR 0011) y la calculadora no guarda nada. Se comprobó a mano contra un build de producción (con `https://evil.example` y con `null`, el servidor aborta la acción) y se escribió un e2e (`tests/e2e/cross-origin.spec.ts`) que reenvía las acciones con un origen ajeno, incluido el acceso con las credenciales del admin, para fijarlo; pasa en verde.
- **Cross-Origin-Resource-Policy (baja, 5 chunks de `_next/static`): corregida** añadiendo `Cross-Origin-Resource-Policy: same-origin` a las cabeceras estáticas. Es un ajuste de las cabeceras del ADR 0019. El segundo escaneo ya no la muestra.
- **Cross-Origin-Embedder-Policy (baja, 5 instancias en las páginas públicas): aceptada.** Solo sirve para aislar el origen (por ejemplo para `SharedArrayBuffer`), que no se usa, y exigiría que todo recurso de terceros declarase su política.
- **Informativas (5):** el formulario de acceso detectado, las páginas `no-store` a propósito (ADR 0014), los chunks públicos con hash cacheables, `/favicon.ico` y `/manifest.webmanifest`, y los atributos de los formularios que se rellenan con lo enviado (React los escapa; hay tests con cargas hostiles).
- El recuento de avisos (5) no cambió tras añadir la cabecera: ZAP cuenta **reglas**, y la de aislamiento de origen sigue avisando por COEP. Lo que cambió es la lista de alertas.

## Alternativas descartadas
- **Escaneo completo o activo (`zap-full-scan`):** lanza ataques; no hace falta contra un blog y exigiría una base de datos desechable.
- **Escaneo autenticado de `/admin`:** necesita sesión y contexto de ZAP; la intranet ya está cubierta por los tests de integración y e2e.
- **Escanear el despliegue en Vercel:** se podría repetir en la Fase 4, pero un escaneo contra un servicio público es otra decisión; el local reproduce las mismas cabeceras.
- **Un checklist libre sin tests:** habría permitido citar rutas inexistentes o esconder pendientes.
- **Activar `Cross-Origin-Embedder-Policy`:** riesgo de romper recursos de terceros a cambio de una protección que no usamos.

## Consecuencias
- **Estado del checklist:** 57 medidas; las pendientes están enumeradas en su resumen: acciones de GitHub fijadas por hash, MFA, despliegue solo desde `main`, alertas automáticas y registro de las acciones del admin (no hechas), y la comprobación en producción del registro, HSTS y HTTPS, el modelo de amenazas (sigue «BORRADOR»), los límites por instancia, COEP aceptada y la caché tras el despliegue (parciales).
- **Límites del escaneo:** pasivo y sin sesión; no es una prueba de intrusión; el rastreo **envía formularios** a `/login` y `/compatibilidad` con datos de relleno (contra el proyecto de test, sin efecto).
- **Repetirlo** al cambiar cabeceras, CSP o rutas públicas, y de nuevo con la versión desplegada si se decide escanearla.
- **El script lo ejecuta una persona con Docker:** el `.env.test.local` no se comparte con la IA; el informe, sin secretos, se pasa como resumen.
- **Lecciones:** un script que lee configuración debe probarse con los formatos reales del usuario y explicar siempre por qué se detiene (mi primera versión salía en silencio con `NOMBRE = valor`); pedir las rutas de cada alerta antes de clasificarla evita aceptar a ciegas; y el recuento de ZAP cuenta reglas, no alertas.
- Relacionado: ADR 0011 (cookies y CSRF), ADR 0014 (páginas sin caché), ADR 0019 (CSP y cabeceras), ADR 0020 (registro de eventos), ADR 0021 (cadena de suministro) y ADR 0022 (PWA).
