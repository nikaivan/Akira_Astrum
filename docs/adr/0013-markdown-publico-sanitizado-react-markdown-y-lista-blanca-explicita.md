# ADR 0013: Markdown público sanitizado: react-markdown sin HTML crudo y lista blanca explícita

- **Estado:** Propuesto (2026-11-03), pendiente de que lo acepte el humano
- **Fecha:** 2026-11-03

## Contexto
El contenido de las entradas es Markdown escrito por el admin y se muestra a cualquier visitante (A05, `PLAN.md` §5). Aunque hoy lo escribe una sola persona de confianza, el contenido puede traer HTML pegado de otro sitio, enlaces con esquemas peligrosos o imágenes de terceros, y el sanitizado no puede depender de quién escribe: una cuenta comprometida o un descuido no debe convertirse en XSS para los visitantes. Había que elegir cómo convertir el Markdown y cómo restringir lo que sale.

## Decisión
- **`react-markdown` 10.1.0** (MIT, `remarkjs/react-markdown`) convierte el Markdown en **elementos de React**: no usa inserción de HTML en bruto y descarta el HTML crudo (no se usa `rehype-raw`). Versión exacta.
- **`rehype-sanitize` 6.0.0** (MIT, `rehypejs/rehype-sanitize`) aplica una **lista blanca explícita propia** (`lib/markdown/sanitize-schema.ts`), no la lista por defecto de la librería: etiquetas `p, br, strong, em, code, pre, blockquote, ul, ol, li, a, img, hr, h1–h6`; atributos `a[href]`, `img[src, alt, title]` y `code[class]` solo si es `language-…`; protocolos `href: http, https, mailto` y `src: https`. Sin `id`, `name`, `style` ni manejadores `on*`. Lo que no está en la lista se elimina.
- **Enlaces** (`components/markdown.tsx`): solo absolutos `http`, `https` y `mailto`. Los `http(s)` se abren en otra pestaña y todos llevan `rel="noopener noreferrer"`. Cualquier otro enlace (`javascript:`, `data:`, `file:`, relativos, `//host`, anclas, esquemas en mayúsculas) se pinta **como texto, sin enlace**.
- **Imágenes:** solo las del bucket público del propio proyecto (`https://<proyecto>.supabase.co/storage/v1/object/public/post-images/<nombre generado>`), sin usuario, puerto ni consulta; cualquier otra se descarta. Se pintan con `next/image` (en un contenedor `aspect-video` con `fill`, porque no se conocen las dimensiones). Si `NEXT_PUBLIC_SUPABASE_URL` no es un `https` limpio, **no se admite ninguna imagen** (falla cerrado). `next.config.ts` restringe `images.remotePatterns` con la misma regla y el mismo host (`buildImageConfig`).
- **Títulos del contenido desplazados un nivel** (`#` → `h2`…): el único `h1` de la página es el de la entrada.
- **Bloques de código** con `tabindex="0"`, añadido después del sanitizado (el autor nunca puede fijarlo): un bloque que se desplaza en horizontal debe poder enfocarse con el teclado (WCAG 2.1.1; axe lo exige).
- **Los textos de la interfaz** (título, categoría, descripción) se pintan como texto de React, que escapa por defecto; un test de arquitectura prohíbe la inserción de HTML en bruto, `innerHTML`, `eval`, `rehype-raw` y la lista por defecto.
- **Se comprueba con tests:** unos 55 payloads reales de XSS (`<script>`, `<img onerror>`, `<iframe>`, `javascript:` y variantes, `data:`, `on*`, `style`, entidades, mayúsculas) en 7 contextos; el invariante es que **toda etiqueta y todo atributo de la salida está en una lista blanca escrita en el test**. Además, 20 casos de imágenes descartadas, enlaces, y un e2e que carga contenido hostil en el navegador (sin `dialog`, sin `window.__xss`, sin `iframe` ni `script`).

## Consecuencias
- **Dependencias:** entran 80 paquetes transitivos del ecosistema `unified` (79 MIT y 1 ISC), sin scripts de instalación. `npm audit` no cambia (21 moderadas o bajas, 0 altas). Las versiones están fijadas.
- **Funciones que se pierden a propósito:** no hay `remark-gfm` (tablas, tachado, autoenlaces literales), ni enlaces relativos o anclas, ni HTML en el Markdown. Si hace falta alguno, se añade con su test y se actualiza este ADR.
- **Esquemas en mayúsculas** (`HTTPS://…`) se tratan como texto: es seguro y evita normalizar.
- **El sanitizado se hace al pintar, no al guardar:** la base de datos conserva lo que se escribió. Quien muestre ese contenido en otro lugar (un feed, un correo) tendrá que sanitizarlo también.
- **Las imágenes no tienen dimensiones propias:** se muestran en una caja 16:9 con `object-contain`. El texto alternativo sale del Markdown (vacío si falta); el texto alternativo obligatorio al subir llega con el bloque del editor.
- **Una actualización de `rehype-sanitize` o de `react-markdown` puede cambiar la salida:** los tests de invariantes lo detectarían.
- Relacionado: ADR 0003 (seguridad en profundidad), ADR 0012 (calculadora: mismo principio de texto como texto) y ADR 0014 (lectura pública).
