# ADR 0017: Imágenes dentro del contenido: acción de subida propia, limpieza acotada de huérfanas y sus límites

- **Estado:** Aceptado (2026-11-04)
- **Fecha:** 2026-11-04

## Contexto
El editor permite insertar imágenes en el Markdown de una entrada (Fase 2, bloque 5). Reutiliza la subida, la validación por contenido y las políticas del bucket del bloque 4 (ADR 0016) y el render sanitizado del bloque 2 (ADR 0013), que ya solo pintaba imágenes generadas del bucket de este proyecto. Lo nuevo es cómo se sube una imagen que todavía no pertenece a ninguna entrada guardada, y qué se hace con los archivos cuando el texto que los menciona cambia o desaparece (A01, A05, A10).

## Decisión
- **Una acción propia, `uploadPostImage`** (`lib/admin/posts/actions.ts`, `withAdminAction` como las demás, que pasan a ser nueve). Recibe `{ image, alt }`, devuelve `{ ok, url, alt, markdown }` o errores por campo, y **no escribe en la base de datos ni invalida la caché**: una imagen subida solo «existe» para la aplicación cuando el admin guarda el texto que la menciona. Su servicio (`lib/admin/posts/image-service.ts`) reutiliza `inspectCover` (límite de intentos, 2 MiB, firma y estructura) y `uploadCover` (nombre `UUID.ext` generado, sin sobrescribir). El esquema es estricto: un campo desconocido, dos archivos o un alt que no es texto rechazan la petición entera.
- **Texto alternativo obligatorio** (1 a 200 caracteres, sin saltos de línea ni caracteres de control): sin él no se sube nada, ni en el cliente ni en el servidor. El cupo es **único** con las portadas (20 subidas cada 10 minutos por admin, ADR 0011): un intento sin alt no lo gasta.
- **Fallar cerrado:** si no hay un origen de Storage https válido (`NEXT_PUBLIC_SUPABASE_URL`) no se sube nada, porque la imagen no se podría mostrar. La línea de Markdown la construye el servidor (`imageMarkdown`, que escapa `\`, `[`, `]`, `` ` ``, `*`, `_` y `<` y aplana los saltos de línea del alt) y el cliente (`insertImage`) solo la inserta si es **una única línea de imagen que termina en la URL devuelta**; cualquier excepción, respuesta rara o error deja el texto intacto y muestra un error genérico.
- **Interfaz:** un bloque «Insertar imagen en el contenido» en el panel de edición, con campos **sin `name`** (no viajan con el guardado, cuyo esquema es estricto) y botón `type="button"` de 44 px. La línea se escribe en la posición del cursor con una línea en blanco antes y después (`insertSnippet`) y el foco vuelve al texto. Los errores se anuncian con `role="alert"` y el foco va al primer campo a corregir. El aviso de éxito es una región `aria-live="polite"` **sin `role="status"`**: el formulario ya tiene el suyo y varios tests aprobados lo buscan en singular.
- **Limpieza de huérfanas, la opción más simple:**
  - Al **eliminar la entrada** se borran su portada y las imágenes que su texto menciona.
  - Al **guardar una edición** se borran las que el texto anterior mencionaba y el nuevo ya no (después de escribir la fila, como la portada antigua; si el borrado falla, aviso y no error).
  - Una imagen se considera mencionada si su URL aparece **en cualquier parte** del texto, no solo en `![](…)` (`projectImageNames`): ante la duda no se borra. Solo cuentan nombres generados del bucket de este proyecto: una URL de otro host, de otro bucket, con `../` o con un nombre que no es el generado nunca provoca un borrado.
  - No se borra un archivo si **otra entrada** lo menciona todavía (una consulta por nombre; ante un error de lectura se conserva).
  - Sin origen de Storage configurado, el texto no se toca (la portada se sigue borrando como antes).
- **Una sola regla de «imagen del proyecto»** (`projectImageName`, `lib/blog/cover.ts`) para el blog, la vista previa y la limpieza; y una sola definición del «archivo sin elegir» (`isUnselectedFile`) para la portada y las imágenes del contenido.
- **Sin cambios** en el bucket, sus políticas, el esquema de la base de datos ni la migración. El módulo de sintaxis vive en `lib/posts/content-images.ts` y no en `lib/markdown`: dos tests de arquitectura aprobados impiden que `lib/admin` importe `lib/markdown` («el contenido se guarda tal cual») y fijan la lista de archivos del blog.

## Consecuencias
- **Riesgos residuales declarados:**
  - Una imagen subida y quitada del texto **antes de guardar**, o una sesión abandonada, queda huérfana en Storage: no hay forma barata de saberlo sin una tabla de subidas. Un barrido periódico queda para la Fase 3 o 4.
  - Sin transacción, una caída entre guardar y borrar deja un archivo huérfano (con aviso si el borrado falla).
  - Si el admin copia la URL de una imagen a otra entrada, la guarda «otra entrada la usa» la protege; pero dos pestañas editando a la vez siguen siendo «gana el último».
  - El cupo de subidas es por instancia y en memoria, y se comparte con las portadas.
- **Los e2e dejan restos** en el bucket de test si una entrada no se guarda; el `afterEach` los recoge leyendo el texto en pantalla y el test A01 solo cuenta archivos nuevos.
- **CSP (Fase 3):** las imágenes del contenido son del propio Storage, así que `img-src` no necesita nada más que lo ya anotado en el ADR 0016.
- **Lecciones del bloque:** una acción nueva rompe a propósito los tests que enumeran las acciones y exige ampliarlos (ocho pasan a nueve); la API del Supabase falso debe reproducir `LIKE` con saltos de línea; con un diálogo abierto, un recuento de filas pasa en vacío (ya documentado en el ADR 0015) y conviene esperar a que se cierre; y dos regiones `role="status"` rompen los tests que usan `getByRole("status")`.
- Relacionado: ADR 0003, 0008 (Storage), 0011 (límite de intentos), 0013 (Markdown sanitizado), 0015 (acciones del panel) y 0016 (subida de la portada).
