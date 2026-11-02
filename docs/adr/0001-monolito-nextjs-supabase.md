# ADR 0001: Monolito con Next.js y Supabase

- **Estado:** Propuesto (borrador para revisión)
- **Fecha:** 2026-11-02

## Contexto
Una sola persona, plazo hasta el 6 de noviembre y coste de 0 €. Hacen falta un blog público, una intranet de administración, una calculadora sin persistencia y una PWA mínima.

## Decisión
Una única aplicación Next.js (App Router, TypeScript) con Supabase para base de datos, autenticación, RLS y Storage. Sin API separada. Despliegue en Vercel y Supabase (planes gratuitos). Detalle del stack en `PLAN.md` §2.

## Consecuencias
- Menos piezas que desplegar, probar y proteger.
- Dependencia de los planes gratuitos: Supabase pausa el proyecto por inactividad (riesgo en `PLAN.md` §10).
- Si el proyecto creciera, habría que separar la API; queda fuera de alcance.
