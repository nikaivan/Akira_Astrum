# Modelo de amenazas (STRIDE ligero)

> **BORRADOR para revisión del arquitecto.** Cumple la fila A06 de `PLAN.md` §5. No repite las medidas del plan: cada amenaza apunta a la sección donde se define y se prueba.

## 1. Activos

| Activo | Por qué importa |
|---|---|
| Cuenta admin y su sesión | Única vía de escritura de contenido |
| Entradas y categorías (`posts`, `categories`) | Integridad del contenido publicado; los borradores son confidenciales |
| Imágenes (Supabase Storage) | Pueden usarse para alojar contenido malicioso |
| Fechas de nacimiento de la calculadora | Datos personales: no se almacenan ni se registran (`PLAN.md` §5, calculadora) |
| Secretos (`SUPABASE_SERVICE_ROLE_KEY`) | Saltan RLS: nunca deben llegar al cliente ni al repositorio |

## 2. Actores y límites de confianza

- **Visitante anónimo**: no confiable. Solo lee contenido publicado y usa la calculadora.
- **Admin**: confiable solo tras autenticarse; el rol se comprueba en servidor y en RLS.
- **Navegador**: no confiable. Todo dato enviado se valida en servidor con Zod.
- **Servidor Next.js**: confiable. Usa solo la clave anónima y la sesión del usuario.
- **Supabase (Postgres, Auth, Storage)**: última barrera de acceso mediante RLS y políticas de Storage.

Límites: navegador → servidor Next.js → Supabase. Cada salto repite la comprobación de acceso (`docs/adr/0003`).

## 3. Amenazas (STRIDE)

| Categoría | Amenaza | Mitigación | OWASP / dónde se define |
|---|---|---|---|
| **S**poofing | Suplantar al admin por fuerza bruta o robo de sesión | Límite de intentos, sesiones con expiración, contraseña fuerte | A07, `PLAN.md` §5 |
| **T**ampering | Anónimo o usuario no admin crea, edita o borra entradas | RLS, middleware y comprobación de rol en cada Server Action | A01, `PLAN.md` §4 y §5 |
| **T**ampering | XSS almacenado vía Markdown o títulos | Sanitizado del Markdown y validación con Zod | A05, `PLAN.md` §5 |
| **T**ampering | Subida de archivo malicioso (SVG, ejecutable renombrado) | Lista blanca JPEG/PNG/WebP, firma del archivo, tamaño máximo, nombre UUID | A05, `PLAN.md` §5 (Storage) |
| **R**epudiation | El admin niega una acción o no se detecta un abuso | Registro de eventos de seguridad, sin datos personales | A09, `PLAN.md` §5 |
| **I**nformation disclosure | Lectura de borradores o de errores internos | RLS por estado; mensajes genéricos que fallan cerrado | A01, A10, `PLAN.md` §5 |
| **I**nformation disclosure | Fuga de fechas de nacimiento de la calculadora | Sin persistencia, sin logs y sin parámetros en la URL | `PLAN.md` §5 (calculadora) |
| **I**nformation disclosure | Fuga de secretos al cliente o al repositorio | Variables de entorno, `.env*` ignorado, `service_role` solo en servidor si es imprescindible | A04, `PLAN.md` §9 |
| **I**nformation disclosure | El service worker guarda contenido autenticado | Sin caché de la intranet, de la API ni de Server Actions | `PLAN.md` §5 (PWA) |
| **D**enial of service | Abuso de la calculadora o del login | Límite de peticiones por cliente | A07, `PLAN.md` §5 (calculadora) |
| **D**enial of service | Pausa del proyecto Supabase por inactividad | Reactivarlo antes de la entrega y vídeo de respaldo | `PLAN.md` §10 |
| **E**levation of privilege | Un usuario autenticado sin rol admin escribe | RLS con `profiles.role = 'admin'`; registro público desactivado | A01, A02, `PLAN.md` §4 |
| **E**levation of privilege | Dependencia comprometida o con nombre falso | Versiones fijas, `npm ci`, `npm audit`, revisión manual (`docs/adr/0005`) | A03, `PLAN.md` §5 |

## 4. Riesgos aceptados y supuestos

- Un único admin: no hay separación de funciones.
- No se cubren ataques de infraestructura de Vercel o Supabase.
- Las vulnerabilidades moderadas de `npm audit` en herramientas de desarrollo (cadena de ESLint) se aceptan mientras no haya ninguna alta o crítica.

## 5. Revisión

Este documento se revisa al final de cada fase y se contrasta con `docs/owasp-checklist.md` en la Fase 3.
