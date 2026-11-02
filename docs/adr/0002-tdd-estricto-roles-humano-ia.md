# ADR 0002: TDD estricto y reparto de roles humano-IA

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
La IA implementa y el humano es arquitecto y tester. Hace falta evidencia de que el código generado es correcto y de que las decisiones son del humano.

## Decisión
Ciclo rojo-verde-refactor por tarea (`PLAN.md` §3). El humano define los criterios de aceptación y aprueba cada test antes de implementar. La IA no modifica un test para que pase sin aprobación expresa. Un commit pequeño por paso, solo tras la aprobación del humano. Cada sesión se anota en `docs/ai-log.md`.

## Consecuencias
- Más lento al inicio, pero los fallos se detectan antes y el registro sirve de evidencia para la memoria.
- Los tests de permisos y seguridad se tratan como funcionalidad, no como añadido final.
