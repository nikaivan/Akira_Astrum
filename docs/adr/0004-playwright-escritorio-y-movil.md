# ADR 0004: Playwright con proyectos de escritorio y móvil emulado

- **Estado:** Propuesto (borrador para revisión)
- **Fecha:** 2026-11-02

## Contexto
La aplicación debe ser responsive, móvil primero e instalable (`docs/design.md` §6). Comprobar el móvil al final suele llegar tarde.

## Decisión
Playwright con dos proyectos desde el principio: `desktop` (Desktop Chrome) y `mobile` (Pixel 7 emulado). Todo e2e se ejecuta en ambos. Los e2e viven en `tests/e2e/` y se lanzan con `npm run test:e2e`, separados de `npm test` (Vitest). La ruta del navegador puede fijarse con `PLAYWRIGHT_CHROMIUM_PATH`, solo para entornos con un Chromium preinstalado de otra revisión.

## Consecuencias
- Cada e2e se ejecuta dos veces; se mantienen pocos y centrados en flujos críticos.
- La emulación no sustituye una prueba en un móvil real, que se hace en la Fase 3 (PWA).
