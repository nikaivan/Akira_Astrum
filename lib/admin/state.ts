/** Estado que devuelven las Server Actions al formulario (compatible con `useActionState`). */
export type ActionState = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: Record<string, string> } | null;

type Outcome = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: object };

/** Reduce el resultado de un servicio al estado que ve el formulario (solo mensajes y errores por campo). */
export function toActionState(result: Outcome): NonNullable<ActionState> {
  if (result.ok) return { ok: true, message: result.message };
  const fieldErrors = Object.fromEntries(Object.entries(result.fieldErrors ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return { ok: false, message: result.message, ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) };
}
