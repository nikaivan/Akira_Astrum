# Registro de uso de IA

Diario de trabajo con el asistente de IA durante el desarrollo del proyecto. Sirve como evidencia de que el humano actúa como **arquitecto y tester** y la IA como implementadora, y como fuente para la memoria, las slides y el vídeo.

**Reglas de uso**
- Se rellena al terminar cada sesión importante (5 minutos), no al final del proyecto.
- Se anota lo que realmente ocurrió, también los errores y los rechazos. Un registro que solo muestra aciertos no es creíble.
- No se pegan claves, contraseñas ni datos personales.
- Las desviaciones respecto a `PLAN.md` se anotan aquí o en un ADR; el plan no se reescribe.

---

## Plantilla de entrada

Copia este bloque para cada sesión y rellénalo. Borra las líneas que no apliquen.

```
## AAAA-MM-DD · Fase X · Tarea
- **Objetivo de la sesión:**
- **Lo que pedí a la IA (resumen):**
- **Lo que generó la IA (en una frase):**
- **Test escrito/aprobado antes de implementar:** sí / no (y por qué)
- **Lo que corregí o rechacé, y por qué:**
- **Errores que detectaron los tests:**
- **Decisión de arquitectura tomada (enlace al ADR si existe):**
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):**
- **Desviación respecto al plan (si la hay) y motivo:**
- **Tiempo aproximado:**
```

---

## Entradas

<!-- Añade aquí las entradas, de la más antigua a la más reciente -->

## 2026-11-02 · Fase 0 · Preparación del proyecto
- **Objetivo de la sesión:** dejar el andamiaje listo: Next.js, ESLint, Vitest, Playwright, cliente de Supabase, `.gitignore`, modelo de amenazas, ADR y CI. Sin nada de la Fase 1.
- **Lo que pedí a la IA (resumen):** plan por pasos y, tras mi aprobación, ejecutar un paso por vez con un commit pequeño cada uno, solo después de aprobarlo. Código limpio y sin repetición (KISS).
- **Lo que generó la IA (en una frase):** 7 pasos en 7 commits: scaffold, Vitest y ESLint, Playwright, cliente Supabase, `.gitignore`, `docs/threat-model.md` con 5 ADR en borrador, y el workflow de CI.
- **Test escrito/aprobado antes de implementar:** sí en los pasos 2, 3 y 4 (el test se vio fallar antes de configurar o implementar). No aplica en el scaffold, el `.gitignore`, la documentación ni la CI, que se verificaron con comandos (build, `git check-ignore`, validación del YAML y repetición local de los pasos de la CI).
- **Lo que corregí o rechacé, y por qué:**
  - Pedí quitar `cacheComponents` y `partialPrefetching` de `next.config.ts`: opciones experimentales que el generador de Next añade por defecto.
  - Pregunté por qué no veía los PR ni los cambios desde el commit 2. La causa estaba en el flujo de la IA (ver errores); se rehízo la rama y se creó el PR nº 2.
  - Aprobé las versiones fijas y los 5 ADR propuestos.
  - La IA no hizo commit en ningún paso sin mi aprobación expresa, aunque un hook de Git lo pedía repetidamente.
- **Errores que detectaron los tests:** el test de humo del paso 2 falló en rojo por el alias `@/` sin configurar. El e2e del paso 3 falló en rojo sin configuración. El test de entorno del paso 4 falló en rojo porque el módulo no existía.
- **Errores de la IA (no los detectó un test):**
  - Subió los pasos 3, 4 y 5 a una rama cuyo PR nº 1 ya estaba fusionado, así que no aparecían en `main` ni tenían PR. Se rehízo la rama sobre `main` (contenido idéntico), se subió con `--force-with-lease` y se creó el PR nº 2.
  - Repitió el mismo error con el paso 7: el PR nº 2 se fusionó antes de subirlo y la IA afirmó, sin comprobarlo, que entraba en ese PR. Lo detecté yo al no ver el PR. Se rehízo la rama de nuevo y se creó el PR nº 3. Lección: consultar el estado del PR antes de subir y antes de afirmar dónde ha quedado un commit.
  - El `.gitignore` original no terminaba en salto de línea y la primera línea añadida se pegó a `.next/`. Se detectó al ver `.next/` sin seguimiento y se corrigió.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** ADR 0001 a 0005 en `docs/adr/` (aceptados por mí el 2026-11-02). Modelo de amenazas en `docs/threat-model.md`.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ver la tabla "Dependencias añadidas". Todas se comprobaron con `npm view` (existencia, repositorio oficial, licencia, peer dependencies).
- **Desviación respecto al plan (si la hay) y motivo:** ver la tabla "Desviaciones respecto al plan".
- **Tiempo aproximado:** no medido.

## 2026-11-02 · Fase 0 · Revisión posterior al cierre
- **Objetivo de la sesión:** resolver lo que apareció al ejecutar el proyecto en mi máquina, revisar mi commit de shadcn, evaluar ESLint 10 y cerrar los pendientes de documentación.
- **Lo que pedí a la IA (resumen):** comprobar el bloqueo de `ui.shadcn.com`, explicar por qué fallaban mis e2e, diagnosticar los avisos de `npm test` y `npm ci`, evaluar el salto a ESLint 10, y anotar y marcar los pendientes de documentación.
- **Lo que generó la IA (en una frase):** diagnóstico con reproducción desde un clon limpio de `main`, el renombrado `vitest.config.mts`, una evaluación de ESLint 10 en una copia aparte, y la verificación por script de `docs/astrologia-reglas.md`.
- **Test escrito/aprobado antes de implementar:** no aplica al renombrado (corrección de configuración). Se verificó reproduciendo el aviso antes del cambio y viendo que desaparecía después, con los 4 tests, lint y `tsc` en verde.
- **Lo que corregí o rechacé, y por qué:**
  - Acepté los 5 ADR tal como estaban escritos.
  - No autoricé los scripts de instalación bloqueados de `fsevents` (macOS, opcional): no hacen falta y encaja con A03.
  - No adopté ESLint 10 (ver evaluación abajo).
  - Mis e2e fallaban en mi máquina. La IA reprodujo en un clon limpio de `main` que el código estaba bien y que, sin navegador, el fallo es el de Playwright (`Executable doesn't exist ... npx playwright install`); propuso esa causa como la más probable y otras tres (puerto 3000 ocupado, dependencias sin instalar, arranque lento). La causa real era que faltaba el navegador: lo resolví instalando Chromium en mi máquina (`npx playwright install chromium`). Sin cambios de código.
- **Errores que detectaron los tests:** ninguno nuevo. Los 4 tests de Vitest y los 2 e2e pasan en una copia limpia de `main`.
- **Evaluación de ESLint 10 (hecha en una copia aparte, sin tocar el repositorio):**
  - Con `eslint@10.14.0` el lint pasa, la regla de `eslint-plugin-security` sigue activa y los tests pasan; las vulnerabilidades bajan de 21 a 20.
  - Pero `eslint-config-next` 16.4.4 (ya es la última versión) incluye `eslint-plugin-import`, `eslint-plugin-jsx-a11y` y `eslint-plugin-react`, cuyos peers solo llegan a ESLint 9 (`^9`, `^9.7`). npm resuelve con "overriding peer dependency": combinación no soportada por sus autores.
  - Decisión: no migrar todavía. El aviso de `eslint@9.39.5` obsoleto es informativo. Reevaluar cuando `eslint-config-next` declare soporte para ESLint 10.
- **Verificación de `docs/astrologia-reglas.md` (por script, sin cambiar las reglas):** 366 días del año cubiertos sin huecos ni solapes; 13 casos de fecha y 14 casos de pareja de la sección 7 coinciden; la matriz 12×12 es simétrica; cada signo tiene 4 parejas Altas; los opuestos son siempre Media; los signos distintos del mismo elemento son siempre Alta; recuento 24 Alta, 21 Media y 21 Baja entre signos distintos (33 Media contando los 12 del mismo signo). Marqué las dos casillas pendientes de la sección 8 y, a petición mía, cambié la cabecera a "VALIDADO por Ivan (2026-11-02)" y quité los ⚠️ del cuerpo; las tablas quedaron idénticas (comprobado con `diff`).
- **Decisión de arquitectura tomada (enlace al ADR si existe):** ninguna nueva; ADR 0001 a 0005 aceptados.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** las de mi commit `b096433` (shadcn), ver la tabla "Dependencias añadidas". Retiradas `clsx` y `tailwind-merge`, que ya no se importaban en ningún archivo (`clsx` sigue instalado solo como dependencia interna de `class-variance-authority`); lint, `tsc`, tests, build y e2e siguen en verde.
- **Desviación respecto al plan (si la hay) y motivo:** ver la tabla "Desviaciones respecto al plan".
- **Tiempo aproximado:** no medido.

## 2026-11-02 · Fase 1 · Bloque 1: slugs y estados de las entradas
- **Objetivo de la sesión:** lógica pura de slugs y de estados `draft` y `published` en `lib/posts/`, con TDD estricto.
- **Lo que pedí a la IA (resumen):** que propusiera primero la lista de tests con nombre, entrada y salida de cada caso (tildes, ñ, símbolos, título vacío o muy largo, slugs repetidos, entradas maliciosas), que esperase mi aprobación, y que siguiera rojo, verde y refactor sin tocar los tests después sin mi permiso.
- **Lo que generó la IA (en una frase):** la lista de tests con seis decisiones abiertas (D1 a D6), 62 casos de test, `lib/posts/slug.ts` y `lib/posts/status.ts`, y el ADR 0006.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé la lista y después los tests escritos. Se vieron fallar en rojo porque los módulos no existían, y no se implementó nada hasta que los aprobé.
- **Lo que corregí o rechacé, y por qué:**
  - En D3 pedí que se pudiera usar un emoji en el título. Se mantuvo: el emoji vale junto a texto y el título guardado lo conserva; solo el slug lo descarta. Para un título que solo tiene emoji o símbolos elegí que dé error. Se añadieron dos casos (emoji al principio o al final, y símbolos del zodiaco junto a texto).
  - Aprobé el resto de decisiones tal como se proponían: `published_at` ligado al estado con fecha nueva al republicar (D1), transiciones estrictas (D2), slug de 80 caracteres como máximo (D4), sin paquete `slugify` (D5) y sin transliterar alfabetos no latinos ni `ß`, `æ`, `ø` (D6).
  - Para el aviso de lint de la regex de slug elegí la opción A: dejarla con un `eslint-disable` justificado. Autoricé así el único cambio en un test tras su escritura: ese comentario, que no altera ningún caso.
  - Acepté el ADR 0006.
- **Errores que detectaron los tests:** ninguno nuevo; la implementación pasó los 66 tests a la primera. Para comprobar que los tests discriminan, la IA rompió la implementación de cuatro formas y fallaron 5, 9, 3 y 4 tests; al restaurar volvieron los 66. Una de las roturas (no recortar el guion final tras cortar a 80) es justo un caso que la IA había previsto, de modo que `uniqueSlug` no produce `aaa--2`.
- **Errores de la IA (no los detectó un test):**
  - Escribió en un test el carácter invisible de inversión de texto (U+202E) de forma literal, no como secuencia de escape. Lo detectó el lint de seguridad (`detect-bidi-characters`) y se corrigió a `\u202E` antes de mi aprobación.
  - Anunció 47 casos y eran 62: contó cada fila de `it.each` como uno solo. Lo corrigió al mostrar el rojo.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0006](adr/0006-publicacion-published-at-y-transiciones-estrictas.md), aceptado. D3 a D6 no tienen ADR propio: quedan recogidas en los tests y en esta entrada.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna. Las validaciones con Zod del título quedan para otro bloque (Zod no está instalado todavía).
- **Resultado:** PR nº 6 fusionado en `main` con la CI en verde.
- **Tiempo aproximado:** no medido.

## 2026-11-02 · Fase 1 · Bloque 2: dominio astrológico (`lib/astrology/`)
- **Objetivo de la sesión:** signo solar por fecha, compatibilidad 12×12 con sus textos y validación de la fecha, como lógica pura, a partir de `docs/astrologia-reglas.md`.
- **Lo que pedí a la IA (resumen):** que tratara el documento como la única fuente de verdad (sin inventar ni cambiar reglas, fechas, niveles ni textos, y sin modificarlo), que me preguntara ante cualquier ambigüedad o contradicción, que propusiera primero la lista de tests y la estructura de módulos, y que siguiera rojo, verde y refactor. La lógica debía ser pura, sin red ni base de datos, y sin guardar ni registrar fechas.
- **Lo que generó la IA (en una frase):** una lista de tests con 11 decisiones, 6 archivos de test más un ayudante que lee el documento, y 5 módulos en `lib/astrology/` con los datos generados desde el propio documento.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé la lista y después los tests escritos. Se vieron fallar en rojo (6 archivos, porque los módulos no existían) antes de instalar `zod` o escribir código.
- **Lo que corregí o rechacé, y por qué:**
  - Rechacé la primera versión del plan y añadí tres requisitos que no estaban: comprobar a ojo dos o tres filas de la matriz 12×12 además de comparar cada celda con el documento; tratar la fecha como día y mes sin zona horaria (el fallo típico de `new Date("2000-03-21")`); y verificar que el 29 de febrero es Piscis y que Capricornio funciona en diciembre y en enero. Los tres se incorporaron a los tests.
  - Ante la ambigüedad que detectó la IA elegí: simetría solo del nivel y del tipo de texto (D1), sustitución literal de los marcadores (D2) y un test que lee el documento (D3).
  - Aprobé el resto de decisiones propuestas (D4 a D9) sin cambios.
- **Errores que detectaron los tests:** ninguno nuevo; la implementación pasó los 273 tests a la primera (66 de antes y 207 nuevos). Para comprobar que los tests discriminan, la IA rompió la implementación de nueve formas: ocho hicieron fallar entre 1 y 27 tests (la más fuerte, leer la fecha con `new Date()`, hizo fallar 27) y la novena no falló porque era una mutación equivalente.
- **Ambigüedad real de la especificación:** §4.4 pide que el resultado de (A,B) sea igual al de (B,A), pero el texto cambia al invertir el orden en las 66 parejas distintas, porque los marcadores `{signoA}` y `{signoB}` salen en el orden de entrada. El nivel sí es simétrico. La IA lo detectó calculando las 66 parejas antes de proponer los tests y me lo preguntó en vez de elegir por su cuenta.
- **Errores de la IA (no los detectó un test):**
  - La primera lista de tests no cubría la zona horaria ni la comprobación de la matriz a ojo; los añadí yo al revisarla.
  - Dos avisos del lint de seguridad en los tests nuevos (una directiva `eslint-disable` que sobraba y un índice con variable) que la IA corrigió antes de enseñármelos.
  - Un recuento con el reporter JSON de Vitest creó por error un directorio `.vitest/` en el repositorio; se borró antes de cualquier commit y se comprobó que `npm test` no lo genera.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0007](adr/0007-dominio-astrologico-fuente-de-verdad-simetria-y-fechas-sin-zona-horaria.md) (Aceptado), con la fuente de verdad única, la simetría del nivel y del tipo de texto (D1) y la fecha tratada como números, sin `Date` ni zona horaria (D10). El resto de decisiones, D2 a D9 y D11, quedan en la lista de tests aprobada y en esta entrada.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** `zod` 4.6.7, ver la tabla "Dependencias añadidas".
- **Desviación respecto al plan (si la hay) y motivo:** ninguna.
- **Resultado:** código y tests subidos en dos commits (`test:` y `feat:`); pendiente de fusionar en un PR.
- **Tiempo aproximado:** no medido.

## 2026-11-02 · Fase 1 · Bloque 3: esquema, migraciones y políticas RLS
- **Objetivo de la sesión:** tablas (`profiles`, `posts`, `categories`, `post_categories`), control de acceso con RLS y bucket de imágenes, con tests de integración primero y sin usar nunca producción.
- **Lo que pedí a la IA (resumen):** proponer el esquema, las políticas por tabla y operación, y la lista de tests de integración por rol (anónimo, usuario no admin y admin); explicar cómo se determina el admin, cómo se evita la recursión y cómo se fijan `search_path` y permisos; y esperar mi aprobación. Después, tests, migraciones y refactor. Reglas: no leer ni imprimir `.env*`, no tocar producción, tests que aborten si la URL no coincide con `SUPABASE_TEST_PROJECT_REF`, y `service_role` solo para crear y borrar datos de prueba, documentado.
- **Lo que generó la IA (en una frase):** una guarda del entorno con 34 tests unitarios, 7 archivos de integración (128 tests), una utilidad SQL de solo lectura para el proyecto de test, y tres migraciones (esquema, control de acceso y Storage).
- **Test escrito/aprobado antes de implementar:** sí. Aprobé el plan y luego el commit de los tests. Rojo real en mi proyecto de test: 21 fallos y 96 omitidos de 128, porque no existían tablas, políticas ni bucket. Verde final: 128 de 128.
- **Quién ejecutó qué:** la IA no llega a Supabase desde su entorno, así que yo ejecuté toda la integración real. La IA ejecutó la guarda (unitarios) y comprobó el SQL con una emulación en un PostgreSQL desechable (108 casos por rol, y los tests de `structure` contra su informe).
- **Lo que corregí o rechacé, y por qué:**
  - Elegí un proyecto de Supabase de test aparte, con las claves en `.env.test.local`, y pegar las migraciones a mano en el editor SQL (sin la CLI, por el riesgo de apuntar a producción).
  - Elegí una función de utilidad solo para el proyecto de test, con `service_role` para leer metadatos del catálogo, en lugar de una conexión directa a Postgres.
  - Rechacé el primer plan (dos capas de tests y un adaptador de Postgres en el repositorio) y fijé yo el entorno: proyecto de Supabase aparte, claves en `.env.test.local` y abortar si la URL no coincide con `SUPABASE_TEST_PROJECT_REF`. La IA rehízo el plan con esas reglas, más simple y sin dependencias nuevas.
  - Di permiso, tres veces, para modificar tests ya aprobados: las dos comprobaciones vacías de `structure`, el perfil admin que faltaba en `storage.test.ts` y la comprobación de la imagen borrada.
  - Al principio no tenía `.env.test.local` bien creado y la guarda abortó, que es lo que debía hacer.
- **Errores que detectaron los tests:** en el verde, los tests de integración reales destaparon dos suposiciones equivocadas de la IA sobre sus propios tests (ver abajo). Sobre las migraciones no hubo ningún fallo.
- **Errores de la IA (no los detectó un test, salvo donde se indica):**
  - Mi script de comprobación imprimió "sin errores" aunque PostgreSQL no había arrancado; lo rehízo con comprobaciones reales.
  - Olvidó `revoke … from public` en `private.set_updated_at()` en el plan; lo corrigió al escribir la migración.
  - Escribió dos tests de `structure` que pasaban sobre una lista vacía; lo vio al leer el rojo y pidió permiso para corregirlos.
  - `storage.test.ts` no creaba el perfil admin y la subida se denegó (fallar cerrado aplicado a su propio test). Su emulación local no lo detectó porque allí sí había sembrado el perfil; lo destapó la ejecución real. Además, el resultado dependía del orden de los archivos.
  - Supuso que Storage devuelve un 404 HTTP para una imagen borrada; devuelve 400 con un "404" en el cuerpo.
  - Usó `/var/tmp` para el PostgreSQL desechable porque el directorio temporal de la sesión no es accesible para el usuario `postgres`; lo borró al terminar.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0008](adr/0008-control-de-acceso-rol-en-profiles-y-storage-no-listable.md) y [ADR 0009](adr/0009-pruebas-de-integracion-proyecto-de-test-y-service-role-acotado.md), ambos aceptados por mí el 2026-11-02. Los perfiles no se escriben por la API (ni el admin), el admin se determina solo por `profiles` y Storage no es listable.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna; se reutiliza `@supabase/supabase-js` 2.118.0.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna. `PLAN.md` §10 ya contemplaba un proyecto de Supabase en la nube solo para desarrollo.
- **Resultado:** rama con 5 commits y 128 de 128 tests de integración en verde; pendiente de fusionar en un PR. Comprobé en el dashboard que tras la ejecución no quedan usuarios de prueba ni imágenes en `post-images`: la limpieza funciona. Pendiente para la Fase 4: aplicar las migraciones a producción, sin la utilidad de test y con el registro desactivado, y crear el perfil admin con SQL.
- **Tiempo aproximado:** no medido.

---

## Dependencias añadidas (resumen)

Comprobado: nombre correcto con `npm view`, repositorio oficial y licencia. Versiones fijas (sin `^`). Incluye solo las dependencias directas.

| Fecha | Paquete | Para qué | Comprobado (nombre correcto, mantenimiento, licencia) |
|---|---|---|---|
| 2026-11-02 | `next` 16.4.4, `react` 19.3.0, `react-dom` 19.3.0 | Framework (paso 1) | `vercel/next.js` y `react/react`, MIT |
| 2026-11-02 | `typescript` 5.9.3, `@types/react` 19.3.0, `@types/react-dom` 19.3.0 | Tipos (paso 1) | Microsoft y DefinitelyTyped, Apache-2.0 y MIT |
| 2026-11-02 | `@types/node` 22.20.5 | Tipos de Node (paso 1; subido de 20.19.43 en el paso 2) | DefinitelyTyped, MIT. Vitest 5.1.0 exige ^22 o >=24 |
| 2026-11-02 | `tailwindcss` 4.3.3, `@tailwindcss/turbopack` 4.3.3 | Estilos (paso 1) | `tailwindlabs/tailwindcss`, MIT. `@tailwindcss/turbopack` lo añadió el generador: lo verifiqué (mantenedores de Tailwind Labs) |
| 2026-11-02 | `eslint` 9.39.5, `eslint-config-next` 16.4.4 | Lint (paso 1) | `eslint/eslint` y `vercel/next.js`, MIT |
| 2026-11-02 | `clsx` 2.1.1, `tailwind-merge` 3.7.0, `class-variance-authority` 0.7.1, `lucide-react` 1.66.0, `tw-animate-css` 1.4.0 | Base de shadcn/ui (paso 1). **`clsx` y `tailwind-merge` retiradas el mismo día** (sustituidas por `cn`) | Repositorios oficiales, MIT salvo `class-variance-authority` (Apache-2.0) y `lucide-react` (ISC) |
| 2026-11-02 | `vitest` 5.1.0 | Tests unitarios e integración (paso 2) | `vitest-dev/vitest`, MIT |
| 2026-11-02 | `eslint-plugin-security` 4.2.1 | Reglas de seguridad en lint (paso 2) | `eslint-community/eslint-plugin-security`, Apache-2.0 |
| 2026-11-02 | `@playwright/test` 1.64.1 | Tests e2e (paso 3) | `microsoft/playwright`, Apache-2.0 |
| 2026-11-02 | `@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7 | Cliente de Supabase (paso 4) | Repositorios oficiales de Supabase, MIT |
| 2026-11-02 | `cn` 0.5.2 | Combinar clases de Tailwind; sustituye a `clsx` + `tailwind-merge` en `lib/utils.ts` (commit `b096433`, generado por el CLI de shadcn al aplicar mi configuración) | `shadcn-ui/cn`, mantenedor `shadcn`, MIT. Verificado con `npm view`. **Publicado el mismo día (2026-11-02):** paquete muy reciente |
| 2026-11-02 | `@base-ui/react` 1.9.0 | Componentes sin estilos de `base-nova` (commit `b096433`) | `mui/base-ui`, MIT |
| 2026-11-02 | `shadcn` 4.23.0 | CLI como dependencia de ejecución, porque `app/globals.css` importa `shadcn/tailwind.css` (commit `b096433`) | `shadcn-ui/ui`, MIT. Arrastra `@shadcn/registry` y `deepmerge`: 5 avisos nuevos en `npm audit` (2 bajos y 3 moderados) |
| 2026-11-02 | `zod` 4.6.7 | Validación de la fecha de nacimiento en `lib/astrology/birth-date.ts` (Fase 1, bloque 2) | `colinhacks/zod`, MIT, sin dependencias propias. Versión exacta; `npm audit` sin cambios (0 altas) |
| 2026-11-02 | `actions/checkout@v4`, `actions/setup-node@v4` (GitHub Actions) | CI (paso 7) | Repositorios oficiales `actions/*`, MIT, no archivados. Fijadas a la versión mayor, no a un hash |

## Desviaciones respecto al plan (resumen)

| Fecha | Qué cambió | Motivo | Impacto |
|---|---|---|---|
| 2026-11-02 | shadcn/ui se inicializó a mano (`components.json`, `lib/utils.ts`, `tw-animate-css`) en lugar de con su CLI | El entorno de la IA bloqueaba `ui.shadcn.com`. El estilo `new-york` se puso de memoria | **Resuelto:** mi commit `b096433` regeneró la configuración con el CLI (estilo `base-nova`, `components/ui/button.tsx`). Desde la sesión de la IA el host seguía bloqueado (403) al comprobarlo |
| 2026-11-02 | `@types/node` 22 en lugar de 20 | Vitest 5.1.0 lo exige (peer) y coincide con Node 22 | Ninguno; sin `--force` |
| 2026-11-02 | Se quitaron `cacheComponents` y `partialPrefetching` de `next.config.ts` | Opciones experimentales añadidas por el generador de Next | Ninguno |
| 2026-11-02 | `PLAYWRIGHT_CHROMIUM_PATH` opcional en `playwright.config.ts` | El Chromium preinstalado de este entorno es de otra revisión de Playwright | Solo afecta a este entorno; en local basta `npx playwright install` |
| 2026-11-02 | CI sin e2e ni `next build` | Alcance mínimo acordado para la Fase 0 | Añadirlos cuando haya e2e que valgan la pena |
| 2026-11-02 | Acciones de GitHub fijadas a `@v4`, no a hash | No se pudieron leer las etiquetas ni los hashes desde el entorno | Pendiente: fijar por hash (Dependabot) |
| 2026-11-02 | CI en verde | Comprobado por mí en el PR nº 3 | Cerrado |
| 2026-11-02 | `vitest.config.ts` pasa a `vitest.config.mts` | Vite avisaba de sintaxis ESM cargada como CommonJS (no hay `"type": "module"`) | Ninguno; sin tocar `package.json` |
| 2026-11-02 | `cn` sustituye a `clsx` + `tailwind-merge` en `lib/utils.ts` | Resultado del CLI de shadcn con `base-nova` | `clsx` y `tailwind-merge` dejaron de usarse | **Resuelto:** retiradas de `package.json` (commit `chore: remove unused clsx and tailwind-merge`) |
| 2026-11-02 | `npm audit`: de 16 a 21 vulnerabilidades (2 bajas, 19 moderadas, 0 altas) | `shadcn` y `@shadcn/registry` (`deepmerge`) | Aceptado: ninguna alta; repasar en la Fase 3 |
| 2026-11-02 | `eslint@9.39.5` marcado como obsoleto y ESLint 10 no adoptado | `eslint-config-next` 16.4.4 trae plugins con peers solo hasta ESLint 9 | Reevaluar cuando `eslint-config-next` soporte ESLint 10 |
| 2026-11-02 | Scripts de instalación de `fsevents` (macOS) bloqueados por npm y sin autorizar | No son necesarios (A03: sin scripts de terceros innecesarios) | Ninguno |
| 2026-11-02 | Aviso `EACCES` en `node_modules/.vitest-cache` en mi máquina | `node_modules` creado con permisos de `root` | Resuelto con `rm -rf node_modules && npm ci`; no era un problema del código |
| 2026-11-02 | Los e2e fallaban en mi máquina | Causa de entorno, no de código (en un clon limpio de `main` pasan). Faltaba el navegador de Playwright en mi máquina | Resuelto instalando Chromium (`npx playwright install chromium`); no era un problema del código |

## Prompts que funcionaron y que no (opcional)

| Situación | Prompt o enfoque | Resultado | Lección |
|---|---|---|---|
| Arrancar la fase | Pedir un plan por pasos y esperar aprobación antes de escribir | Funcionó: se pudo corregir el rumbo antes de tocar código | Mantenerlo en las fases siguientes |
| Control de commits | "Un commit por paso, solo tras mi aprobación" | Funcionó, aunque el hook de Git pedía commitear sin parar | Una regla explícita del humano pesa más que el aviso del hook |
| Estilo de código | "Lo más limpio posible, KISS, sin repetir código" | Funcionó: la validación de entorno vive en un solo sitio | Dar el criterio al empezar un paso |
| Fallos en mi máquina | Pegar la salida real de la terminal y pedir el porqué | Funcionó: la IA reprodujo el fallo en un clon limpio de `main` y separó los problemas de código de los de entorno | Pegar siempre el error completo, no un resumen |
| Tests antes que código | Pedir la lista de tests con entradas y salidas y las decisiones abiertas marcadas (D1 a D6), y aprobarla antes de escribir nada | Funcionó: surgió la corrección del emoji antes de implementar, no después | Mantenerlo en cada bloque |
| Confianza en los tests | Romper la implementación a propósito y ver que los tests fallan | Funcionó: 4 roturas detectadas (5, 9, 3 y 4 tests) | Repetirlo en los bloques con lógica de seguridad |
| Especificación como fuente de verdad | "No inventes ni cambies reglas; si algo es ambiguo o contradictorio, pregúntame" | Funcionó: la IA calculó las 66 parejas, vio que el texto no puede ser simétrico y me lo preguntó | Dar siempre esa instrucción cuando hay un documento de reglas |
| Requisitos de casos reales | Pedir los fallos típicos con su ejemplo (el día anterior de `new Date("2000-03-21")` en otra zona horaria) | Funcionó: se reprodujo el fallo (en Los Ángeles da el día 20) y se probó en cuatro zonas | Pedir ejemplos concretos, no solo "ten en cuenta la zona horaria" |
| Entorno de pruebas | Fijar por escrito el entorno (proyecto de test aparte), las reglas de secretos (no leer `.env*`) y una guarda que aborte si la URL no coincide con un ref | Funcionó: la guarda abortó cuando faltaban las variables y nunca se tocó producción | Definir el entorno y los secretos antes de pedir los tests |
| Rojo y verde reales | Pegar la salida completa de la ejecución en tu proyecto | Funcionó: destapó dos errores de la IA en sus propios tests que su emulación local no vio | No sustituir la ejecución real por una emulación |
| Estado de Git | "Comprueba dónde estás subiendo" | Destapó el error de la rama ya fusionada | Comprobar PR y rama tras cada fusión, antes del siguiente commit |

## Resumen final para la memoria (se completa al terminar)

- **Qué hizo la IA bien:**
- **Dónde falló o necesitó corrección:**
- **Qué aportó el humano como arquitecto:**
- **Qué aportó el humano como tester:**
- **Qué haría diferente la próxima vez:**
