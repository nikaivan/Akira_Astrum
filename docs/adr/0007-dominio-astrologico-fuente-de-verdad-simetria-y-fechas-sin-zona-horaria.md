# ADR 0007: Dominio astrológico: especificación como fuente de verdad, simetría y fechas sin zona horaria

- **Estado:** Aceptado (2026-11-02)
- **Fecha:** 2026-11-02

## Contexto
La calculadora de compatibilidad es pública, no tiene cuentas y no guarda ningún dato (`PLAN.md` §1 y §5). Sus reglas son convenciones astrológicas que define el arquitecto en `docs/astrologia-reglas.md`, y el código no puede inventarlas ni alterarlas. Al implementarla aparecieron tres problemas:
- La spec (§4.4) exige que el resultado de `(A,B)` sea igual al de `(B,A)`, pero el texto explicativo cambia al invertir el orden en las 66 parejas distintas, porque los marcadores `{signoA}` y `{signoB}` salen en el orden de entrada. El nivel sí es simétrico.
- Convertir la fecha con `new Date("AAAA-MM-DD")` depende de la zona horaria: en Los Ángeles da el día anterior (el 21/03, Aries, pasaría a 20/03, Piscis).
- La matriz 12×12 y los textos son 144 celdas y 6 plantillas que pueden alterarse por un error de copia sin que nadie lo note.

## Decisión
- **Fuente de verdad única.** Los datos de `lib/astrology/` (signos, niveles, matriz, textos y aviso de uso) proceden del documento y se generaron a partir de él. Un test (`spec-conformance.test.ts`) lee el documento y compara cada tabla con el código; cualquier cambio de reglas se hace primero en el documento.
- **Simetría del nivel y del tipo de texto.** `getCompatibility(A,B)` y `getCompatibility(B,A)` devuelven el mismo `level` y el mismo `textKind`. El texto redactado sigue el orden de entrada (signo A = primera fecha) y los marcadores se sustituyen de forma literal (`"comparten el elemento Fuego"`). No se impone un orden canónico, porque sería una regla nueva que la spec no define.
- **Fechas como números, sin zona horaria.** La entrada es un texto `AAAA-MM-DD` estricto que se convierte en `{ year, month, day }`. La validez del calendario (años bisiestos incluidos) se calcula con aritmética; el módulo no usa `Date`. "Hoy" lo inyecta quien llama (`today`), y el rango admitido es de 1900 a hoy, ambos inclusive.
- **Fallar cerrado y sin rastro.** Las entradas inválidas lanzan `Fecha no válida` o `Signo no válido` sin repetir lo recibido (A10). El módulo no usa red, base de datos, almacenamiento ni `console`.
- **Se comprueba con tests**, no solo con revisión: la zona horaria se cambia con `process.env.TZ` en cuatro zonas, y un test analiza el código fuente para prohibir `Date`, red, almacenamiento y registro.

## Consecuencias
- Cambiar una regla, una fecha de cúspide o un texto exige editar el documento y los datos; si divergen, falla un test. También falla si cambia el formato de las tablas del documento.
- `(A,B)` y `(B,A)` dan textos distintos aunque el mismo nivel. La interfaz debe mostrar el nivel junto al texto y no asumir que los dos órdenes son idénticos.
- Quien llame al módulo (por ejemplo, una Server Action) decide qué día es hoy y en qué zona horaria. Esa decisión queda fuera del dominio.
- Zod 4.6.7 es una dependencia nueva (ver `docs/ai-log.md`).
- Relacionado: ADR 0003 (fallar cerrado) y `docs/astrologia-reglas.md` §4.4.
