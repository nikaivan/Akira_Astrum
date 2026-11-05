# Akira Astrum

Blog de astrología con una **intranet de administración** y una **calculadora pública de compatibilidad entre signos solares**, instalable como aplicación web (PWA). Proyecto del Trabajo Final de Máster, desarrollado con TDD estricto, con una IA como implementadora y una persona como arquitecta y tester.

- **Repositorio:** https://github.com/nikaivan/Akira_Astrum
- **Aplicación desplegada:** https://akira-astrum.vercel.app/
- **Diapositivas de la defensa:** https://nikaivan.github.io/Akira_Astrum/
- **Vídeo de demostración:** https://drive.google.com/drive/folders/1WlQacdc7Ob_-NUm5bvnHCbCRYktqayPr?usp=sharing
- **Credenciales de prueba:** no se publican aquí. Se facilitan en el formulario de entrega.

## Índice

1. [Funcionalidades](#funcionalidades)
2. [Stack](#stack)
3. [Requisitos](#requisitos)
4. [Instalación y ejecución en local](#instalación-y-ejecución-en-local)
5. [Tests](#tests)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Seguridad (OWASP Top 10:2025)](#seguridad-owasp-top-102025)
8. [Instalar la PWA](#instalar-la-pwa)
9. [Aviso de uso de la calculadora](#aviso-de-uso-de-la-calculadora)
10. [Limitaciones conocidas](#limitaciones-conocidas)
11. [Documentación](#documentación)
12. [Autoría](#autoría)

## Funcionalidades

| Área | Rutas | Qué hace |
|---|---|---|
| **Blog público** | `/`, `/blog`, `/blog/[slug]`, `/categorias/[slug]` | Entradas publicadas con portada y texto alternativo, categorías, extracto y tiempo de lectura. El contenido es Markdown sanitizado. |
| **Intranet** | `/login`, `/admin`, `/admin/posts/new`, `/admin/posts/[id]/edit`, `/admin/categorias` | Acceso solo para el rol `admin`. Crear, editar, publicar y borrar entradas y categorías; subir la portada; insertar imágenes en el contenido; vista previa del Markdown. |
| **Calculadora** | `/compatibilidad` | Dos fechas de nacimiento → compatibilidad entre signos solares con una explicación. **No se guarda ningún dato.** Reglas en [`docs/astrologia-reglas.md`](docs/astrologia-reglas.md). |
| **PWA** | `/manifest.webmanifest`, `/offline`, `public/sw.js` | Instalable. Sin conexión solo muestra una página propia; no guarda contenido del blog ni de la intranet. |

## Stack

- **Next.js 16** (App Router) con **TypeScript**, React 19.
- **Supabase**: Postgres con RLS, Auth y Storage (`@supabase/ssr`, `@supabase/supabase-js`).
- **Zod** para validar toda entrada.
- **Tailwind CSS v4** y componentes de **shadcn/ui** (sobre `@base-ui/react`).
- `react-markdown` con `rehype-sanitize` (lista blanca explícita).
- **Vitest** (unitarios e integración) y **Playwright** (e2e en escritorio y móvil Pixel 7), con `@axe-core/playwright` para accesibilidad.
- **GitHub Actions** (CI) y **Dependabot**.

Las versiones exactas están fijadas en `package.json` (ver [ADR 0005](docs/adr/0005-versiones-fijadas-y-verificacion-de-dependencias.md) y [ADR 0021](docs/adr/0021-cadena-de-suministro-versiones-exactas-lista-de-dependencias-revisadas-y-auditoria-en-la-ci.md)).

## Requisitos

- **Node.js 22** y npm (la versión que usa la CI; el proyecto no declara un campo `engines`).
- Un **proyecto de Supabase** para la aplicación.
- Para los tests de integración y e2e, un **segundo proyecto de Supabase, solo de test**. Nunca se ejecutan contra el de producción.
- **Docker** (opcional): solo para el escaneo `npm run zap`.
- Para los e2e, el navegador de Playwright (`npx playwright install chromium`) o la variable `PLAYWRIGHT_CHROMIUM_PATH` apuntando a un Chromium instalado.

## Instalación y ejecución en local

1. Instala las dependencias:

   ```bash
   npm ci
   ```

2. Crea tu archivo de entorno a partir de la plantilla y rellénalo con los datos de tu proyecto de Supabase (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

   Variables de `.env.example` (sin valores aquí):

   | Variable | Uso |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto. También la usa la CSP para permitir las imágenes de Storage. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (pública, limitada por RLS). |
   | `SUPABASE_SERVICE_ROLE_KEY` | Declarada en la plantilla, pero **el código de la aplicación no la usa** (ver [ADR 0009](docs/adr/0009-pruebas-de-integracion-proyecto-de-test-y-service-role-acotado.md)). |

   `.env.local` y `.env.test.local` están ignorados por Git. No los subas.

3. Prepara la base de datos: en el editor SQL de Supabase, ejecuta por orden de nombre las migraciones de `supabase/migrations/`:

   1. `20261102230000_schema.sql`
   2. `20261102230100_access_control.sql`
   3. `20261102230200_storage.sql`
   4. `20261104000000_cover_alt.sql`

   Después, en *Authentication → Sign In / Providers*, **desactiva el registro de nuevos usuarios**.

4. Crea el primer administrador a mano. Nadie puede escribir en `profiles` por la API, así que se hace desde el panel de Supabase:

   1. En *Authentication → Users* → *Add user*, crea el usuario con su correo y contraseña y marca **Auto Confirm User**.
   2. En el editor SQL, crea su perfil con el rol `admin` (cambia el correo y el nombre visible, 1 a 80 caracteres):

      ```sql
      insert into public.profiles (id, display_name, role)
      select id, 'Tu nombre', 'admin'
      from auth.users
      where email = 'tu-correo@ejemplo.com';
      ```

   3. Comprueba que se ha creado una fila: `select id, display_name, role from public.profiles;`

   Sin esa fila el acceso a `/admin` se rechaza (la aplicación falla cerrada y muestra el mismo mensaje genérico en el login). El SQL está contrastado con las columnas de `supabase/migrations/20261102230000_schema.sql`, pero no se ha ejecutado desde este entorno.

5. Arranca en desarrollo:

   ```bash
   npm run dev
   ```

   o en modo producción:

   ```bash
   npm run build
   npm start
   ```

   La aplicación queda en http://localhost:3000.

## Tests

El desarrollo sigue TDD estricto ([ADR 0002](docs/adr/0002-tdd-estricto-roles-humano-ia.md)). Hay tres niveles:

| Nivel | Comando | Notas |
|---|---|---|
| **Unitarios** | `npm test` | No necesitan red ni Supabase. La CI ejecuta estos, `npm run lint` y `npm audit`; no ejecuta integración ni e2e. `npm run test:watch` los deja en modo vigilancia. |
| **Integración** | `npm run test:integration` | Comprueban esquema, RLS y Storage contra la API real del proyecto de Supabase **de test**. Detalle en [`tests/integration/README.md`](tests/integration/README.md). |
| **e2e** | `npm run test:e2e` | Playwright en escritorio y Pixel 7. Arranca su propio servidor (`npm run dev`) en el puerto 3100 con el proyecto de test. |

Además: `npm run lint` (ESLint) y `npm run zap` (escaneo ZAP baseline, ver [seguridad](#seguridad-owasp-top-102025)).

**Entorno de test.** Los tests de integración y e2e leen `.env.test.local` (ignorado por Git) con estas variables:

`SUPABASE_TEST_PROJECT_REF`, `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY` y `SUPABASE_TEST_SERVICE_ROLE_KEY`.

Antes de hacer ninguna petición comprueban que `SUPABASE_TEST_URL` es exactamente `https://<SUPABASE_TEST_PROJECT_REF>.supabase.co` y abortan si no lo es. Cómo preparar ese proyecto (migraciones y un archivo SQL auxiliar solo para test) está en `tests/integration/README.md`.

## Estructura del proyecto

```text
app/                  Rutas (App Router): blog, categorías, compatibilidad, login, admin, offline, manifest
components/           Componentes de interfaz; components/admin/ para el panel, components/ui/ (shadcn y estilos propios)
lib/
  admin/              Server Actions y consultas del panel (entradas, categorías)
  astrology/          Dominio astrológico: signos, fecha de nacimiento, reglas de compatibilidad
  auth/               Login, sesión, autorización por capas (requireAdmin), límite de intentos
  blog/               Consultas públicas, portadas, fechas, extractos, metadatos
  compatibility/      Server Action de la calculadora, esquema Zod y límite de uso
  markdown/           Lista blanca de la sanitización
  posts/              Slugs, estados y gestión de imágenes del contenido
  pwa/                Registro del service worker
  security/           CSP, cabeceras, registro de eventos de seguridad
  storage/            Validación y subida de imágenes
  supabase/           Clientes de Supabase y lectura del entorno
proxy.ts              Proxy de Next 16: CSP con nonce y control de acceso a /admin
public/               Service worker (sw.js), hoja de la página sin conexión e iconos
scripts/              generate-icons.mjs (npm run icons) y zap-baseline.sh (npm run zap)
supabase/migrations/  Esquema, políticas RLS, Storage y cover_alt
tests/                unit/, integration/ y e2e/
docs/                 Diseño, reglas astrológicas, ADR, modelo de amenazas, checklist OWASP, registro de IA
.github/              Flujo de CI (workflows/ci.yml) y configuración de Dependabot
```

En la raíz también están `next.config.ts` (cabeceras estáticas), `playwright.config.ts`, `vitest.config.mts` y `vitest.integration.config.mts` (unitarios e integración), `components.json` (shadcn) y `PLAN.md` (plan del proyecto).

## Seguridad (OWASP Top 10:2025)

El detalle, medida por medida y con la evidencia que la demuestra, está en [`docs/owasp-checklist.md`](docs/owasp-checklist.md). Un test comprueba que las rutas que cita existen. Resumen:

- **Control de acceso (A01):** RLS en la base de datos, comprobación del rol `admin` en el servidor en cada capa (proxy, páginas y Server Actions) y rechazo de un `Origin` ajeno en las Server Actions. Ver [ADR 0003](docs/adr/0003-seguridad-en-profundidad-rls-y-servidor.md) y [ADR 0010](docs/adr/0010-autorizacion-en-capas-proxy-requireadmin-y-rls.md).
- **Configuración (A02):** CSP con nonce por petición y cabeceras de seguridad ([ADR 0019](docs/adr/0019-csp-con-nonce-por-peticion-excepcion-de-estilos-en-atributos-y-cabeceras-estaticas.md)), registro público desactivado, bucket de imágenes con tipos y tamaño limitados.
- **Cadena de suministro (A03):** versiones exactas, lista de dependencias revisadas, comprobación de integridad del lockfile, `npm audit` en la CI y Dependabot.
- **Autenticación y fallos (A07, A09, A10):** mensaje de error único en el login, límites de intentos, registro de eventos de seguridad sin datos personales y comportamiento de fallo cerrado ([ADR 0011](docs/adr/0011-login-y-sesion-mensaje-unico-limitador-en-memoria-y-cookies.md), [ADR 0020](docs/adr/0020-registro-de-eventos-de-seguridad-sin-datos-personales-limites-en-serverless-y-fallo-cerrado.md)).
- **Contenido:** Markdown sanitizado con lista blanca ([ADR 0013](docs/adr/0013-markdown-publico-sanitizado-react-markdown-y-lista-blanca-explicita.md)) y subida de imágenes validada por contenido ([ADR 0016](docs/adr/0016-subida-de-la-portada-validacion-por-contenido-nombre-generado-y-compensacion.md)).
- **Escaneo dinámico:** OWASP ZAP baseline (pasivo) con `npm run zap` contra una build de producción local y el proyecto de test; resultado y tratamiento de cada alerta en el checklist y en el [ADR 0023](docs/adr/0023-escaneo-zap-baseline-y-checklist-owasp-verificable.md).
- **Modelo de amenazas:** [`docs/threat-model.md`](docs/threat-model.md).

## Instalar la PWA

Abre la aplicación desplegada en el navegador y sigue los pasos de tu plataforma:

| Plataforma | Pasos |
|---|---|
| **Android (Chrome)** | Menú ⋮ → **Instalar aplicación** (o «Añadir a pantalla de inicio»). |
| **iPhone y iPad (Safari)** | Botón **Compartir** → **Añadir a pantalla de inicio**. |
| **Escritorio (Chrome o Edge)** | Icono de instalar en la barra de direcciones, o menú → **Instalar Akira Astrum**. |

> **Estado de la comprobación:** la instalación, el manifiesto y la página sin conexión se han verificado en Chromium de escritorio, con emulación móvil en los e2e y, por el autor, en la aplicación desplegada (2026-11-05).

Sin conexión, la aplicación solo muestra una página propia que avisa de que no hay red. Nunca guarda contenido del blog ni de la intranet ([ADR 0022](docs/adr/0022-pwa-minima-manifiesto-service-worker-que-solo-sirve-la-pagina-sin-conexion-y-nunca-guarda-contenido.md)).

## Aviso de uso de la calculadora

> Esta herramienta se basa en convenciones de la tradición astrológica. No tiene base científica y se ofrece con fines informativos y de entretenimiento. No se guarda ningún dato personal.

## Limitaciones conocidas

Están declaradas con más detalle en [`docs/owasp-checklist.md`](docs/owasp-checklist.md) (filas «Parcial» y «No hecho») y en la tabla de desviaciones de [`docs/ai-log.md`](docs/ai-log.md).

- **Sin autenticación multifactor (MFA).**
- **Sin alertas automáticas** ante eventos de seguridad: solo se registran.
- **Sin registro de las acciones del admin** (crear, publicar, borrar).
- **Límites de uso en memoria:** los limitadores del login, la calculadora y las subidas son por instancia del servidor; en un entorno serverless no se comparten entre instancias ([ADR 0020](docs/adr/0020-registro-de-eventos-de-seguridad-sin-datos-personales-limites-en-serverless-y-fallo-cerrado.md)).
- **Acciones de GitHub** fijadas por versión mayor, no por hash de commit.
- **Dos avisos de dependencias de solo desarrollo** (`deepmerge` y `minimatch`, vía `shadcn`); no llegan a producción.
- **COEP no activada:** aviso bajo de ZAP aceptado a propósito.
- **Listados limitados a 50 entradas**, sin paginación.
- **Si la web da error:** el proyecto gratuito de Supabase puede estar pausado. Contactad conmigo y lo reactivo.
- **Despliegue:** la sustitución de la caché del service worker entre versiones no se ha comprobado por separado, y no consta que el despliegue en Vercel esté condicionado a que la CI esté en verde.
- **ZAP** no recorre la intranet (el escaneo es sin sesión) y solo se ha ejecutado contra una build local.
- **Calculadora:** solo signos solares, sin carta natal ni zona horaria; son convenciones de la tradición astrológica, sin base científica.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/design.md`](docs/design.md) | Guía de diseño y pantallas |
| [`docs/astrologia-reglas.md`](docs/astrologia-reglas.md) | Reglas de la calculadora (fuente de verdad) |
| [`docs/adr/`](docs/adr/README.md) | Decisiones de arquitectura (ADR 0001–0023) |
| [`docs/threat-model.md`](docs/threat-model.md) | Modelo de amenazas (STRIDE ligero) |
| [`docs/owasp-checklist.md`](docs/owasp-checklist.md) | Checklist OWASP Top 10:2025 con evidencia |
| [`docs/ai-log.md`](docs/ai-log.md) | Registro de uso de IA |
| [`docs/memoria.md`](docs/memoria.md) | Memoria del TFM |
| [`tests/integration/README.md`](tests/integration/README.md) | Proyecto de test y uso acotado de `service_role` |

## Autoría

Trabajo Final de Máster de Ivan Maldonado. El repositorio no incluye un archivo `LICENSE`.
