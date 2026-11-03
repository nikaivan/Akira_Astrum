/**
 * Lista blanca explícita del contenido de las entradas (A05). No parte de la lista por defecto de
 * ninguna librería: lo que no está aquí se elimina. Sin `id`, `name`, `style` ni manejadores `on*`.
 */
// Solo las clases que añade el resaltado de un bloque de código con lenguaje.
const languageClass: [string, RegExp] = ["className", /^language-[a-z0-9-]+$/];

export const sanitizeSchema = {
  tagNames: ["p", "br", "strong", "em", "code", "pre", "blockquote", "ul", "ol", "li", "a", "img", "hr", "h1", "h2", "h3", "h4", "h5", "h6"],
  attributes: {
    a: ["href"],
    img: ["src", "alt", "title"],
    code: [languageClass],
  },
  protocols: {
    href: ["http", "https", "mailto"],
    src: ["https"],
  },
  strip: ["script", "style"],
  clobber: [],
  clobberPrefix: "",
};
