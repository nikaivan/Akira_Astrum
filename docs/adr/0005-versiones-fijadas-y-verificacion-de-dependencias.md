# ADR 0005: Versiones fijas y verificación de cada dependencia

- **Estado:** Propuesto (borrador para revisión)
- **Fecha:** 2026-11-02

## Contexto
La cadena de suministro es un riesgo (A03). Una IA puede sugerir nombres de paquete parecidos a los reales.

## Decisión
- `.npmrc` con `save-exact=true`: sin `^` ni `~`; el lockfile se commitea y la CI usa `npm ci`.
- Antes de instalar, `npm view` confirma que existe el paquete, su repositorio oficial, la licencia y los peer dependencies. Sin `--force` ni `--legacy-peer-deps`.
- Cada dependencia nueva se anota en `docs/ai-log.md`.
- La CI ejecuta `npm audit --audit-level=high`. Las vulnerabilidades moderadas solo en herramientas de desarrollo se aceptan y se documentan.

## Consecuencias
- Las actualizaciones son deliberadas (Dependabot propone, el humano revisa).
- Casos reales de esta fase: `@types/node` se subió a 22 porque Vitest 5.1.0 lo exige, y `@tailwindcss/turbopack` se verificó como paquete oficial de Tailwind Labs.
