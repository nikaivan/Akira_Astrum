# ADR 0011: Login y sesión: mensaje único, limitador en memoria, cookies acotadas y e2e sobre el proyecto de test

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
El login del admin es el punto de mayor exposición (A07). Hay que evitar la enumeración de usuarios, frenar la fuerza bruta sin servicios de pago, no dejar sesiones de no admin, evitar redirecciones abiertas y que la cookie de sesión no sea legible por JavaScript. `@supabase/ssr` 0.12.7 trae por defecto cookies sin `httpOnly` y de 400 días, y **al escribir la sesión fuerza `maxAge` a 400 días ignorando `cookieOptions`**.

## Decisión
- **Un único mensaje de error** (`Correo o contraseña incorrectos.`) para entrada inválida, credenciales erróneas, correo sin confirmar, usuario bloqueado, errores de red o desconocidos y usuario no admin. El único mensaje distinto es el del límite (`Demasiados intentos. Inténtalo de nuevo más tarde.`), que no depende del correo. El mensaje nunca incluye texto de Supabase.
- **Usuario no admin con credenciales correctas**: se cierra esa sesión y se devuelve el mismo error genérico; la aplicación no deja sesiones de no admin.
- **Limitador en memoria por IP** (`lib/auth/rate-limit.ts`): 5 fallos cada 15 minutos; un éxito reinicia el contador; las entradas inválidas y los no admin también cuentan; tope de claves con expulsión de las más antiguas; reloj inyectable para los tests. La IP sale del primer valor de `x-forwarded-for` (fiable detrás de Vercel, falsificable en otros despliegues); si no es válido, todas comparten la clave `unknown`.
- **Cookies de sesión**: `httpOnly`, `sameSite: lax`, `path: /`, 8 horas y `secure` en producción. Como `@supabase/ssr` pisa `maxAge`, las opciones se **reimponen justo antes de escribir cada cookie** (`enforceSessionCookieOptions`) en `lib/supabase/server.ts` y en `proxy.ts`; el borrado (`maxAge: 0`) se respeta. `lax` basta porque los Server Actions de Next comprueban `Origin` contra `Host`.
- **Destino tras el login (`next`)**: solo `/admin` o `/admin/...`, con su query y sin hash; todo lo demás va a `/admin`. Se rechazan barras invertidas, caracteres de control, `..` (también codificado), segmentos vacíos y más de 2000 caracteres. Se valida en la página y otra vez en el Server Action.
- **Cierre de sesión** con `signOut()` global: revoca la sesión en el servidor, no solo borra la cookie; una cookie antigua restaurada ya no sirve.
- **Sin registro**: no existe ninguna ruta de alta y el código no llama a `signUp`, OAuth, OTP ni restablecimiento de contraseña (un test de arquitectura lo vigila).
- **`noindex` y `no-store`** en `/login` y `/admin/*`, desde una única fuente (`lib/auth/private-headers.ts`) usada por `next.config.ts`, el proxy y los Route Handlers.
- **e2e contra el proyecto de test**: Playwright arranca su propio servidor en el puerto 3100 con `reuseExistingServer: false` y con las variables `SUPABASE_TEST_*`, y aborta si el entorno no es el de test. Así nunca se reutiliza un servidor levantado con `.env.local` (producción). `service_role` se usa también en los e2e, solo para crear y borrar los usuarios temporales (`tests/e2e/support/service-role.ts`); un test de arquitectura impide que aparezca en `app/`, `lib/` o `proxy.ts`. Cada test usa una IP simulada propia, y cada proyecto (escritorio y móvil) la suya, porque corren en paralelo contra el mismo servidor.
- **Accesibilidad**: `@axe-core/playwright` 4.14.0 y `axe-core` 4.14.0 (MPL-2.0, solo de desarrollo, versión exacta) sobre `/login`, también con el error visible.

## Consecuencias
- **Límites del limitador**: con varias instancias serverless cada una cuenta aparte y un arranque en frío lo reinicia; quien tenga muchas IPs lo esquiva, y quien comparta IP con un atacante queda bloqueado. Frena la fuerza bruta casual, no es una garantía. Se apoya en los límites propios de Supabase Auth y en una contraseña fuerte. Bloquear por correo habría permitido bloquear al admin a distancia. **Mejora prevista (Fase 3): MFA con TOTP, gratis en Supabase.**
- **Cookie de 8 horas**: solo acota a navegadores honestos. Una cookie robada vale hasta que se revoque la sesión; la caducidad real en servidor es una opción de pago de Supabase.
- El formulario usa `noValidate`: la validación la hace solo el servidor (Zod), para que el mensaje sea siempre el mismo.
- Los e2e dependen de comportamientos de Supabase y de Next (por ejemplo, el `role="alert"` vacío del anunciador de rutas obliga a acotar los localizadores al formulario).
- Los tests de e2e con login solo los ejecuta el humano, como los de integración. La parte que no necesita Supabase se ejecuta también en el entorno de la IA.
- Cobertura pendiente: que el contenido de la intranet no entra en el service worker de la PWA se cubre hoy con las cabeceras `no-store` y `noindex`; su test e2e (sin conexión tras iniciar sesión, `PLAN.md` §5) llega con la PWA, en la Fase 3.
- Despliegue (Fase 4): mantener desactivados los registros y crear el perfil admin con SQL.
- Relacionado: ADR 0003, ADR 0008, ADR 0009 y ADR 0010.
