# Decisiones de arquitectura (ADR)

Formato breve: contexto, decisión, consecuencias. Estados: Propuesto, Aceptado, Sustituido.
Las desviaciones respecto a `PLAN.md` se registran aquí o en `docs/ai-log.md`, no en el plan.

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-monolito-nextjs-supabase.md) | Monolito con Next.js y Supabase | Aceptado |
| [0002](0002-tdd-estricto-roles-humano-ia.md) | TDD estricto y reparto de roles humano-IA | Aceptado |
| [0003](0003-seguridad-en-profundidad-rls-y-servidor.md) | Seguridad en profundidad: servidor y RLS | Aceptado |
| [0004](0004-playwright-escritorio-y-movil.md) | Playwright con proyectos de escritorio y móvil | Aceptado |
| [0005](0005-versiones-fijadas-y-verificacion-de-dependencias.md) | Versiones fijas y verificación de dependencias | Aceptado |
| [0006](0006-publicacion-published-at-y-transiciones-estrictas.md) | `published_at` ligado al estado y transiciones estrictas | Aceptado |
| [0007](0007-dominio-astrologico-fuente-de-verdad-simetria-y-fechas-sin-zona-horaria.md) | Dominio astrológico: fuente de verdad, simetría y fechas sin zona horaria | Aceptado |
| [0008](0008-control-de-acceso-rol-en-profiles-y-storage-no-listable.md) | Control de acceso: rol en `profiles`, `is_admin` privado, privilegios mínimos y Storage no listable | Aceptado |
| [0009](0009-pruebas-de-integracion-proyecto-de-test-y-service-role-acotado.md) | Pruebas de integración contra un proyecto de test aparte, con guarda por ref y `service_role` acotado | Aceptado |
