# ADR 0003: Seguridad en profundidad con comprobaciones en servidor y RLS

- **Estado:** Propuesto (borrador para revisión)
- **Fecha:** 2026-11-02

## Contexto
La escritura de contenido es exclusiva del admin. Una sola barrera de acceso puede fallar por un error de código o de configuración.

## Decisión
El acceso se comprueba en varias capas independientes:
1. Middleware en las rutas de la intranet.
2. Comprobación del rol admin en cada Server Action.
3. RLS en Postgres y políticas en `storage.objects`.

Nunca se confía en datos del cliente. El código usa la clave anónima y la sesión del usuario; `service_role` solo en servidor y solo si es imprescindible. Ante un fallo (sesión, rol o conexión) se deniega el acceso (A10).

## Consecuencias
- Un error en una capa no concede acceso por sí solo.
- Hay que probar cada capa por separado (integración para RLS y Storage, e2e para el middleware).
- Algo de duplicación de reglas, aceptada a cambio de seguridad.
