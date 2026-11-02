# Akira Astrum: blog de astrología con intranet de administración, desarrollo asistido por IA con TDD y seguridad OWASP

**Trabajo Final de Máster: Plan de proyecto**

- **Autor:** Ivan Maldonado Garcia
- **Versión:** 1.0 (plan inicial)
- **Fecha:** 30 de octubre de 2026
- **Fecha de entrega:** viernes 6 de noviembre de 2026

> Este documento define el alcance, la arquitectura, la metodología y los criterios de seguridad del proyecto. Se utiliza también como contexto para el asistente de IA (Claude Code), que debe leerlo antes de escribir código.
> Reparto de roles: el **humano es arquitecto y tester**; la **IA es la implementadora**. Ningún código se acepta sin tests en verde y revisión del humano.

## 1. Objetivo

Aplicación web con dos zonas:

- **Blog público (solo lectura)**: listado de entradas publicadas, detalle, categorías. Los visitantes **no pueden añadir ni modificar contenido** y no hay registro de usuarios.
- **Intranet de administración**: acceso exclusivo para el **admin**, que crea, edita, publica, despublica y elimina entradas y categorías.

- **Calculadora de compatibilidad (pública, sin cuentas)**: el visitante introduce dos fechas de nacimiento y obtiene la compatibilidad entre sus signos solares, con una explicación. **No se registra ni se guarda ningún dato.** Las reglas son convenciones de la tradición astrológica definidas en `docs/astrologia-reglas.md`, no un cálculo con base científica, y así se indica en la interfaz y en el README.

- **Totalmente responsive e instalable como aplicación web (PWA)**: diseño móvil primero que funciona en móvil, tableta y escritorio (también el panel de administración), y que se puede instalar en la pantalla de inicio con aspecto de aplicación. Alcance PWA mínimo: manifiesto, iconos y una página de aviso sin conexión; sin funcionamiento offline completo.

Estados de una entrada: `borrador ↔ publicado`.

**Fuera de alcance**: registro público, perfiles y emparejamiento entre usuarios (línea de trabajo futura), cartas astrales completas (efemérides, hora y lugar de nacimiento), notificaciones push, sincronización offline, caché de contenido de la intranet, comentarios, otros roles, newsletter, multiidioma, galerías, edición o recorte de imágenes, pagos, APIs de pago.

**Incluido**: el admin sube imágenes desde la intranet (imagen de portada de la entrada e imágenes dentro del contenido) a Supabase Storage.

**Plazo**: entrega el viernes 6 de noviembre. Coste: 0 €.

## 2. Stack (decisión: monolito)

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| BD y auth | Supabase (Postgres + Auth + RLS) |
| Validación | Zod |
| UI | Tailwind + shadcn/ui |
| Contenido | Markdown renderizado y **sanitizado** |
| Imágenes | Supabase Storage (bucket público de lectura, escritura solo admin) |
| PWA | Manifiesto de Next.js (`app/manifest.ts`), iconos y service worker mínimo propio |
| Tests unitarios/integración | Vitest |
| Tests e2e | Playwright |
| Despliegue | Vercel + Supabase (planes gratuitos) |

## 3. Metodología: TDD estricto

Ciclo obligatorio para **cada funcionalidad**:

1. **Rojo**: el humano define el criterio de aceptación y se escribe el test primero. Se ejecuta y **debe fallar**.
2. **Verde**: la IA implementa lo mínimo para pasar el test.
3. **Refactor**: se limpia el código con los tests en verde.
4. **Commit** por ciclo, con mensajes tipo `test: ...` / `feat: ...` / `refactor: ...`.

Reglas:
- La IA no modifica un test para que pase sin aprobación explícita del humano.
- Pirámide: muchos tests unitarios (validaciones, lógica de estados, slugs), algunos de integración (RLS y Storage contra Supabase), pocos e2e (flujos críticos).
- Los tests de permisos y de seguridad son ciudadanos de primera clase, no un añadido final.

## 4. Modelo de acceso

| Actor | Leer publicadas | Leer borradores | Crear / editar / publicar / borrar |
|---|---|---|---|
| Visitante anónimo | Sí | No | No |
| Usuario autenticado sin rol admin (no debería existir) | Sí | No | No |
| Admin | Sí | Sí | Sí |

- **Calculadora**: pública y sin persistencia. No usa la base de datos y no requiere sesión.
- **Storage**: cualquiera puede *ver* las imágenes del bucket público; solo el admin puede *subir, reemplazar o borrar* (políticas sobre `storage.objects`).
- El **registro público está desactivado** en Supabase Auth. La cuenta admin se crea manualmente.
- El rol se guarda en `profiles.role = 'admin'` y se comprueba **en servidor y en RLS** (defensa en profundidad). Nunca se confía en datos enviados por el cliente.

## 5. Seguridad (OWASP Top 10:2025)

Referencia: [OWASP Top 10:2025](https://top10.owasp.org/2025/) y OWASP ASVS como guía de verificación.

| Riesgo OWASP | Medida en el proyecto | Cómo se prueba |
|---|---|---|
| A01 Broken Access Control | Middleware en rutas de intranet, comprobación de rol admin en cada Server Action, **RLS en Postgres** (lectura pública solo de `published`, escritura solo admin) | Integración: anónimo no inserta/edita/borra; anónimo no lee borradores; autenticado no admin no escribe. e2e: `/admin` redirige a login |
| A02 Security Misconfiguration | Cabeceras de seguridad (CSP, X-Frame-Options, etc.) en `next.config`, registro público desactivado, configuración del bucket de Storage (tipos y tamaño permitidos) | Test de cabeceras; test que verifica que el signup falla; escaneo ZAP |
| A03 Software Supply Chain Failures | `npm audit`, Dependabot, lockfile con versiones fijadas, instalación con `npm ci` en CI, revisión manual de cada dependencia nueva (comprobar que el nombre del paquete es el correcto, ya que la IA puede sugerir nombres parecidos a los reales), sin scripts de terceros innecesarios | `npm audit` y `npm ci` en el pipeline; dependencias nuevas anotadas en `docs/ai-log.md` |
| A04 Cryptographic Failures | Contraseñas y sesiones gestionadas por Supabase Auth, solo HTTPS, secretos en variables de entorno | Revisión: ningún secreto en el repo; `service_role` nunca en el cliente |
| A05 Injection (incl. XSS) | Consultas parametrizadas vía cliente Supabase, validación con Zod, **sanitizar el Markdown** al renderizar (p. ej. rehype-sanitize) | Tests con payloads: `<script>`, `onerror=`, `javascript:` en contenido y títulos |
| A06 Insecure Design | Modelado de amenazas breve (STRIDE ligero) antes de codificar | `docs/threat-model.md` |
| A07 Authentication Failures | Límite de intentos de login, sesiones con expiración, contraseña fuerte para el admin (MFA si el plan lo permite) | e2e de login fallido repetido y de sesión expirada |
| A08 Software or Data Integrity Failures | Despliegue solo desde la rama principal con los tests en verde; sin ejecución de código no revisado | Revisión del pipeline de CI/CD |
| A09 Security Logging and Alerting Failures | Registrar eventos de seguridad (login fallido, acciones del admin) y documentar qué eventos generarían una alerta | Test que verifica que se registran los eventos |
| A10 Mishandling of Exceptional Conditions | **Fallar cerrado**: si falla la sesión, la comprobación de rol o la conexión con Supabase, se deniega el acceso; mensajes de error genéricos, sin trazas ni detalles internos; limpieza si una subida o un guardado se queda a medias | Tests que simulan fallos de Supabase, sesión inválida y errores de validación: no se concede acceso, no se filtra información, no quedan archivos huérfanos |

### Subida de imágenes (Supabase Storage)

| Medida | Cómo se prueba |
|---|---|
| Políticas de Storage: solo admin escribe/borra; lectura pública del bucket | Integración: anónimo y no admin no pueden subir ni borrar |
| Lista blanca de tipos: solo JPEG, PNG y WebP (**sin SVG**, que puede llevar scripts) | Test: subir SVG, HTML o `.exe` renombrado a `.png` es rechazado |
| Validar el tipo real por contenido (firma del archivo), no solo por extensión ni por el `Content-Type` del cliente | Test con archivo falso con extensión `.png` |
| Tamaño máximo (p. ej. 2 MB), configurado en el bucket y validado en servidor | Test con archivo superior al límite |
| Nombre de archivo generado (UUID), nunca el original; sin rutas aportadas por el cliente | Test con nombres como `../../x.png` |
| Solo se permiten imágenes del propio dominio de Supabase en el Markdown renderizado (lista blanca en el sanitizador y `img-src` en la CSP) | Test: una imagen externa en el Markdown no se renderiza |
| Subida con la sesión del admin, nunca con `service_role` | Revisión de código |
| Imágenes huérfanas: al borrar un post o cambiar su portada, se elimina el archivo | Test de integración |

### Calculadora de compatibilidad

| Medida | Cómo se prueba |
|---|---|
| Validar las fechas con Zod en servidor (formato, fecha real, rango razonable); rechazar entradas inválidas con mensajes genéricos | Unit: fechas inexistentes (30 de febrero), vacías, futuras o fuera de rango son rechazadas |
| **No almacenar ni registrar fechas de nacimiento**: ni en base de datos, ni en logs, ni en la URL (se envían por formulario, no por parámetros de consulta) | Test: tras usar la calculadora no se escribe nada en BD; el log de eventos no contiene las fechas |
| Límite de peticiones por cliente para evitar abuso | Test de integración del límite |
| Fallo cerrado ante errores inesperados: mensaje genérico, sin trazas (A10) | Test que fuerza un error interno y comprueba la respuesta |
| Renderizado de las explicaciones como texto o Markdown sanitizado | Test con payloads XSS en los textos de reglas |

### PWA y service worker

| Medida | Cómo se prueba |
|---|---|
| El service worker **no cachea** rutas de la intranet, respuestas autenticadas, peticiones a la API ni Server Actions; solo recursos estáticos públicos y la página sin conexión | e2e: tras iniciar sesión y perder la conexión, `/admin` no muestra contenido guardado |
| Service worker servido desde el mismo origen, con su alcance limitado y sin caché larga en el propio archivo; CSP con `worker-src 'self'` | Test de cabeceras |
| El manifiesto no contiene datos sensibles; `start_url` pública | Test que valida el manifiesto (campos obligatorios, iconos accesibles) |
| Versionado de caché: una versión nueva sustituye a la anterior, para no servir contenido obsoleto ni código con fallos ya corregidos | Comprobación manual documentada tras un despliegue |
| Solo HTTPS | Revisión del despliegue |

Herramientas gratuitas: `eslint-plugin-security`, `npm audit`, **OWASP ZAP (baseline scan)** contra el entorno local o el despliegue.

## 6. Modelo de datos mínimo

- `profiles` (id → auth.users, nombre, rol: `admin`)
- `posts` (id, título, slug único, contenido_md, cover_image_path (nullable), estado: `draft` | `published`, author_id, created_at, updated_at, published_at)
- `categories` (id, nombre, slug)
- `post_categories` (post_id, category_id)

Lógica pura (100 % testeada con Vitest): generación y unicidad de slug, transición de estado y `published_at`, validaciones Zod.

**Dominio astrológico (sin base de datos, datos estáticos en código):**
- Tabla de signos con sus rangos de fechas convencionales, elemento y modalidad. El humano define y valida la tabla; se documenta que las fechas de cúspide varían según el año y la hora de nacimiento, y que aquí se usa una convención fija.
- Reglas de compatibilidad entre signos y textos explicativos, especificadas en `docs/astrologia-reglas.md` **antes** de escribir los tests.
- Tests unitarios previstos: signo correcto en las fechas de cambio de signo y en el 29 de febrero; todas las parejas (12 × 12) producen un resultado; la compatibilidad es simétrica; los niveles devueltos pertenecen al conjunto definido; fechas inválidas rechazadas.

## 7. Estructura del proyecto

```
app/
  (public)/        blog: /, /posts/[slug], /categorias/[slug], /compatibilidad
  (admin)/         dashboard, posts/new, posts/[id]/edit, categorias
  login/
  manifest.ts      manifiesto de la PWA
lib/               supabase, auth, validaciones (zod), slugs, estados, storage (validación y subida de imágenes)
  astrology/       signos, rangos de fechas y reglas de compatibilidad (lógica pura)
supabase/          migraciones y políticas RLS
public/            iconos de la PWA, service worker (sw.js), página sin conexión
tests/
  unit/
  integration/     RLS, Storage y permisos
  e2e/             Playwright
docs/
  adr/             decisiones de arquitectura
  threat-model.md
  design.md        guía de diseño de la interfaz
  astrologia-reglas.md  especificación de signos y reglas de compatibilidad
  ai-log.md        registro de uso de IA
  owasp-checklist.md
```

## 8. Fases (viernes 6 de noviembre = entrega)

**Fase 0: Preparación (día 1)**
- Crear repo, configurar Next.js, Vitest, Playwright, ESLint, Supabase.
- Configurar Playwright desde el principio con proyectos de escritorio y de móvil emulado, para que todos los e2e comprueben también la versión móvil.
- Escribir `docs/threat-model.md` y los primeros ADRs.
- Criterio de hecho: `npm test` ejecuta un test trivial en verde; CI básica corre los tests.

**Fase 1: Núcleo con TDD (días 2-3)**
- Lógica de slugs y estados (unit tests primero).
- Dominio astrológico: tabla de signos y reglas de compatibilidad según `docs/astrologia-reglas.md` (unit tests primero).
- Esquema, migraciones y políticas RLS (tests de integración primero).
- Login del admin y middleware de protección.
- Criterio de hecho: tests de permisos en verde.

**Fase 2: Funcionalidad (días 4-5)**
- CRUD de posts y categorías en el panel admin (Server Actions + Zod).
- Subida de imágenes a Supabase Storage (tests de validación y de políticas primero), portada de la entrada e inserción en el Markdown.
- Render de Markdown sanitizado, blog público, páginas de categoría.
- Página pública de la calculadora de compatibilidad con su e2e (introducir dos fechas → resultado) y tests de validación y no persistencia.
- Configurar el host de Supabase en las imágenes de Next.js (`next/image`) y el límite de tamaño de las Server Actions.
- Criterio de hecho: flujo completo admin crea borrador con imagen → publica → visible en el blog (e2e en verde).

**Fase 3: Endurecimiento (día 6)**
- Cabeceras de seguridad, límite de intentos de login, logging, tests de fallo cerrado (A10).
- PWA: manifiesto, iconos, service worker mínimo y página sin conexión; comprobar la instalación en móvil y en escritorio.
- Escaneo OWASP ZAP, `npm audit`, rellenar `owasp-checklist.md`.

**Fase 4: Documentación y despliegue (días 7-8)**
- README (cómo ejecutar en local), memoria, `ai-log.md` completo.
- Despliegue en Vercel + Supabase, reactivar Supabase si estuviera pausado, comprobar que el registro sigue desactivado en producción.
- Vídeo corto de demo como respaldo.
- Margen para imprevistos.

## 9. Reglas de trabajo con la IA

- Trabajar por tareas pequeñas, un ciclo rojo-verde-refactor por tarea.
- Antes de implementar, la IA propone el test y el humano lo aprueba.
- Cada decisión de diseño relevante se registra como ADR en `docs/adr/`.
- Cada sesión relevante se anota en `docs/ai-log.md`: qué se pidió, qué generó la IA, qué corrigió el humano y por qué.
- Nunca poner claves ni secretos en el repositorio. Usar `.env.local` (en `.gitignore`).
- La clave `service_role` de Supabase solo se usa en servidor y solo si es imprescindible.
- Las desviaciones respecto a este plan no se reescriben aquí: se registran en `docs/ai-log.md` o en un ADR, con su justificación.

## 10. Riesgos y plan B

| Riesgo | Plan B |
|---|---|
| Poca experiencia previa con Next.js | Mantener el alcance mínimo; apoyarse en el material del máster y en los tests |
| Supabase local requiere Docker y consume RAM (16 GB en el equipo de desarrollo) | Usar un proyecto Supabase en la nube solo para desarrollo |
| El plan gratuito pausa el proyecto por inactividad (la BD y las imágenes dejan de estar disponibles) | Reactivarlo antes de la corrección; incluir vídeo de demo |
| Límite de almacenamiento del plan gratuito | Imágenes pequeñas (máx. 2 MB) y pocas entradas de demo |
| La subida de imágenes consume más tiempo del previsto | Plan B: solo imagen de portada; las imágenes dentro del Markdown, para después |
| Las reglas de compatibilidad llevan más tiempo del previsto | Simplificar a reglas por elemento (fuego, tierra, aire, agua) con textos genéricos por combinación |
| Percepción de que las reglas astrológicas tienen base científica | Aviso visible en la calculadora y en el README: son convenciones de la tradición astrológica, con fines informativos y de entretenimiento |
| El service worker introduce errores de caché o riesgos de seguridad | Plan B: dejar solo manifiesto e iconos (instalable, sin service worker) |
| Comportamiento distinto de la instalación entre navegadores y sistemas (p. ej. iOS) | Probar en al menos un móvil y un navegador de escritorio, y documentar en el README cómo instalarla en cada uno |
| Falta de tiempo | Recortar categorías y pulido de UI; **no recortar tests ni seguridad** |

## 11. Definición de "terminado"

- Todos los tests (unit, integración, e2e) en verde.
- Checklist OWASP completada con evidencias.
- Escaneo ZAP baseline sin alertas altas pendientes.
- Despliegue accesible y README reproducible.
- Responsive verificado en móvil y escritorio (tests e2e), y aplicación instalable comprobada.
- Memoria con ADRs, modelo de amenazas y registro de uso de IA.

Si algún objetivo no se cumple al entregar, se documenta explícitamente en la memoria.
