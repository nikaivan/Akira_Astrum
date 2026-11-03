# ADR 0012: Calculadora pública sin persistencia: Server Action por POST, validación en servidor y límite en memoria

- **Estado:** Aceptado (2026-11-03)
- **Fecha:** 2026-11-02

## Contexto
La calculadora de compatibilidad (`/compatibilidad`) es pública, no tiene cuentas y recibe dos fechas de nacimiento, que son datos personales (A06, privacidad). `PLAN.md` §5 exige validar en servidor, no almacenar ni registrar las fechas, no ponerlas en la URL, limitar las peticiones y fallar cerrado. El dominio (signos, niveles, textos y aviso) ya existe en `lib/astrology/` (ADR 0007) y no se reescribe. Había que decidir dónde se calcula, cómo viajan las fechas y cómo se frena el abuso sin servicios de pago.

## Decisión
- **Server Action por `POST`** (`lib/compatibility/actions.ts`) con un formulario normal. Las fechas viajan en el cuerpo de la petición y nunca en la URL ni en el historial; el formulario funciona **también sin JavaScript** (probado con JavaScript desactivado). La alternativa de calcular solo en el navegador sería aún más privada, pero no permitiría la validación obligatoria de servidor ni el límite de peticiones.
- **Lógica pura y acción fina**, como en el login: `calculateCompatibility` (`lib/compatibility/calculate.ts`) no depende de Next y recibe el reloj (`today`), el limitador y la IP. La acción solo obtiene la IP, calcula "hoy" y la llama.
- **Validación con Zod en el servidor** (`schema.ts`) sobre la regla del dominio (`parseBirthDate`): la regla de formato, calendario, 1900 y "no futura" no se reescribe. Dos mensajes por campo, sin repetir nunca lo escrito: campo vacío ("Indica la fecha de nacimiento de la primera/segunda persona.") y cualquier otro fallo ("Introduce una fecha real entre el 1 de enero de 1900 y hoy."). El formulario usa `noValidate`: aunque el campo nativo ayude con `min="1900-01-01"`, el mensaje siempre sale del servidor. No hay `max` en el campo, porque una página estática congelaría la fecha de hoy en el build.
- **"Hoy" es la fecha UTC del servidor.** Límite conocido: quien nació hoy en una zona horaria adelantada puede ver rechazada la fecha de hoy durante unas horas. Aceptar un día de margen habría contradicho la spec ("hasta la fecha actual").
- **Límite de 30 consultas cada 10 minutos por IP**, contando todas, válidas o no, con el limitador en memoria del login (`createRateLimiter`, instancia propia en `limiter.ts`). Misma IP: primer valor de `x-forwarded-for`, o la clave compartida `unknown`. Mensaje propio al llegar al límite.
- **Fallar cerrado (A10):** cualquier excepción del dominio o del limitador devuelve el mismo mensaje genérico, sin traza, sin el texto de la excepción y sin las fechas.
- **Nada se guarda, se registra ni se envía fuera:** el código de la calculadora no usa Supabase, `console`, `fetch`, `XMLHttpRequest`, almacenamiento del navegador, cookies, escritura de ficheros ni la URL como canal de datos (`searchParams`, `location`, `router`). Lo vigilan pruebas unitarias con espías y un test de arquitectura que analiza el código fuente, y el e2e comprueba que tras calcular la URL no cambia, no hay cookies, el almacenamiento está vacío y todas las peticiones van al propio origen.
- **Los textos se pintan como texto** (A05): sin `dangerouslySetInnerHTML`, `innerHTML` ni `eval` (test de arquitectura); los payloads XSS en los textos salen escapados (test de renderizado).
- **Cabecera `Cache-Control: no-store`** para `/compatibilidad` (la página y las respuestas de la acción), **sin** `noindex`: la calculadora es pública e indexable, así que no se reutilizan las cabeceras privadas de la intranet.
- **Los datos del resultado salen del dominio**, no se copian: un test de arquitectura prohíbe nombres de signos y textos del dominio en el código de la calculadora.
- **Accesibilidad como requisito comprobado:** etiquetas asociadas, errores con `aria-invalid` y `aria-describedby`, resumen con `role="alert"` y foco en el primer campo con error, nivel con icono más texto (nunca solo color), objetivos táctiles de 44 px, foco visible, navegación completa con teclado y axe-core sin violaciones en tres estados.

## Consecuencias
- **Límites del limitador** (los mismos que en el ADR 0011): cada instancia serverless cuenta aparte, un arranque en frío lo reinicia, se esquiva con muchas IPs y quien comparta IP con un atacante queda bloqueado. Frena el abuso casual, no es una garantía.
- La página no se cachea en CDN (`no-store`); se acepta porque es pequeña.
- Los campos del formulario no son controlados: así lo escrito antes de que React hidrate no se pierde. Para que el reinicio del formulario tras la acción no los borre, se recuerdan en el navegador (solo en memoria, sin almacenamiento) y no salen de él.
- Los casos de fechas que el campo nativo no deja escribir (texto, 30 de febrero) se prueban en e2e interceptando el `POST` real, porque React vuelve a fijar el tipo del campo en cada evento de entrada. El test del teclado rellena con `fill`, porque teclear en un campo `date` depende del idioma del navegador.
- Cobertura que queda fuera: el log de eventos de seguridad (A09) y la CSP llegan en la Fase 3, y el service worker de la PWA (Fase 3) no debe cachear las respuestas de la acción.
- Relacionado: ADR 0003 (fallar cerrado), ADR 0007 (dominio astrológico), ADR 0010 y ADR 0011 (autorización y límite de intentos).
