import * as messages from "./messages";

export type Parsed<T, E> = { success: true; data: T } | { success: false; errors: E };
export type Failure<E> = { ok: false; message: string; fieldErrors?: E };

/** Códigos de error de Postgres que el panel traduce a mensajes concretos; el resto es un error genérico. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

export function fail<E = never>(message: string, fieldErrors?: E): Failure<E> {
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Entrada que no pasa el esquema: un campo no permitido es una solicitud inválida; el resto, errores de campo. */
export function invalid<E extends { form?: string }>(errors: E): Failure<E> {
  return fail(errors.form ? messages.INVALID_REQUEST : messages.VALIDATION_SUMMARY, errors);
}

/** Cualquier excepción inesperada falla cerrado con un mensaje genérico (A10): nada interno sale al cliente. */
export async function guarded<R>(run: () => Promise<R>): Promise<R | Failure<never>> {
  try {
    return await run();
  } catch {
    return fail(messages.GENERIC_ERROR);
  }
}
