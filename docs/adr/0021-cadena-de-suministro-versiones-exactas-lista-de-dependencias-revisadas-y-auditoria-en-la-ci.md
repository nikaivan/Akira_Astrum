# ADR 0021: Cadena de suministro: versiones exactas, lista de dependencias revisadas y auditoría en la CI

- **Estado:** Aceptado (2026-11-04)
- **Fecha:** 2026-11-04

## Contexto
`PLAN.md` §5 (A03) pide `npm audit`, Dependabot, lockfile con versiones fijadas, `npm ci` en la CI, revisión manual de cada dependencia (el nombre exacto del paquete, porque la IA puede sugerir uno parecido al real) y ningún script de terceros innecesario. La base ya cumplía casi todo (`save-exact=true`, lockfile v3, `npm ci` y `npm audit --audit-level=high` en la CI). Mi encargo para este sub-bloque fue auditar y **proponer, sin actualizar versiones a ciegas**. Decidí yo: mover `shadcn` a desarrollo, añadir Dependabot y solo proponer las actualizaciones.

## Estado medido antes del cambio
- 763 paquetes en el lockfile, todos con `integrity` y `resolved` en `registry.npmjs.org`; ninguno de git, URL o ruta local; el único con script de instalación es `fsevents` (opcional, macOS).
- `npm audit`: 0 críticas, 0 altas, 19 moderadas y 2 bajas, todas en la cadena de herramientas de desarrollo. La «corrección» que ofrece npm (`eslint-config-next@0.2.4`, `eslint@4`) es un retroceso, no una solución.
- `npm audit --omit=dev` (lo que se despliega): 4 moderadas y 2 bajas, **todas por `shadcn`**, que estaba en `dependencies`: `deepmerge` (GHSA-gcqx-w48m-w2h4, baja) y `minimatch` (GHSA-g3hv-75wg-m249, moderada), vía `@shadcn/registry`, `ts-morph` y `@ts-morph/common`. En ejecución solo se usa `shadcn/tailwind.css`, que se empaqueta al compilar; el CLI no se ejecuta en producción.

## Decisión
- **`shadcn` pasa a `devDependencies`**, sin cambiar de versión. `npm audit --omit=dev` queda en **0**. Se comprobó en una copia limpia (`npm ci` desde cero, `next build` con las 11 rutas compiladas). Vercel instala las dependencias de desarrollo para compilar, así que el despliegue no cambia. Al regenerar el lockfile, npm añadió por su cuenta 6 entradas empaquetadas de `@tailwindcss/oxide-wasm32-wasi` sin `integrity`; se descartaron para dejar solo el cambio de ámbito (230 paquetes pasan a ser de desarrollo, ninguna versión cambia).
- **Lista de dependencias revisadas, vigilada por un test** (`tests/unit/supply-chain/dependencies.test.ts`): las dependencias directas de producción y de desarrollo tienen que coincidir exactamente con una lista del propio test (nombre exacto, ámbito y motivo). Una dependencia nueva rompe el test hasta que alguien la revise. El mismo test fija versiones exactas, lockfile íntegro, ausencia de scripts de instalación salvo `fsevents`, y las licencias.
- **Licencias:** ninguna GPL ni AGPL en ningún árbol; la **LGPL-3.0 solo aparece en los binarios opcionales `@img/sharp-*`** (`libvips`, que trae `next/image`; se enlazan dinámicamente y solo se instala el de la plataforma); MPL-2.0 (`axe-core`), Python-2.0 (`argparse`) y CC0 solo en el árbol de desarrollo; `caniuse-lite` es CC-BY-4.0 (datos).
- **`cn` 0.5.2 se mantiene, fijado y anotado como riesgo.** Es el paquete correcto (repositorio `shadcn-ui/cn`, único mantenedor `shadcn`, MIT, sin dependencias ni scripts de instalación; solo un `bin`, `cn build`, que no se ejecuta). Pero el nombre existía desde 2013 (2 versiones) y se reutilizó desde la 0.2.0 (2026-09-01): 17 versiones en dos meses y aún 0.x. Lo importan solo `lib/utils.ts` y `components/ui/button.tsx`; sustituirlo por `clsx` + `tailwind-merge` (2.1.1 y 3.7.0) sería un cambio de dos archivos si se decide evitar un paquete tan joven.
- **Dependabot (`.github/dependabot.yml`):** `npm` y `github-actions`, semanal, versiones agrupadas en una sola PR por ecosistema y una PR abierta como máximo. El archivo **no restringe a seguridad**: las actualizaciones de seguridad se activan en Settings → Code security del repositorio.
- **CI:** nuevo paso `npm audit --omit=dev` (cualquier aviso en producción, también los moderados, rompe la CI). El `--audit-level=high` sobre todo el árbol se mantiene.
- **No se aplica `npm audit fix`** ni `--force`: retrocedería `eslint` y `eslint-config-next` a versiones de hace años.

## Avisos aceptados (solo desarrollo)
19 moderadas y 2 bajas en la cadena de lint y de herramientas (eslint, typescript-eslint, eslint-config-next, `shadcn` y sus dependencias): no se empaquetan ni se ejecutan en producción, solo procesan el código del propio repositorio. Se reevaluarán cuando salga una versión de `eslint-config-next` que las corrija.

## Actualizaciones propuestas (no aplicadas)
Parches disponibles: `next` y `eslint-config-next` 16.4.5, `react` y `react-dom` 19.3.1, `@supabase/supabase-js` 2.119.0, `tailwindcss` y `@tailwindcss/turbopack` 4.3.4, `lucide-react` 1.68.0. No se pudieron leer sus notas de versión, así que no se afirma que corrijan ningún aviso, y a cuatro días de la entrega se decidió no mover la base. Saltos mayores que no se proponen: `eslint` 10, `@types/node` 26 y `typescript` 7.

## Consecuencias
- **Pruebas:** 22 tests nuevos de cadena de suministro (15 fijan lo que ya se cumplía; 7 estaban en rojo hasta el cambio) y la verificación de red hecha a mano (`npm ci`, `npm audit`, `next build` en copia limpia), que la CI repite.
- **Límites:** las acciones de GitHub se fijan a la versión mayor (`@v4`), no a un hash de commit; Dependabot las mantendrá al día, pero un tag movido por un tercero no se detectaría. No hay comprobación automática de que los nombres de paquete sean los oficiales: la revisión es manual y la lista del test obliga a hacerla.
- **Pendiente:** activar las actualizaciones de seguridad de Dependabot (a cargo del usuario), decidir sobre `cn` y aplicar los parches antes del despliegue si hay margen.
- **Quien añada una dependencia** debe comprobar el nombre con `npm view`, el repositorio, la licencia y el mantenimiento, añadirla a la lista del test y anotarla en `docs/ai-log.md`.
- **Lecciones:** la mayoría de los avisos de producción venían de una herramienta de línea de comandos instalada como dependencia de ejecución; el ámbito de cada paquete importa tanto como su versión. Y regenerar el lockfile con npm puede añadir entradas ajenas al cambio: conviene comparar el antes y el después.
- Relacionado: ADR 0013 (Markdown sanitizado), ADR 0018 (fuentes y estilos) y ADR 0019 (CSP).
