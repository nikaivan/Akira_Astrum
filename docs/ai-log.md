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

## 2026-11-02 · Fase 1 · Bloque 4: login del admin y protección de la intranet
- **Objetivo de la sesión:** login del admin con `@supabase/ssr`, `/login` y `/admin/*` protegidos (sin sesión → `/login`; no admin → 403), sin registro, con tests unitarios, de integración y e2e (escritorio y móvil) primero, y sin usar nunca producción.
- **Lo que pedí a la IA (resumen):** proponer la arquitectura y la lista de tests por nivel antes de escribir nada; autorizar con `getUser()` (no `getSession()`) en cada Server Action y Route Handler, con el proxy solo como capa extra; mensaje de error idéntico para correo inexistente y contraseña errónea; limitación de intentos sin servicios de pago, explicando sus límites; cookies `httpOnly`/`secure`/`sameSite`; validación contra redirección abierta; `noindex` y fuera de la caché pública; fallar cerrado con un fallo simulado; axe-core en `/login`. Reglas: no leer `.env*`, e2e e integración solo contra el proyecto de test, usuarios temporales y nunca mis credenciales de admin.
- **Lo que generó la IA (en una frase):** 9 archivos de tests unitarios nuevos (más uno de arquitectura sobre el código fuente), 2 de integración, 2 specs e2e con su infraestructura (servidor propio en el puerto 3100, usuarios temporales) y la implementación de `lib/auth/`, `proxy.ts`, `/login` y `/admin`.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé el plan, luego los tests. Rojo: en integración fallaron los 2 archivos nuevos por falta de módulos (128 existentes en verde) y el e2e no arrancaba (faltaba `@axe-core/playwright`). Verde final: 493 unitarios, 139 de integración y 44 e2e.
- **Quién ejecutó qué:** la IA ejecutó los unitarios y los e2e que no necesitan Supabase (con variables de relleno); yo ejecuté la integración y los e2e con login contra el proyecto de test. La IA no llega a Supabase desde su entorno.
- **Decisiones que tomé yo:** limitador en memoria por IP (L1); a un no admin con credenciales correctas se le cierra la sesión y se le muestra el mismo error genérico (L2); el 403 lo da el proxy (L3); sesión de 8 horas (L4). Además aprobé las propuestas P1 a P9 (cookie, 503 ante fallo de infraestructura, mensaje único, `next` solo dentro de `/admin`, `signOut` global, panel mínimo, IP de `x-forwarded-for`, servidor e2e propio en el puerto 3100 y `service_role` solo para usuarios temporales).
- **Lo que corregí o rechacé, y por qué:** di permiso, tres veces, para cambiar tests ya aprobados, todos del mismo tipo (localizadores o datos de test mal planteados, no aserciones): acotar `getByRole("alert")` al formulario, porque Next incluye un `role="alert"` vacío y Playwright encontraba dos elementos, y usar IPs distintas por proyecto en el test del límite. Pospuse el test del service worker a la Fase 3 y la MFA como mejora.
- **Errores que detectaron los tests:**
  - El e2e destapó que `@supabase/ssr` fuerza la cookie a 400 días e ignora `cookieOptions`; la IA lo corrigió reimponiendo las opciones antes de escribir cada cookie, con un test unitario nuevo.
  - El e2e del límite de intentos falló porque escritorio y móvil, en paralelo, compartían IP y contador.
  - Los e2e sin Supabase destaparon `type="email"` bloqueando el envío (se añadió `noValidate`), el `role="alert"` duplicado y un falso fallo de contraste de axe por la transición del botón (`transition-none`).
- **Errores de la IA (no los detectó un test, salvo donde se indica):**
  - Escribió dos tests mal planteados (el `role="alert"` duplicado y las IPs compartidas); los destapó la ejecución real y el e2e sin Supabase.
  - Tres tests e2e pasaban vacíos antes de existir `/login`; lo vio al leer el rojo y los endureció.
  - Algunos errores de lint y de carga en sus propios tests (`use` como nombre de callback, opciones de `import.meta.glob`, lista de excepciones de `service_role`).
  - Su suposición sobre las cookies de `@supabase/ssr` era incompleta: revisó los valores por defecto, pero no que se pisan al escribir.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0010](adr/0010-autorizacion-en-capas-proxy-requireadmin-y-rls.md) y [ADR 0011](adr/0011-login-y-sesion-mensaje-unico-limitador-en-memoria-y-cookies.md), ambos aceptados por mí el 2026-11-02.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** `@axe-core/playwright` 4.14.0 y `axe-core` 4.14.0 (ver la tabla de dependencias). `@supabase/ssr` ya estaba instalado.
- **Desviación respecto al plan (si la hay) y motivo:** el `smoke` e2e pasa al puerto 3100 y `npm run test:e2e` exige `.env.test.local`, para que los e2e nunca hablen con producción. El 403 se da en el proxy porque `forbidden()` de Next es experimental.
- **Resultado:** login y protección de `/admin` completos. Cobertura pendiente declarada: el test del service worker (Fase 3). Pendiente para la Fase 3: MFA (TOTP). Pendiente para la Fase 4: aplicar las migraciones a producción, sin la utilidad de test, con el registro desactivado y con el perfil admin creado por SQL.
- **Tiempo aproximado:** no medido.

---

## 2026-11-02 · Fase 2 · Bloque 1: página pública de la calculadora de compatibilidad
- **Objetivo de la sesión:** la página pública `/compatibilidad` (dos fechas de nacimiento, signo y elemento de cada persona, nivel con icono y texto, explicación y aviso de uso), reutilizando el dominio de `lib/astrology/` sin tocarlo, con validación en servidor, sin guardar nada y con límite de consultas. Después, el estilo de `docs/design.md`.
- **Lo que pedí a la IA (resumen):** proponer ruta, componentes y si el cálculo va en Server Action o en el cliente, con la lista de tests por nivel, y esperar mi aprobación. Requisitos: Zod en servidor (fecha vacía, inexistente, futura, anterior a 1900, texto), errores legibles por lector de pantalla, sin persistencia ni logs ni red ni URL, `Cache-Control: no-store`, límite de intentos sin servicios de pago, textos como texto, datos del dominio sin inventar, móvil primero con objetivos de 44 px, e2e con dos casos de la sección 7, simetría al intercambiar las fechas y axe-core. Luego, rojo, verde, refactor y estilo, con un commit por ciclo tras mi aprobación.
- **Lo que generó la IA (en una frase):** `lib/compatibility/` (esquema Zod, lógica pura, limitador, mensajes y Server Action), `app/compatibilidad/` (página, formulario y resultado), cabecera y pie públicos, 9 archivos de tests unitarios y un spec e2e de 21 casos.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé el plan y luego los tests. Rojo: 9 archivos unitarios sin cargar y 42 de 42 e2e fallando (21 tests por escritorio y móvil). Verde: 608 unitarios y 64 e2e sin Supabase (42 de la calculadora y 22 existentes).
- **Quién ejecutó qué:** la IA ejecutó todo (la calculadora no usa Supabase). Yo la probé a mano en el navegador. Los e2e con Supabase (login) no se han repetido tras el cambio de estilo.
- **Decisiones que tomé yo:** Server Action por `POST` (C1), con permiso para añadir una línea a `PUBLIC_ACTIONS` en el test de arquitectura del bloque 4; límite de 30 consultas cada 10 minutos por IP (C2); "hoy" es la fecha UTC del servidor (C3). Además aprobé las propuestas Q1 a Q7 (mensajes por campo, `noValidate`, errores accesibles, resultado con icono y texto, `no-store` sin `noindex`, mensaje de límite propio y sin dependencias nuevas).
- **Lo que corregí o rechacé, y por qué:** di permiso, dos veces, para cambiar tests ya aprobados, ambos fallos de diseño de tests de la IA y no de aserciones: (1) los casos de texto inválido pasan a interceptar el `POST` real, porque React vuelve a fijar el tipo del campo `date` en cada evento y el valor se saneaba a vacío; (2) el test del teclado rellena con `fill`, porque teclear en un campo `date` depende del idioma del navegador. Decidí que el "hoy" en UTC no lleve margen de un día.
- **Errores que detectaron los tests:**
  - Los campos controlados perdían lo escrito si se rellenaban antes de hidratar; la IA los pasó a no controlados con `defaultValue`.
  - Los e2e destaparon los dos tests mal planteados de arriba.
  - Un test de arquitectura nuevo mencionaba la clave de servicio de Supabase y rompía la lista de archivos permitidos del bloque 4; la IA la sustituyó por una expresión que no contiene esa cadena.
- **Errores de la IA (no los detectó un test, salvo donde se indica):**
  - La primera verificación del estilo usó CSS obsoleto (la caché de Turbopack no recogió el cambio de `globals.css`) y los tests de contraste pasaron sobre la paleta vieja; lo vio al revisar las capturas con la vista y repitió toda la verificación con la caché limpia.
  - Atribuyó un aviso de hidratación a la aplicación antes de comprobarlo: lo causaba Playwright al ocultar el cursor en las capturas.
  - Escribió dos tests asumiendo comportamientos del navegador que no se cumplen (los dos de arriba).
  - Un aviso de lint por una expresión regular dinámica en un test; lo sustituyó por una comprobación literal.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0012](adr/0012-calculadora-publica-sin-persistencia-server-action-post-y-limite-en-memoria.md), aceptado por mí el 2026-11-03.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna. Se reutilizan `zod`, `lucide-react` (iconos) y el limitador del login.
- **Desviación respecto al plan (si la hay) y motivo:** los campos de fecha llevan `min` pero no `max`, porque una página estática congelaría la fecha de hoy en el build; la validación real es la del servidor. El componente `Input` está escrito a mano con el estilo de shadcn porque el CLI no es accesible desde el entorno de la IA.
- **Paso 4 (refactor y estilo):** un componente `Input` compartido sustituye a las clases duplicadas del login y de la calculadora, y se aplica `docs/design.md`: paleta (crema, índigo y dorado solo decorativo), Cormorant Garamond y Inter con `next/font`, cabecera y pie públicos y un botón en la portada. Los colores de los tres niveles usan la paleta de Tailwind, no tokens propios. Modo oscuro no aplicado.
- **Resultado:** `/compatibilidad` completa y probada. Cobertura pendiente declarada: el log de eventos de seguridad (A09) y la CSP, en la Fase 3; el service worker de la PWA no debe cachear las respuestas de la acción (Fase 3). Aparte, en mi máquina la carpeta `components` tenía permisos de `root` y el `pull` fallaba; se arregló con `chown`, sin tocar el código.
- **Tiempo aproximado:** no medido.

---

## 2026-11-03 · Fase 4 (anticipada) · Esquema en producción y primer administrador
- **Objetivo de la sesión:** entender por qué el login de la intranet rechazaba mis credenciales reales y dejar la intranet usable en mi `localhost` contra mi proyecto de producción.
- **Lo que pedí a la IA (resumen):** que explicara si era un fallo o una función pendiente. La IA propuso dos consultas SQL de solo lectura (existencia de `profiles` y estado de mi usuario) y, al salir `null`, me dio los pasos para preparar el proyecto. No ejecutó nada en producción.
- **Causa:** el proyecto de producción no tenía ninguna migración aplicada. Sin la tabla `profiles` la aplicación falla cerrado y devuelve el mismo mensaje genérico aunque la contraseña sea correcta (A07, A10): funcionaba como se diseñó, pero ese mensaje único oculta la causa, así que hizo falta mirar la base de datos.
- **Lo que hice yo, a mano:** desactivar el registro de nuevos usuarios; aplicar en el editor SQL las tres migraciones de `supabase/migrations/` por orden de nombre, **sin** `tests/integration/support/test-project-helper.sql`; crear mi usuario con "Auto Confirm User" y su fila en `profiles` con `role = admin` mediante SQL. Comprobé que `to_regclass('public.profiles')` dejó de devolver `null`.
- **Resultado:** el login funciona en `localhost` contra producción: entro en `/admin` con mi usuario.
- **Lo que no se ha comprobado:**
  - Los tests de integración y e2e solo corren contra el proyecto de test, nunca contra producción, así que el esquema de producción no está verificado por tests; solo por la prueba manual de arriba.
  - Que el registro quedó desactivado en producción lo comprobé a mano en el panel; no hay test que lo confirme allí.
  - Queda pendiente de la Fase 4 el despliegue en Vercel con las variables de entorno de producción.
- **Desviación respecto al plan (si la hay) y motivo:** el esquema de producción se aplica antes de la Fase 4, para poder usar la intranet en local. Ver la tabla "Desviaciones respecto al plan".
- **Decisión de arquitectura tomada (enlace al ADR si existe):** ninguna nueva. Confirma el ADR 0003 y el ADR 0010 (falla cerrado) y el ADR 0011 (mensaje único).
- **Dependencias nuevas:** ninguna.
- **Tiempo aproximado:** no medido.

---

## 2026-11-03 · Fase 2 · Bloque 2: Markdown sanitizado, blog público y páginas de categoría
- **Objetivo de la sesión:** mostrar las entradas publicadas con seguridad: Markdown sanitizado (A05), portada, listado, entrada `/blog/[slug]` y categoría, sin servir nunca un borrador ni una entrada despublicada (A01), reutilizando el acceso a datos y las políticas RLS de la Fase 1 sin tocarlas. Después, el estilo de `docs/design.md`.
- **Lo que pedí a la IA (resumen):** proponer rutas, componentes y la estrategia de renderizado y caché (cómo se evita servir un borrador desde caché); elegir la librería de Markdown y de sanitizado verificando el nombre exacto y la versión de cada paquete; y la lista de tests (sanitizado con payloads reales, enlaces solo `http`/`https`/`mailto` con `rel="noopener noreferrer"`, imágenes solo del Storage del proyecto, 404 idéntico para borrador/despublicada/inexistente/slug raro, metadatos, `next/image` con el host restringido, responsive, teclado y axe). Reglas: tests primero, un commit por ciclo tras mi aprobación y nada contra producción.
- **Lo que generó la IA (en una frase):** `lib/blog/` (lectura, tiempo de lectura, descripción, fecha, URL de portada, configuración de imágenes), `lib/markdown/` y `components/markdown.tsx` (sanitizado), un cliente de lectura anónimo sin cookies, las páginas públicas con su 404 y su error genéricos, 13 archivos de tests unitarios, un test de integración y un spec e2e de 20 casos por proyecto.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé el plan y luego los tests. Rojo: 13 archivos unitarios (12 sin cargar por faltar los módulos) y el e2e de slugs raros. Verde: 1292 unitarios; la integración completa y los 126 e2e, que ejecuté yo contra el proyecto de test.
- **Quién ejecutó qué:** la IA ejecutó los unitarios, `tsc`, el lint, `next build` y los e2e que no necesitan datos (64 y el de slugs raros); yo ejecuté la integración y los e2e con datos contra el proyecto de test, porque la IA no llega a Supabase. Las comprobaciones visuales y de accesibilidad del estilo se hicieron con una página de vista previa temporal con datos de ejemplo (borrada después).
- **Decisiones que tomé yo:** portadas con `alt=""` (decorativas) hasta que el bloque de subida añada el texto alternativo obligatorio (B1); páginas siempre dinámicas (B2); imágenes dentro del Markdown ya, solo del Storage del proyecto (B3); rutas `/blog` y `/categorias/[slug]` sin índice de categorías (B4). Concedí permisos para modificar tests ya aprobados, siempre de diseño del test y no de aserciones de seguridad: `export` de `isValidSlug`; cinco tests con comprobaciones que miraban el texto escapado en lugar de los atributos reales (`onclick=` como texto es inofensivo); el nivel de título del contenido; el selector de `style` de `next/image`; y la imagen de prueba.
- **Errores que detectaron los tests:**
  - El primer `next build` completo falló al prerenderizar `/admin`: el bloque 4 capturaba el aviso interno con el que `cookies()` marca una ruta como dinámica. Lo habría roto el despliegue. Corregido con `unstable_rethrow` y un test nuevo (`f8af840`).
  - axe encontró un fallo real de accesibilidad: un bloque de código con desplazamiento horizontal no se podía enfocar con el teclado. Corregido con `tabindex="0"` añadido tras el sanitizado.
  - Los e2e con datos destaparon dos tests mal planteados por la IA (el contenido baja un nivel de título; `next/image` escribe su propio `style`) y una imagen de prueba de 1×1 píxel: con `srcset` y `sizes`, `naturalWidth` se divide entre la densidad (≈1,8) y se trunca a 0, así que una imagen cargada parecía rota.
- **Errores de la IA (no los detectó un test, salvo donde se indica):**
  - Dio por bueno el PNG de prueba tras comprobar solo los CRC de sus bloques; hizo falta descomprimirlo y, después, reproducir el fallo en un Chromium con la tarjeta real para dar con la causa. Se descartó el optimizador, el PNG y el patrón de hosts antes de acertar con la medida.
  - Varios tests con regex demasiado amplios (texto escapado frente a atributos), `dateTime` en lugar de `datetime`, y un `beforeEach` que devolvía el mock (Vitest lo ejecutaba como limpieza).
  - No había ejecutado nunca `next build`: el fallo de `/admin` llevaba desde el bloque 4 sin detectarse.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0013](adr/0013-markdown-publico-sanitizado-react-markdown-y-lista-blanca-explicita.md) y [ADR 0014](adr/0014-lectura-publica-sin-cache-cliente-anonimo-y-404-unico.md), ambos aceptados por mí el 2026-11-03.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** `react-markdown` 10.1.0 y `rehype-sanitize` 6.0.0 (ver la tabla de dependencias). Entran 80 paquetes transitivos (79 MIT y 1 ISC), sin scripts de instalación; `npm audit` no cambia.
- **Desviación respecto al plan (si la hay) y motivo:** la entrada vive en `/blog/[slug]` y no en `/posts/[slug]` (`PLAN.md` §7), y no se usa el grupo de rutas `(public)`. El extracto de la entrada destacada de `docs/design.md` no se muestra: exigiría un campo nuevo en los datos de las tarjetas y en tests ya aprobados. Ver la tabla "Desviaciones respecto al plan".
- **Paso 4 (refactor y estilo):** las clases de enlace repetidas en seis sitios pasan a una sola (`textLinkClass`), y la lista de categorías, la línea de fecha y la cuadrícula de tarjetas a componentes compartidos (`CategoryLinks`, `PostMeta`, `PostGrid`). Estilo de `docs/design.md`: portada con entrada destacada y cuadrícula de 1, 2 y 3 columnas, tarjetas, tipografía del contenido de la entrada con ancho de lectura de 70 caracteres, cita con barra dorada y cabecera y pie alineados con la cuadrícula. Comprobado en escritorio y móvil con axe, desbordamiento y objetivos de 44 px.
- **Resultado:** blog público completo y verificado con datos reales. Pendiente declarado: texto alternativo de portada obligatorio y extracto de la entrada destacada (bloque de subida de imágenes), paginación (límite de 50), ISR con revalidación bajo demanda si algún día se quiere, y que el service worker (Fase 3) no cachee estas rutas.
- **Tiempo aproximado:** no medido.

## 2026-11-03 · Fase 2 · Bloque 3: CRUD de entradas y categorías en el panel
- **Objetivo de la sesión:** crear, listar, editar, publicar, despublicar y eliminar entradas, y crear, renombrar y eliminar categorías desde el panel, reutilizando sin tocarlos el login y la protección de `/admin`, las políticas RLS, la lógica de slugs y estados y el Markdown sanitizado. Fuera de alcance: subida de imágenes y portada (bloque 4).
- **Lo que pedí a la IA (resumen):** rutas y componentes del panel con una Server Action por operación; el esquema Zod estricto de cada formulario con sus límites; y la lista de tests por nivel (autorización de cada acción con anónimo y no admin, asignación masiva, validación, transiciones, slugs, eliminación con confirmación, CSRF, invalidación de caché, vista previa con el mismo sanitizado, responsive, teclado y axe). Reglas: tests primero, un commit por ciclo tras mi aprobación, nada contra producción ni con `service_role` en la aplicación.
- **Lo que generó la IA (en una frase):** `lib/admin/` (esquemas estrictos, servicios sin dependencias de Next, ocho Server Actions con `withAdminAction`, consultas del panel), los componentes y las cuatro páginas del panel, 12 archivos de tests unitarios con un Supabase en memoria que imita las restricciones de la base de datos, un test de integración y un spec e2e.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé el plan, luego los tests (`8910f07`) y después la implementación (`109e5e3`). Rojo: los 12 archivos unitarios fallaban por falta de los módulos. Verde: 1597 unitarios (305 nuevos), la integración completa y 162 e2e (36 nuevos), que ejecuté yo contra el proyecto de test.
- **Quién ejecutó qué:** la IA ejecutó los unitarios, `tsc`, el lint, `next build` (en una copia) y los 20 e2e que no necesitan datos; yo ejecuté la integración y los e2e con datos, porque la IA no llega a Supabase. El estilo se comprobó con una página de vista previa temporal con datos de ejemplo y capturas en escritorio y móvil, en una copia aislada que no entró en el repositorio.
- **Decisiones que tomé yo (cuatro preguntas del plan):** el extracto se deriva del contenido y no hay campo nuevo; los guardados a medias se resuelven por compensación y no con una función SQL; eliminar una categoría con entradas está permitido con confirmación y conserva las entradas; el slug de una entrada publicada queda bloqueado (regla nueva). Concedí permisos para modificar tests ya aprobados: una línea de tipos en `messages.test.ts`, y en `admin.spec.ts` el `h1`, la espera al cierre del diálogo y la sesión reutilizada.
- **Errores que detectaron los tests (primer e2e con datos: 12 fallos, 5 causas):**
  - El `h1` «Entradas» chocaba con un test aprobado de la Fase 1 que espera «Panel de administración». Mantuve el de la Fase 1 y cambié mi página y mi spec.
  - El aviso de errores del editor no contenía el mensaje del campo (por ejemplo, el slug repetido) que mi propio test esperaba en el `role="alert"`. Ahora el resumen lista los mensajes de cada campo.
  - axe encontró `label-content-name-mismatch` en el enlace «Ver en el blog», cuyo nombre accesible no contenía el texto visible.
  - Los tests de eliminar pasaban antes de tiempo: con el diálogo abierto el resto de la página sale del árbol de accesibilidad y el recuento de filas era 0 de inmediato, antes de que se borrara nada.
  - Cada test iniciaba sesión y superó el límite de inicios de sesión de Supabase Auth por IP: fallaron solo los últimos. Se usa una sesión de admin por trabajador, con un usuario propio (el test de cerrar sesión revoca todas las sesiones de `users.admin`).
- **Errores de la IA (no los detectó un test, salvo donde se indica):**
  - Un predicado de tipos inválido en uno de sus tests hacía fallar `tsc` y, por tanto, `next build`, aunque los 1597 unitarios pasaban; se vio al ejecutar `tsc` y se verificó en una copia antes de pedir permiso para corregirlo.
  - Su test de arquitectura escribía el nombre de la clave de servicio y rompía un test de la Fase 1 que limita en qué archivos puede aparecer; un comentario suyo en la vista previa tropezó con su propio test de arquitectura (nombraba las librerías de Markdown).
  - Un literal `{ __proto__: "x" }` no crea la clave, así que su test no probaba lo que decía; lo vio antes de enseñármelo.
  - En el Paso 4, su refactor quitó los `cn()` de tres botones y perdieron borde y tamaño: ningún test lo detecta, lo vieron las capturas.
- **Lo que confirmaron los tests de seguridad:** el CSRF funciona (el servidor registró «does not match `origin` header … Aborting the action» con el `Origin` falso); anónimo, no admin y sin perfil no modifican nada ni con una llamada directa; y dos publicaciones simultáneas no se pisan.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0015](adr/0015-mutaciones-del-panel-esquemas-estrictos-withadminaction-y-compensacion.md), aceptado por mí el 2026-11-03.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna. Se usan `alert-dialog` de `@base-ui/react`, ya instalado; las pestañas del editor se implementaron a mano con el patrón ARIA.
- **Desviación respecto al plan (si la hay) y motivo:** el panel vive en `app/admin/` y no en un grupo `(admin)` (`PLAN.md` §7), porque el `matcher` del proxy y la Fase 1 ya lo usan; ver la tabla "Desviaciones respecto al plan".
- **Paso 4 (refactor y estilo):** los ayudantes de resultado repetidos entre los dos servicios (`fail`, `invalid`, `guarded`), el tipo `Parsed` y los códigos de Postgres pasan a `lib/admin/result.ts`; las ocho acciones comparten `settleAndRevalidate`. El editor se divide en `EditorTabs` y `CategoryPicker`, y los estilos repetidos pasan a `components/admin/styles.ts`. Estilo de `docs/design.md`: títulos serif con un filo dorado decorativo, tarjetas, estado con icono y texto en una pastilla, diálogo de confirmación y objetivos de 44 px.
- **Resultado:** CRUD del panel completo y verificado con datos reales. Pendiente declarado: la portada y su texto alternativo, y el borrado de la imagen al eliminar una entrada (bloque 4), la paginación (límite de 50), el registro de eventos del admin y la protección contra la edición simultánea del contenido (Fase 3).
- **Tiempo aproximado:** no medido.

---

## 2026-11-04 · Fase 2 · Bloque 4: portada de las entradas (subida a Storage y texto alternativo)
- **Objetivo de la sesión:** subir la imagen de portada desde el editor (`cover_image_path` + texto alternativo obligatorio) a Supabase Storage, configurar `next/image` y el límite de las Server Actions, y mostrarla en el blog. Fuera de alcance: imágenes dentro del Markdown.
- **Lo que pedí a la IA (resumen):** subida por la Server Action con la sesión del admin (sin `service_role`), validación por contenido, nombre generado, compensación ante fallos parciales, limitación de subidas, nueva columna `cover_alt` y la lista de tests por nivel (unitarios, integración con Storage real, e2e con peticiones forjadas, A01, móvil, teclado y axe). Tests primero y un commit por ciclo tras mi aprobación.
- **Lo que generó la IA (en una frase):** `lib/storage/` (validador de JPEG/PNG/WebP sin librerías, subida y borrado, limitador), la migración `cover_alt`, la gestión de la portada en los servicios de crear, editar y eliminar, el campo de portada del editor, el marcador neutro y las tarjetas con imagen en el blog, y los tests de los tres niveles.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé los tests (`9ca82cd`) y la implementación (`c1ac980`), y después dos correcciones (`5c5f2dc`, `ec6548f`). Verde: 1803 unitarios, 215 de integración y 196 e2e (34 nuevos de portada).
- **Quién ejecutó qué:** la IA ejecutó unitarios, `tsc`, lint, `next build` en una copia y un arnés local con un Supabase en memoria y un navegador real; yo ejecuté la integración y los e2e contra el proyecto de test. Apliqué yo la migración en el proyecto de test.
- **Permisos que di para tocar tests aprobados:** `structure.test.ts` (columna `cover_alt`), `architecture.test.ts` del panel (`bodySizeLimit` de 3 MB), `components.test.ts`, `queries.test.ts` (`coverAlt: ""`), una expresión de `cover-field.test.ts` y la reescritura de la captura y el reenvío en `cover.spec.ts`.
- **Errores que detectaron los tests:**
  - 24 e2e fallaron dos veces seguidas. Mi primera hipótesis (un archivo vacío con nombre `""`) era solo una parte. Las causas reales, halladas con el arnés local: un campo de archivo sin elegir llega al servidor como `File` de 0 bytes con el nombre literal `"undefined"`; en el reenvío, un objeto de JavaScript pone la clave numérica `"0"` la primera y React no encuentra las partes (hay que usar un `FormData` ordenado); y `useActionState` reinicia los campos sin controlar tras cada envío, así que el archivo se guarda en una referencia.
  - La lectura pública rompía con un `cover_alt` nulo (`text()` lanzaba); ahora la lectura es tolerante, y el test aprobado de `queries` se ajustó con tu permiso.
  - Un e2e de «Mantener portada» falló una vez en escritorio y pasó 10 de 10 al repetirlo: intermitente, probablemente una carrera de hidratación bajo carga. No toqué el test; queda vigilado.
- **Errores de la IA:**
  - Ejecuté `pkill -f "next dev --port 3200"` y se mató a sí mismo mi propia terminal (código 144); lo correcto era `fuser -k 3200/tcp`.
  - Dos errores de `tsc` en mis tests: `new File([bytes])` con `Uint8Array<ArrayBufferLike>` y un `let offset = 8` con tipo literal.
  - Mis tests pasaban en vacío (`undefined === undefined`); añadí guardas que exigen que existan los mensajes.
  - Un test de arquitectura tropezó con el nombre de la clave de servicio; ahora se compone en tiempo de ejecución.
  - Olvidé advertir el orden de despliegue de la migración: `npm run dev` con `.env.local` mostró «Lectura no disponible» porque producción aún no tenía `cover_alt`.
  - El e2e de CSRF del bloque 3 pasaba en parte porque el cuerpo reenviado era nulo y Next rechazaba antes por el `Origin`; el reenvío con `FormData` de este bloque lo prueba de verdad.
- **Lo que confirmaron los tests de seguridad:** un SVG, un PNG dañado, un archivo vacío o de más de 2 MB se rechazan sin crear ni subir nada (también con peticiones forjadas, y el límite de 3 MB de Next corta lo grande); la acción de subida reenviada con la sesión de un usuario sin rol no sube nada; y `next/image` no sirve imágenes de otros hosts, proyectos, buckets ni con consulta.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0016](adr/0016-subida-de-la-portada-validacion-por-contenido-nombre-generado-y-compensacion.md), aceptado por mí el 2026-11-04. Sustituye en un punto al ADR 0015: ahora `bodySizeLimit` está definido (3 MB).
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna; la validación de imágenes es propia. Las imágenes de prueba reales se generaron con Pillow fuera del proyecto.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna respecto a `PLAN.md`. Se cierra la desviación del bloque 2 (`alt=""` provisional) con la columna `cover_alt`.
- **Paso 4 (refactor):** en `lib/admin/posts/service.ts` se nombra el tipo `InspectedCover`, se elimina el alias `discard` y el aviso por borrado fallido pasa a un solo ayudante (`removalWarning`) usado al editar y al eliminar. Sin cambios de comportamiento ni de tests.
- **Resultado:** portada completa y verificada con datos reales. Pendiente declarado: aplicar la migración `20261104000000_cover_alt.sql` en producción **antes** de desplegar (paso a añadir a la Fase 4), paginación (límite de 50), `img-src` con `blob:` en la CSP, registro de eventos del admin y MFA (Fase 3), y que el service worker no cachee blog ni panel.
- **Tiempo aproximado:** no medido.

---

## 2026-11-04 · Fase 2 · Bloque 5: imágenes dentro del contenido Markdown
- **Objetivo de la sesión:** insertar imágenes en el texto de una entrada desde el editor, reutilizando sin cambios la subida y las políticas del bloque 4, el editor del bloque 3 y el render sanitizado del bloque 2; evitar imágenes huérfanas y fallar cerrado.
- **Lo que pedí a la IA (resumen):** flujo del botón «Insertar imagen» con alt obligatorio, la opción más simple para las huérfanas y sus límites, y la lista de tests por nivel (alt obligatorio, reglas de archivo, A01, render A05 con payloads, responsivo, fallo simulado, móvil, teclado, axe y e2e en escritorio y móvil). Tests primero y un commit por ciclo tras mi aprobación.
- **Lo que generó la IA (en una frase):** una acción `uploadPostImage` con su servicio, la sintaxis y la inserción en el cursor (`lib/posts/content-images.ts`), la lógica del cliente que falla cerrado (`insertImage`), el componente `ImageInserter`, la limpieza de huérfanas al editar y eliminar, y los tests de los tres niveles.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé los tests (`d513c7b`, 36 unitarios en rojo y dos archivos que no compilaban) y la implementación (`5074af4`), más dos correcciones (`62993f2`, `7987c21`). Verde: 1990 unitarios, la integración completa y 228 e2e (32 nuevos).
- **Quién ejecutó qué:** la IA ejecutó unitarios, `tsc`, lint, `next build` en una copia y un arnés local con un Supabase en memoria y un navegador real (34 comprobaciones en escritorio y móvil); yo ejecuté la integración y los e2e contra el proyecto de test.
- **Permisos que di para tocar tests aprobados:** ampliar de ocho a nueve las acciones (`actions-authorization.test.ts`, `actions-revalidate.test.ts`, `support.ts`), los mocks de acciones (`components.test.ts`, `cover-field.test.ts`), el `LIKE` del Supabase falso, una línea de mi propio test del botón, la regex del aviso del inserter, y dos correcciones de mi `content-image.spec.ts`.
- **Errores que detectaron los tests:**
  - 15 e2e en rojo en el primer `npm run test:e2e`, tres causas:
    - 12 por un segundo `role="status"` que añadí en el editor: los tests aprobados usan `getByRole("status")` en singular. Lo corregí en la implementación (`aria-live="polite"`), no en esos tests.
    - 2 de mi propio e2e, que contaba filas con el diálogo abierto y pasaba antes de tiempo.
    - 1 por colisión de tamaños entre escritorio y móvil, que corren el mismo test a la vez.
  - Una segunda ejecución dio 1 fallo: restos de ejecuciones anteriores en el bucket de test. Mi e2e dejaba imágenes huérfanas y su aserción contaba archivos por tamaño.
- **Errores de la IA:**
  - Puse el módulo de sintaxis en `lib/markdown`, y dos tests de arquitectura aprobados lo impedían.
  - El Supabase falso trataba `%` de `LIKE` como «sin saltos de línea», distinto de Postgres: la guarda «otra entrada usa la imagen» fallaba con textos de varias líneas.
  - El esquema pedía la clave `image` siempre, y mi test del botón buscaba `disabled` en una clase de Tailwind.
  - **Repetí un error que ya estaba escrito en el ADR 0015** (con el diálogo abierto, un recuento de filas pasa en vacío) porque no releí lo documentado antes de escribir un test parecido.
- **Lo que confirmaron los tests de seguridad:** SVG, HTML, archivo dañado, vacío o de más de 2 MB no se suben ni escriben nada en el texto (también con peticiones forjadas, y el límite de 3 MB de Next corta lo grande); anónimo, usuario sin rol y Auth caído no suben nada (política del bucket incluida); y una imagen externa, `data:` o con `../` escrita a mano no se pinta ni en la vista previa ni en el blog, sin romper el resto del texto.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0017](adr/0017-imagenes-en-el-contenido-accion-de-subida-propia-y-limpieza-acotada-de-huerfanas.md), aceptado por mí el 2026-11-04.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna respecto a `PLAN.md`. `PLAN.md` §5 solo pedía borrar al eliminar una entrada o cambiar su portada; la limpieza se extiende a las imágenes del contenido (ver "Desviaciones respecto al plan").
- **Paso 4 (refactor y estilo):** una sola regla de «imagen del proyecto» (`projectImageName`) para el blog, la vista previa y la limpieza, y una sola definición del «archivo sin elegir» (`isUnselectedFile`). El estilo del bloque de inserción (fieldset, 44 px, errores y estado) se comprobó con capturas en escritorio y móvil y no necesitó cambios.
- **Resultado:** inserción de imágenes completa y verificada con datos reales. Pendiente declarado: las imágenes subidas y no guardadas quedan huérfanas, la paginación (límite de 50), `img-src` con `blob:` en la CSP, el registro de eventos del admin y MFA (Fase 3), y «migrar antes de desplegar» y `next build` en la CI (Fase 4).
- **Tiempo aproximado:** no medido.

---

## 2026-11-04 · Fase 2 · Pulido visual: identidad «noche y marfil» y menú en el acceso
- **Objetivo de la sesión:** que la web pública se vea más profesional, elegante y *premium*, sin tocar la lógica, las rutas ni los tests de seguridad, y que la página de acceso muestre el menú para volver al blog sin los botones del navegador.
- **Decisiones que tomé yo (tres preguntas del plan):** dirección **híbrido noche y marfil** (cabecera, héroe, bandas y pie en azul noche con dorado; lectura sobre marfil); alcance **web pública, login y 404/error** (el panel hereda tokens y no se rediseña); y **mantener Cormorant Garamond e Inter**. Pedí además la cabecera en el login, que el pie del login no lleve «Intranet» y, al final, que se actualizara `docs/design.md`.
- **Lo que generó la IA (en una frase):** un sistema de dos superficies por tokens (`data-surface="night"`), cabecera, pie, héroe, banda de título y adornos SVG propios, tarjetas y entrada rediseñadas, el menú en el acceso y los tests de contraste, superficies y navegación.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé los tests (`ab12ea9`): una prueba de contraste WCAG que lee `globals.css` (rojo hasta que existió la noche), tests de superficies y de la página de acceso, y un e2e de superficies, menú, 320 px, movimiento reducido y foco. Implementación en `1e9bc08`. Verde: 2049 unitarios y todos los e2e, que ejecuté yo.
- **Quién ejecutó qué:** la IA ejecutó unitarios, `tsc`, lint, `next build` en una copia y un arnés local con navegador real (axe sin violaciones en 7 pantallas más el resultado de la calculadora, en escritorio y móvil, y capturas revisadas a ojo); yo ejecuté los e2e contra el proyecto de test.
- **Permisos que di para tocar tests:** uno propio, el e2e del foco del anillo.
- **Errores que detectaron las pruebas o las capturas:**
  - El separador de las entradas usaba el glifo ✦ y salía como un triángulo diminuto: Cormorant no lo incluye. Lo vi en una captura, no en un test; ahora es un filete dorado degradado.
  - Mi e2e del foco leía los tres primeros números del `box-shadow`, pero Tailwind v4 escribe el anillo en `oklab(...)` y tras capas transparentes: falló en el arnés con un anillo que sí se veía. Ahora el navegador convierte el color con un canvas.
- **Errores de la IA:**
  - El arnés local no servía las lecturas públicas y las primeras capturas mostraron «Algo ha fallado»; lo identifiqué enseguida como una limitación del arnés (sustituí solo allí las consultas del blog por datos de ejemplo) y no como un fallo del diseño.
  - Un `?raw` sobre el CSS con `import.meta.glob` devolvía vacío: la prueba de paleta lee el archivo con `fs`.
  - Para el pie del acceso, la decisión se tomó con una pregunta mía; el test correspondiente lo añadí antes de commitear, con tu aprobación.
- **Paso 4 (refactor):** una sola definición del panel de tarjeta (`panelClass`) y de los anchos de contenedor (`container`) en `components/ui/surface-styles.ts`, y un `NightBand` común al héroe y a la banda de título. Se comprobó con capturas píxel a píxel antes y después: las 14 pantallas, idénticas.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0018](adr/0018-identidad-visual-noche-y-marfil-tokens-por-superficie-y-adornos-propios.md), aceptado por mí el 2026-11-04. Actualiza `docs/design.md`.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna. Los adornos son SVG y CSS propios y las fuentes siguen siendo las de `next/font`.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna respecto a `PLAN.md`; `docs/design.md` se modifica a petición mía (ver "Desviaciones respecto al plan").
- **Resultado:** web pública con identidad propia, accesible (contrastes comprobados por test), sin desbordes y con el acceso conectado al resto del sitio. Pendiente declarado: `theme_color` de la PWA (Fase 3), la CSP (Fase 3), y el pulido del panel de administración, que queda fuera de alcance.
- **Tiempo aproximado:** no medido.

---

## 2026-11-04 · Fase 3 · Sub-bloque A: cabeceras de seguridad y CSP (A02)
- **Objetivo de la sesión:** CSP sin `unsafe-inline` ni `unsafe-eval` en scripts (si Next lo permite), `img-src` limitado a `'self'` y al Storage, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS en producción y `X-Powered-By` desactivado, con tests de cabeceras reales y un e2e de violaciones de CSP.
- **Decisiones que tomé yo:** aprobé el plan (nonce por petición en `proxy.ts`, con la excepción de estilos como salida prevista) y elegí verificar la CSP de producción con un build local en vez de añadir un script e2e de producción.
- **Lo que generó la IA (en una frase):** `lib/security/csp.ts` y `headers.ts` (puros), el proxy con nonce en todas las páginas conservando la autorización de `/admin`, las cabeceras estáticas en `next.config.ts` y `force-dynamic` en el layout raíz.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé los tests (`6842f94`): política y nonce, cabeceras, proxy en rutas públicas y `/admin` con fallo cerrado, matcher y e2e de cabeceras reales y de violaciones de CSP. Implementación en `0479a45`, con dos tests míos más (`968cd3c`). Verde: 2152 unitarios y 292 e2e, que ejecuté yo.
- **Quién ejecutó qué:** la IA ejecutó unitarios, `tsc`, lint, `next build` y `next start` en una copia con navegador real (escritorio y móvil, sin violaciones de CSP); yo ejecuté los e2e contra el proyecto de test.
- **Permisos que di para tocar tests:** ninguno; no se cambió ningún test aprobado.
- **Errores que detectó la comprobación del build real (no el e2e, que usa `next dev`):**
  - `/compatibilidad`, el 404 y dos páginas de `/admin` salían prerenderizadas, así que sus scripts no recibían nonce; en producción el navegador los habría bloqueado y la calculadora no habría funcionado. Corregido con `force-dynamic` en el layout raíz y un test que lo exige.
  - `next/image` escribe `style="color:transparent"` y `style-src` con nonce lo bloqueaba. Se añadió `style-src-attr 'unsafe-inline'`, la excepción que el plan ya preveía, y un test que fija que es la única.
- **Errores de la IA:**
  - Un test de arquitectura mío contenía la cadena «service_role» y rompía el test aprobado que lista dónde puede aparecer; lo corregí en el mío.
  - Para el e2e de la intranet no incluí la subida real de una imagen (dejaría archivos huérfanos en Storage); lo declaré como desviación del plan de tests y la vista previa `blob:` cubre la parte de CSP.
  - El arnés local estaba desactualizado (firmas de las consultas y un `playwright.config.ts` suelto) y tuve que sincronizarlo antes de poder construir.
- **Paso 4 (refactor):** sin cambios; los módulos son pequeños y puros y el proxy ya separa `withCsp`, `secured` y la autorización.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0019](adr/0019-csp-con-nonce-por-peticion-excepcion-de-estilos-en-atributos-y-cabeceras-estaticas.md), aceptado por mí el 2026-11-04 al aprobar esta entrada.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna respecto a `PLAN.md`; todas las páginas pasan a ser dinámicas (ver "Desviaciones respecto al plan").
- **Resultado:** CSP estricta con nonce, cabeceras estáticas y HSTS en producción, comprobadas en un navegador real sin violaciones. Pendiente declarado: la política estricta de producción no está automatizada en la CI (el `next build` en la CI y ZAP la cubrirán en las fases 3 E y 4), no hay `report-uri` (el registro de eventos llega con A09) y `preload` de HSTS queda para cuando se decida el dominio.
- **Tiempo aproximado:** no medido.

## 2026-11-04 · Fase 3 · Sub-bloque B: límites, registro de eventos y fallo cerrado (A07, A09, A10)
- **Objetivo de la sesión:** límite de intentos en el login y en la calculadora, registro de eventos de seguridad (login fallido o correcto, acceso denegado, subida rechazada) sin datos personales, contraseñas ni fechas, y tests de fallo cerrado.
- **Decisiones que tomé yo:** el Paso 1 mostró que los límites y el fallo cerrado ya existían y estaban probados, así que el bloque se centró en el registro (A09). Elegí identificar al cliente con un **hash por instancia**, **no** registrar las acciones del admin (solo mi lista) y permitir `console` solo en `lib/security/log.ts` (cambio de un test mío de arquitectura, con mi permiso).
- **Lo que generó la IA (en una frase):** `lib/security/` (eventos con lista blanca, identificador de cliente y registro que nunca lanza), las llamadas de registro en login, proxy, capa 2, subidas y calculadora, y el helper `recordAccessDenied`.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé los tests (`a2f54be`): eventos, lista blanca, identificador, destino, eventos por punto, recuperación tras la ventana, barrido de fugas y arquitectura. Implementación en `fdf8156`. Verde: 2251 unitarios, y todos los de integración y e2e, que ejecuté yo.
- **Quién ejecutó qué:** la IA ejecutó unitarios, `tsc`, lint y un `next build` + `next start` con navegador real (seis intentos de login: cinco `login_failed` y un `rate_limited`, sin correo, contraseña, IP ni consulta de la URL); yo ejecuté los de integración y los e2e contra el proyecto de test.
- **Permisos que di para tocar tests:** solo el test de arquitectura de `lib/security` (mío, de A).
- **Errores de la IA:**
  - Olvidé el import de `recordSecurityEvent` en `service.ts`; `tsc` y 29 tests lo detectaron antes de dar nada por bueno.
  - Pedí los e2e pero no los de integración, y tuve que corregirlo cuando lo preguntaste: el cambio toca `performLogin` y `inspectCover`, que esas pruebas usan contra Supabase de test.
  - Dejé el mapeo decisión → motivo de `access_denied` duplicado en el proxy y la capa 2; se detectó al revisar y se extrajo en el Paso 4.
- **Desviación del plan de tests:** quité el e2e del registro (Playwright no expone la salida del servidor y capturarla exigía tocar `playwright.config.ts`) y quité el ámbito `upload` de `rate_limited` (un cupo agotado se registra solo como `upload_rejected/rate_limited`). Lo cubrí con el build real a mano.
- **Hallazgo:** el barrido de fallo cerrado (A10) pasó en verde desde el primer momento: confirma que esa parte ya estaba bien cubierta desde los bloques anteriores.
- **Paso 4 (refactor):** `lib/auth/access-denied.ts` es ahora el único sitio que traduce una decisión de autorización en un evento `access_denied`.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0020](adr/0020-registro-de-eventos-de-seguridad-sin-datos-personales-limites-en-serverless-y-fallo-cerrado.md), aceptado por mí el 2026-11-04 al aprobar esta entrada. Incluye la tabla de qué generaría una alerta y los límites en serverless.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna; solo `node:crypto`.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna respecto a `PLAN.md`; las acciones del admin quedan fuera por decisión mía (ver "Desviaciones respecto al plan").
- **Resultado:** registro de eventos de seguridad estructurado y sin datos personales en los cinco puntos acordados, límites documentados para serverless y fallo cerrado verificado en las 9 acciones del panel. Pendiente declarado: las acciones del admin no se registran, no hay alertas automáticas ni retención definida, el identificador de cliente es por instancia y MFA sigue sin hacerse.
- **Tiempo aproximado:** no medido.

## 2026-11-04 · Fase 3 · Sub-bloque C: auditoría de dependencias y cadena de suministro (A03)
- **Objetivo de la sesión:** `npm ci` y `npm audit`, revisión de las dependencias (nombre exacto, mantenimiento y licencia), lista para el ai-log y propuestas de actualización sin aplicarlas a ciegas.
- **Decisiones que tomé yo:** mover `shadcn` a `devDependencies`, añadir Dependabot (versiones agrupadas; las actualizaciones de seguridad las activo yo en GitHub) y **solo proponer** las actualizaciones de parche.
- **Lo que generó la IA (en una frase):** la auditoría con datos reales (`npm audit`, `npm outdated`, `npm view`, licencias y scripts de instalación del lockfile), un test de cadena de suministro, el cambio de ámbito de `shadcn`, `dependabot.yml` y el paso de la CI.
- **Test escrito/aprobado antes de implementar:** sí. Aprobé los tests (`c2b43f3`): 22 tests que leen `package.json`, el lockfile, `.npmrc` y `.github/` (7 en rojo: ámbito de `shadcn`, Dependabot y CI; 15 fijan lo que ya se cumplía). Implementación en `687f19d`. Verde: 2273 unitarios.
- **Quién ejecutó qué:** la IA ejecutó el test, `tsc`, lint y, en una copia limpia sin `node_modules`, `npm ci`, `npm audit` y `next build`; la CI repite `npm ci` y los dos `npm audit`.
- **Permisos que di para tocar tests:** ninguno.
- **Resultado de `npm audit`:**
  - Completo: 0 críticas y 0 altas; 19 moderadas y 2 bajas, todas en herramientas de desarrollo; npm solo ofrece como arreglo un retroceso de `eslint` a la versión 4, que no se aplica.
  - `--omit=dev`: de 6 avisos (4 moderados y 2 bajos, todos por `shadcn`) a **0**.
- **Revisión de las dependencias de producción (14):**

| Paquete (exacto) | Licencia | Último cambio | Observación |
|---|---|---|---|
| `@base-ui/react` 1.9.0 | MIT | 2026-10-09 | Primitivas de UI (equipo MUI) |
| `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0 | MIT | activo | Oficiales; hay 2.119.0 |
| `class-variance-authority` 0.7.1 | Apache-2.0 | 2024-11 | Estable y pequeña; sin cambios en un año, sin avisos |
| **`cn` 0.5.2** | MIT | 2026-11-02 | Paquete correcto (`shadcn-ui/cn`, mantenedor `shadcn`, sin dependencias ni scripts). **Riesgo anotado:** el nombre existía desde 2013 y se reutilizó desde la 0.2.0 (2026-09-01), 17 versiones en dos meses, aún 0.x. Se mantiene fijado |
| `lucide-react` 1.66.0 | ISC | 2026-11-04 | Hay 1.68.0 |
| `next` 16.4.4, `react` y `react-dom` 19.3.0 | MIT | activo | Hay parches (16.4.5 y 19.3.1) |
| `react-markdown` 10.1.0, `rehype-sanitize` 6.0.0 | MIT | 2025-03 · 2023-11 | Colectivo `unified`; estables |
| `tw-animate-css` 1.4.0 | MIT | 2026-02 | Utilidades CSS |
| `zod` 4.6.7 | MIT | 2026-10-12 | Validación |
| ~~`shadcn` 4.23.0~~ | MIT | 2026-10-27 | **Movida a desarrollo** (solo aporta CSS al compilar) |

- **Actualizaciones propuestas (no aplicadas):** `next` y `eslint-config-next` 16.4.5, `react` y `react-dom` 19.3.1, `@supabase/supabase-js` 2.119.0, `tailwindcss` y `@tailwindcss/turbopack` 4.3.4, `lucide-react` 1.68.0. No pude leer sus notas de versión, así que no afirmo que corrijan nada. No se proponen `eslint` 10, `@types/node` 26 ni `typescript` 7.
- **Errores de la IA:**
  - Al regenerar el lockfile, npm añadió 6 entradas empaquetadas de `@tailwindcss/oxide-wasm32-wasi` sin `integrity`; me di cuenta al comparar el antes y el después y las quité para dejar solo el cambio de ámbito (habrían roto mi propio test de integridad).
  - Mi `npm audit` inicial listaba el árbol completo; hasta ejecutar `--omit=dev` no vi que los 6 avisos de producción venían de un solo paquete.
- **Paso 4 (refactor):** ninguno; solo se tocó configuración.
- **Decisión de arquitectura tomada (enlace al ADR si existe):** [ADR 0021](adr/0021-cadena-de-suministro-versiones-exactas-lista-de-dependencias-revisadas-y-auditoria-en-la-ci.md), aceptado por mí el 2026-11-04 al aprobar esta entrada.
- **Dependencias nuevas (nombre y comprobación de que es el paquete correcto):** ninguna. `shadcn` cambia de ámbito, sin cambiar de versión.
- **Desviación respecto al plan (si la hay) y motivo:** ninguna respecto a `PLAN.md`; Dependabot se añade tal como pide §5 y la CI gana un paso (ver "Desviaciones respecto al plan").
- **Resultado:** árbol de producción sin avisos, Dependabot configurado, auditoría de producción en la CI y una lista de dependencias revisadas que fuerza la revisión de cualquier paquete nuevo. Pendiente declarado: activar las actualizaciones de seguridad de Dependabot, decidir sobre `cn`, aplicar los parches si hay margen antes del despliegue y fijar las acciones de GitHub por hash (hoy van por versión mayor).
- **Tiempo aproximado:** no medido.

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
| 2026-11-02 | `shadcn` 4.23.0 | CLI como dependencia de ejecución, porque `app/globals.css` importa `shadcn/tailwind.css` (commit `b096433`) | `shadcn-ui/ui`, MIT. Arrastra `@shadcn/registry` y `deepmerge`: 5 avisos nuevos en `npm audit` (2 bajos y 3 moderados). **Movida a `devDependencies` el 2026-11-04** (sub-bloque C, [ADR 0021](adr/0021-cadena-de-suministro-versiones-exactas-lista-de-dependencias-revisadas-y-auditoria-en-la-ci.md)): `npm audit --omit=dev` pasa a 0 |
| 2026-11-02 | `zod` 4.6.7 | Validación de la fecha de nacimiento en `lib/astrology/birth-date.ts` (Fase 1, bloque 2) | `colinhacks/zod`, MIT, sin dependencias propias. Versión exacta; `npm audit` sin cambios (0 altas) |
| 2026-11-02 | `@axe-core/playwright` 4.14.0, `axe-core` 4.14.0 | Tests de accesibilidad en `/login` (Fase 1, bloque 4); solo de desarrollo | `dequelabs/axe-core-npm`, MPL-2.0 (ambas), versión exacta. `@axe-core/playwright` pide `playwright-core >= 1` y trae `axe-core ~4.14.0` |
| 2026-11-03 | `react-markdown` 10.1.0 | Convierte el Markdown de las entradas en elementos de React, sin HTML crudo (Fase 2, bloque 2) | `remarkjs/react-markdown`, MIT; mantenedores `wooorm`, `johno` y `remcohaszing`. Nombre y repositorio verificados con `npm view`. Versión exacta; peers `react >=18` |
| 2026-11-03 | `rehype-sanitize` 6.0.0 | Lista blanca explícita sobre el árbol del Markdown (Fase 2, bloque 2) | `rehypejs/rehype-sanitize`, MIT; mantenedores `wooorm` y `kmck`. Verificado con `npm view`. Versión exacta. Las dos arrastran 80 paquetes transitivos (79 MIT y 1 ISC) del ecosistema `unified`, sin scripts de instalación; `npm audit` sin cambios (21, 0 altas) |
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
| 2026-11-03 | Esquema de producción aplicado antes de la Fase 4 | Para usar la intranet en local; el login fallaba porque no existía `profiles` | Aplicadas a mano las 3 migraciones (sin la utilidad de test), registro desactivado y primer admin creado por SQL. Pendiente: despliegue en Vercel |
| 2026-11-03 | La entrada vive en `/blog/[slug]` y la categoría en `/categorias/[slug]`, no en `/posts/[slug]` | Lo pedí así al encargar el bloque; `PLAN.md` §7 decía `/posts` y no se modifica | Ninguno funcional; sin grupo de rutas `(public)` |
| 2026-11-03 | Las portadas llevan `alt=""` y la entrada destacada no muestra extracto | `posts` no tiene columna de texto alternativo ni los datos de las tarjetas llevan extracto; añadirlos cambia el esquema y tests ya aprobados | Se resuelve en el bloque de subida de imágenes (`cover_alt` obligatorio) |
| 2026-11-03 | El e2e comprueba que el servidor está listo en `/login` y no en `/` | La portada lee la base de datos y sin Supabase no responde 200 | Ninguno con el proyecto de test conectado |
| 2026-11-02 | El `smoke` e2e usa el puerto 3100 y `npm run test:e2e` exige `.env.test.local` | Para que los e2e no reutilicen un servidor levantado con `.env.local` (producción) | Hay que parar el `npm run dev` antes de ejecutar los e2e |
| 2026-11-03 | El panel vive en `app/admin/` y no en un grupo `(admin)` | El `matcher` del proxy y la Fase 1 ya usan `/admin`; `PLAN.md` §7 es orientativo y no se modifica | Ninguno funcional |
| 2026-11-03 | El `h1` de `/admin` es «Panel de administración» y no «Entradas» | Un test aprobado de la Fase 1 lo espera; prefiero no tocarlo | Ninguno; mi página y mi spec se ajustaron |
| 2026-11-03 | Sin campo de extracto en el formulario y sin paginación del listado (máximo 50) | `posts` no tiene esa columna y el plan del bloque lo decidió así; el blog deriva el extracto del contenido | Ninguno; el borrado de la portada de Storage al eliminar una entrada queda para el bloque 4 |
| 2026-11-03 | Los e2e del panel usan una sesión de admin por trabajador, con un usuario propio | Supabase Auth limita los inicios de sesión por IP y el test de cerrar sesión revoca las de `users.admin` | Ninguno en producción |
| 2026-11-04 | `serverActions.bodySizeLimit` pasa a 3 MB (el ADR 0015 decía que no se definía) | El valor por defecto (1 MB) impide subir una portada válida de 2 MiB | Global a todas las acciones; el límite real lo aplican la validación y el bucket. Test de arquitectura ajustado con permiso |
| 2026-11-04 | La migración de `cover_alt` debe aplicarse en producción antes de desplegar | La lectura pública falla cerrada si falta la columna | Pendiente: aplicarla al cerrar el bloque y añadir «migrar antes de desplegar» a la Fase 4 |
| 2026-11-04 | La limpieza de imágenes huérfanas se extiende a las del contenido (`PLAN.md` §5 solo citaba borrar la entrada y cambiar la portada) | Las imágenes insertadas en el texto son archivos de la entrada y quedarían sin dueño | Se borran al eliminar la entrada y al quitarlas del texto al guardar, salvo que otra entrada las use; las subidas y no guardadas quedan huérfanas (ADR 0017) |
| 2026-11-04 | Las Server Actions del panel pasan de ocho a nueve (`uploadPostImage`) | La subida de una imagen del contenido necesita una acción propia que no escribe en la base de datos | Tests que enumeran las acciones ampliados con permiso; la subida no invalida la caché (ADR 0017) |
| 2026-11-04 | El pulido visual se hace en un bloque propio y con cambio de paleta, no «al final y con el estilo mínimo» | Lo pedí yo: más aspecto profesional y premium | `docs/design.md` actualizado (paleta de dos superficies, tipografía, wireframes y `theme_color`) y [ADR 0018](adr/0018-identidad-visual-noche-y-marfil-tokens-por-superficie-y-adornos-propios.md); el panel no se rediseña |
| 2026-11-04 | La página de acceso muestra la cabecera y el pie del sitio (sin «Intranet») | No había forma de volver al blog sin los botones del navegador; `design.md` §6 bis exige navegación siempre visible | Tests nuevos de la página de acceso; el resto de sus tests no cambia |
| 2026-11-04 | Todas las páginas pasan a renderizarse en cada petición (`force-dynamic` en el layout raíz), no solo las del blog | Un nonce de CSP distinto en cada petición solo se puede aplicar al renderizar; las páginas prerenderizadas se quedaban sin nonce y sus scripts se bloqueaban | Sin páginas estáticas ni CDN (ya eran dinámicas casi todas); un test lo exige; [ADR 0019](adr/0019-csp-con-nonce-por-peticion-excepcion-de-estilos-en-atributos-y-cabeceras-estaticas.md) |
| 2026-11-04 | La CSP admite `style-src-attr 'unsafe-inline'` | `next/image` escribe estilos en atributos que `style-src` con nonce bloquea | Excepción acotada a atributos `style`, prevista en el plan de A y fijada por un test |
| 2026-11-04 | El registro de eventos (A09) no incluye las acciones del admin que cita `PLAN.md` §5 | Lo decidí yo: solo login, acceso denegado, subida rechazada y límite de la calculadora | Pendiente declarado en el [ADR 0020](adr/0020-registro-de-eventos-de-seguridad-sin-datos-personales-limites-en-serverless-y-fallo-cerrado.md) |
| 2026-11-04 | `shadcn` pasa de `dependencies` a `devDependencies` y la CI gana `npm audit --omit=dev` | Lo decidí yo: en ejecución solo se usa su CSS, y arrastraba los 6 avisos de producción | `npm audit --omit=dev` = 0; [ADR 0021](adr/0021-cadena-de-suministro-versiones-exactas-lista-de-dependencias-revisadas-y-auditoria-en-la-ci.md) |
| 2026-11-04 | Se añade `.github/dependabot.yml` (que `PLAN.md` §5 cita pero no existía) | Lo decidí yo: agrupado y con una PR abierta como máximo; las actualizaciones de seguridad las activo yo en GitHub | Un test lo vigila |
| 2026-11-04 | Los límites de intentos no se rehacen en el sub-bloque B | Ya existían y estaban probados desde los bloques 4 de la Fase 1, 1 y 4 de la Fase 2; solo se añadieron los tests de recuperación y el registro | Los límites en serverless se documentan en el ADR 0020 |

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
| Un error sin pistas | Preguntar si era un fallo o algo pendiente y pedir consultas SQL de solo lectura para distinguirlo | Funcionó: una sola consulta (`to_regclass`) separó "login roto" de "base de datos vacía" sin tocar nada | Con mensajes de error genéricos a propósito, pedir un diagnóstico de solo lectura antes de cambiar nada |
| Un fallo que nadie sabe explicar | Pedir un diagnóstico que imprima datos (estado HTTP, tipo, tamaño, momento) en vez de adivinar, y reproducirlo antes en un navegador | Funcionó: se descartaron tres hipótesis y se encontró el `srcset` con `naturalWidth` | Comprobar la medida del test antes de culpar a la aplicación |
| Verificación incompleta | Ejecutar `next build` y no solo `tsc`, los tests y el lint | Destapó un fallo del bloque 4 que habría roto el despliegue (`/admin`) | Incluir `next build` en cada cierre de bloque, y proponerlo en la CI |
| Probar sin tus datos | Montar una página de vista previa temporal con datos de ejemplo y medirla en un navegador real | Funcionó para el estilo: axe, desbordamiento, 44 px y capturas antes de pedirte los e2e | Borrar siempre los archivos temporales y la caché `.next` |
| Decisiones abiertas del plan | Preguntar, antes de implementar, las cuatro cuestiones que el código y `PLAN.md` no resolvían (extracto, atomicidad, borrar categorías con entradas, slug publicado) | Funcionó: una de las respuestas (slug bloqueado) añadió una regla nueva y sus tests desde el principio | Preguntar siempre lo que cambia el diseño, con una recomendación, y no decidirlo en silencio |
| Muchos fallos de golpe | Pegar la salida completa de los e2e (12 fallos) y pedir agruparlos por causa antes de arreglar nada | Funcionó: eran 5 causas, dos de ellas errores de mis tests y no de la aplicación | Diagnosticar por causas y pedir permiso para tocar tests aprobados con la lista exacta de líneas |
| Estilo sin ver la pantalla | Montar las pantallas del panel con datos de ejemplo en una copia aislada y sacar capturas en escritorio y móvil | Destapó un fallo del refactor que ningún test detectaba (botones sin `cn`) | Mirar siempre las capturas antes de dar el estilo por bueno |
| Fallos e2e que no se explican | Construir un arnés local (Supabase en memoria + navegador real) y registrar lo que llega al servidor en lugar de seguir con hipótesis | Funcionó: 3 causas reales que mi hipótesis inicial no vio (nombre `"undefined"`, orden del `FormData`, reinicio de campos) | Reproducir antes de corregir; una hipótesis que no cambia el resultado no era la causa |
| Lecciones ya escritas | Pedir que, antes de escribir un test parecido a otro que ya dio problemas, se relea el ADR y el ai-log del bloque anterior | Habría evitado repetir el recuento de filas con el diálogo abierto (ya estaba en el ADR 0015) | Releer lo documentado antes de escribir tests de la misma familia |
| Diseño con tests | Convertir el contraste en un test: leer los tokens de `globals.css` y aplicar la fórmula de WCAG a cada par, en las dos superficies | Funcionó: rojo hasta que existió la noche, y fija la paleta sin discutir «a ojo» | Cuando el criterio es medible (contraste, anchos, 44 px), escribirlo como test antes de diseñar |
| Mirar el resultado | Capturas en escritorio y móvil con datos de ejemplo, y comparar píxel a píxel antes y después de un refactor | Destapó el glifo ✦ que ningún test detectaba y confirmó que el refactor no cambió nada | Mirar siempre las capturas y comparar antes/después en refactors visuales |
| Verificación en producción | Probar el build real (`next build` + `next start`) con un navegador y contar los `securitypolicyviolation` | Destapó dos fallos que el e2e en `next dev` no puede ver (páginas estáticas sin nonce y estilos de `next/image`) | Cuando la configuración cambia entre desarrollo y producción, probar el build real antes de dar el bloque por bueno |
| Qué ejecuta quién | Al pedir la verificación, listar todos los comandos que debe ejecutar el humano (unitarios, integración y e2e) y por qué | Faltó pedir los de integración y lo preguntaste tú | Decir siempre qué suites toca el cambio, con su comando, antes de pedir el visto bueno |
| Auditar con datos | Ejecutar `npm audit` completo y con `--omit=dev`, `npm outdated`, `npm view` y leer licencias y scripts del lockfile antes de proponer nada | Destapó que los 6 avisos de producción venían de un solo paquete (`shadcn`) y que el arreglo que ofrecía npm era un retroceso | Separar siempre producción y desarrollo al auditar, y comparar el lockfile antes y después de regenerarlo |

## Resumen final para la memoria (se completa al terminar)

- **Qué hizo la IA bien:**
- **Dónde falló o necesitó corrección:**
- **Qué aportó el humano como arquitecto:**
- **Qué aportó el humano como tester:**
- **Qué haría diferente la próxima vez:**
