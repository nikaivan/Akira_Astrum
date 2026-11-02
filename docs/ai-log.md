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

## Ejemplo (bórralo cuando tengas entradas reales)

```
## 2026-11-02 · Fase 1 · Políticas RLS de posts
- Objetivo de la sesión: que solo el admin pueda crear y editar posts.
- Lo que pedí a la IA: escribir las políticas de lectura pública (solo publicados) y de escritura por rol.
- Lo que generó la IA: una migración con las políticas.
- Test escrito antes de implementar: sí (anónimo no inserta; anónimo no lee borradores).
- Lo que corregí o rechacé: la política dejaba leer borradores a cualquier usuario autenticado; lo demostré con un test y se corrigió.
- Errores que detectaron los tests: el de lectura de borradores.
- Dependencias nuevas: ninguna.
- Tiempo aproximado: 1 h 30 min.
```

---

## Entradas

<!-- Añade aquí las entradas, de la más antigua a la más reciente -->

---

## Dependencias añadidas (resumen)

| Fecha | Paquete | Para qué | Comprobado (nombre correcto, mantenimiento, licencia) |
|---|---|---|---|
| | | | |

## Desviaciones respecto al plan (resumen)

| Fecha | Qué cambió | Motivo | Impacto |
|---|---|---|---|
| | | | |

## Prompts que funcionaron y que no (opcional)

| Situación | Prompt o enfoque | Resultado | Lección |
|---|---|---|---|
| | | | |

## Resumen final para la memoria (se completa al terminar)

- **Qué hizo la IA bien:**
- **Dónde falló o necesitó corrección:**
- **Qué aportó el humano como arquitecto:**
- **Qué aportó el humano como tester:**
- **Qué haría diferente la próxima vez:**
