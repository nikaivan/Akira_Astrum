# ADR 0019: CSP con nonce por petición, excepción de estilos en atributos y cabeceras estáticas

- **Estado:** Aceptado (2026-11-04)
- **Fecha:** 2026-11-04

## Contexto
`PLAN.md` §5 (A02) pide cabeceras de seguridad y una CSP, con `img-src` limitado a `'self'` y al Storage del proyecto. Hasta ahora solo había `noindex` y `no-store`. Next.js 16 inyecta scripts en línea (hidratación y datos RSC), de modo que una CSP sin `unsafe-inline` en `script-src` exige un **nonce por petición** (la alternativa, SRI, es experimental). Pedí la opción más estricta que funcionara y que se explicara cualquier excepción.

## Decisión
- **Nonce por petición generado en `proxy.ts`.** `generateNonce()` da 128 bits en base64; el proxy reenvía la CSP y `x-nonce` a la renderización (Next marca con él sus scripts y estilos) y pone la CSP en la respuesta. Un `x-nonce` o una CSP enviados por el cliente se ignoran. La rama `/admin` conserva `authorizeAdmin` y `adminResponse` sin cambios; sus redirecciones, el 403 y el 503 llevan también CSP. El matcher cubre todas las páginas salvo `_next/static`, `_next/image` y `favicon.ico`, y no genera nonce para las precargas de `next/link`.
- **Política (`lib/security/csp.ts`, función pura):** `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'` (más `'unsafe-eval'` solo en desarrollo, donde React lo necesita); `style-src 'self' 'nonce-…'` (en desarrollo, `'unsafe-inline'` por el HMR); `img-src 'self' blob:` más el origen limpio del Storage (`httpsOrigin`, el mismo que usa `next/image`; sin variable válida, ninguno; sin `data:`); `font-src`, `connect-src`, `worker-src` y `manifest-src` en `'self'` (los dos últimos ya preparan la PWA); `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; `upgrade-insecure-requests` solo en producción. Un nonce con formato no válido lanza un error en vez de generar una política más débil, y un origen de Storage hostil no puede inyectar directivas.
- **Excepción acotada: `style-src-attr 'unsafe-inline'`.** `next/image` escribe `style="color:transparent"` en cada imagen y `style-src` con nonce lo bloquea (se vio en el build real, no en desarrollo). Esta directiva solo afecta a atributos `style`, no permite ejecutar código ni hojas de estilo en línea, y no hay `script-src-attr`. Un test fija que es la única excepción.
- **Todas las páginas son dinámicas.** El nonce solo se puede aplicar al renderizar cada petición; con `/compatibilidad`, el 404 y dos páginas de `/admin` prerenderizadas, sus scripts salían sin nonce y el navegador los habría bloqueado (la calculadora habría dejado de funcionar). Por eso `app/layout.tsx` declara `dynamic = "force-dynamic"`, y un test de arquitectura lo exige.
- **Cabeceras estáticas (`lib/security/headers.ts`, `next.config.ts` en `/(.*)`):** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (respaldo de `frame-ancestors`), `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` con cámara, micrófono, geolocalización, pagos, USB y otras funciones denegadas, y **HSTS solo en producción** (`max-age` de dos años, `includeSubDomains`, sin `preload`). `poweredByHeader: false` quita `X-Powered-By`. Las reglas de `noindex` y `no-store` ya existentes no cambian.

## Alternativas descartadas
- **`'unsafe-inline'` en `script-src`:** anularía la protección contra XSS que esta política existe para dar.
- **SRI experimental** (`experimental.sri`): permitiría páginas estáticas, pero es experimental y no cubre los scripts en línea de la hidratación.
- **CSP solo en `next.config.ts`:** no puede llevar un nonce distinto en cada petición.

## Consecuencias
- **Coste:** sin páginas estáticas, ISR ni CDN. Ya eran dinámicas casi todas (`force-dynamic` y `no-store`, ADR 0014) y el despliegue no usa CDN, así que el coste es pequeño.
- **Pruebas:** unitarios de la política, el nonce, las cabeceras, el proxy (rutas públicas y las cuatro decisiones de `/admin`, con fallo cerrado) y el matcher; e2e de cabeceras reales y de ausencia de violaciones de CSP en las pantallas públicas y en la intranet, incluida la vista previa `blob:`.
- **Límite de la verificación:** el e2e oficial usa `next dev`, que exige `'unsafe-eval'` y `'unsafe-inline'` en estilos. La política estricta de producción se comprobó con `next build` y `next start` y un navegador real en escritorio y móvil (sin violaciones), pero no está automatizada en la CI. En la Fase 4, el `next build` en la CI y el escaneo ZAP (sub-bloque E) cubrirán el build real.
- **Sin `report-uri`:** las violaciones solo se ven en la consola del navegador; el registro de eventos de seguridad llega con A09 (sub-bloque B).
- **Quien añada recursos nuevos** (un script, una fuente o un host de imágenes) debe tocar `buildCsp` y su test; una imagen externa en el Markdown sigue sin renderizarse (ADR 0013).
- **PWA (sub-bloque D):** `worker-src` y `manifest-src` ya están; el service worker no debe cachear la CSP ni las rutas privadas.
- **Lecciones:** lo que solo ocurre en producción (páginas estáticas sin nonce, estilos de `next/image`) no lo ve un e2e en `next dev`; hay que probar el build real. Y un test mío con la cadena «service_role» rompió el test de arquitectura aprobado: se corrigió el mío.
- Relacionado: ADR 0013 (Markdown sanitizado), ADR 0014 (lectura pública sin caché), ADR 0016 y 0017 (imágenes y `blob:`) y ADR 0018 (`theme_color`).
