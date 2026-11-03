/** Textos que ve el admin. Fijos y genéricos: nunca incluyen mensajes de Zod, de Supabase ni SQL (A05, A10). */
export const INVALID_REQUEST = "La solicitud no es válida.";
export const GENERIC_ERROR = "No se pudo completar la operación. Inténtalo de nuevo.";
export const VALIDATION_SUMMARY = "Revisa los campos marcados.";

export const SLUG_TAKEN = "Ya existe una entrada con esa dirección.";
export const SLUG_LOCKED = "La dirección de una entrada publicada no se puede cambiar. Despublícala primero.";
export const SLUG_FROM_TITLE_FAILED = "No se pudo generar la dirección a partir del título. Escríbela a mano.";
export const CATEGORY_MISSING = "Alguna de las categorías elegidas ya no existe.";
export const ALREADY_PUBLISHED = "La entrada ya estaba publicada.";
export const ALREADY_DRAFT = "La entrada ya estaba en borrador.";
export const POST_NOT_FOUND = "La entrada no existe.";
export const POST_CHANGED = "La entrada cambió mientras la editabas. Recarga la página e inténtalo de nuevo.";
export const CATEGORY_NOT_FOUND = "La categoría no existe.";
export const CATEGORY_SLUG_TAKEN = "Ya existe una categoría con esa dirección.";
export const CATEGORY_NAME_UNUSABLE = "El nombre debe incluir letras o números.";

export const TITLE_REQUIRED = "El título es obligatorio.";
export const TITLE_TOO_LONG = "El título no puede superar los 200 caracteres.";
export const SLUG_INVALID = "Usa solo minúsculas, números y guiones, sin guiones seguidos ni al principio o al final (máximo 80 caracteres).";
export const CONTENT_TOO_LONG = "El contenido no puede superar los 50 000 caracteres.";
export const CATEGORIES_INVALID = "Las categorías elegidas no son válidas (máximo 10, sin repetidas).";
export const INTENT_INVALID = "La acción elegida no es válida.";
export const NAME_REQUIRED = "El nombre es obligatorio.";
export const NAME_TOO_LONG = "El nombre no puede superar los 60 caracteres.";

export const POST_CREATED = "Entrada creada.";
export const POST_SAVED = "Cambios guardados.";
export const POST_PUBLISHED = "Entrada publicada.";
export const POST_UNPUBLISHED = "Entrada despublicada.";
export const POST_DELETED = "Entrada eliminada.";
export const CATEGORY_CREATED = "Categoría creada.";
export const CATEGORY_RENAMED = "Categoría renombrada.";
export const CATEGORY_DELETED = "Categoría eliminada.";
