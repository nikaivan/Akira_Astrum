# ADR 0006: `published_at` ligado al estado y transiciones estrictas

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
Una entrada pasa entre `draft` y `published` (`PLAN.md` §1 y §6). Hay que decidir qué ocurre con `published_at` al cambiar de estado y qué hacer ante transiciones repetidas o datos incoherentes. La lógica vive en `lib/posts/status.ts` y está cubierta por `tests/unit/posts/status.test.ts`.

## Decisión
- **Invariante:** `published_at` no es nulo si y solo si el estado es `published`.
- Publicar fija `published_at` al instante recibido (el reloj se inyecta como parámetro, no se lee dentro de la función). Despublicar lo pone a `null`. Al republicar se fija una fecha nueva; no se conserva la de la primera publicación.
- **Transiciones estrictas:** publicar algo ya publicado, o despublicar un borrador, lanza `Transición no válida`. No son operaciones idempotentes.
- **Fallar cerrado (A10):** un estado incoherente o desconocido (`draft` con fecha, `published` sin fecha, `archived`) lanza `Estado no válido`. Una fecha inválida lanza `Fecha no válida`. Los mensajes son genéricos.
- Las funciones son puras e inmutables: devuelven un objeto nuevo.

## Consecuencias
- El orden del blog por `published_at` refleja la última publicación, no la primera.
- La interfaz solo debe ofrecer la acción válida para el estado actual. Una acción repetida (por ejemplo, un doble clic) devuelve un error en lugar de pasar en silencio.
- Se propone reflejar el invariante en la migración de la Fase 1 con una restricción `CHECK` en Postgres, de modo que la base de datos también lo haga cumplir (defensa en profundidad, ADR 0003).
- Si más adelante se quiere conservar la fecha de la primera publicación, habrá que añadir otra columna; cambiar esta decisión exige modificar los tests.
