/** Mensajes de interfaz de la calculadora. Ninguno repite lo que escribió la persona. */
export const MISSING_DATE_ERRORS = {
  birthA: "Indica la fecha de nacimiento de la primera persona.",
  birthB: "Indica la fecha de nacimiento de la segunda persona.",
} as const;

export const INVALID_DATE_ERROR = "Introduce una fecha real entre el 1 de enero de 1900 y hoy.";
export const INVALID_FORM_SUMMARY = "Revisa las fechas: hay campos con errores.";
export const RATE_LIMIT_ERROR = "Demasiadas consultas. Inténtalo de nuevo en unos minutos.";
export const GENERIC_ERROR = "No se ha podido calcular la compatibilidad. Inténtalo de nuevo más tarde.";
