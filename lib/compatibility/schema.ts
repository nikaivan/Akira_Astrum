import { z } from "zod";
import { parseBirthDate, type BirthDate } from "@/lib/astrology/birth-date";
import { INVALID_DATE_ERROR, MISSING_DATE_ERRORS } from "./messages";

export type FieldErrors = { birthA?: string; birthB?: string };

export type ParsedInput =
  | { success: true; data: { birthA: BirthDate; birthB: BirthDate } }
  | { success: false; errors: FieldErrors };

// La regla de la fecha (formato, calendario, 1900 y "no futura") es la del dominio: aquí solo se adapta a Zod.
function dateField(today: string, missing: string) {
  return z
    .string({ error: (issue) => (issue.input === undefined ? missing : INVALID_DATE_ERROR) })
    .transform((value, ctx) => {
      const text = value.trim();
      if (text === "") {
        ctx.issues.push({ code: "custom", message: missing, input: value });
        return z.NEVER;
      }
      try {
        return parseBirthDate(text, today);
      } catch {
        ctx.issues.push({ code: "custom", message: INVALID_DATE_ERROR, input: value });
        return z.NEVER;
      }
    });
}

/** Valida en el servidor las dos fechas del formulario. `today` (AAAA-MM-DD) lo decide quien llama. */
export function parseCompatibilityInput(input: unknown, today: string): ParsedInput {
  const schema = z.object({
    birthA: dateField(today, MISSING_DATE_ERRORS.birthA),
    birthB: dateField(today, MISSING_DATE_ERRORS.birthB),
  });
  const parsed = schema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    if (issue.path[0] === "birthA") errors.birthA ??= issue.message;
    if (issue.path[0] === "birthB") errors.birthB ??= issue.message;
  }
  // Una entrada que ni siquiera es un objeto: ambos campos inválidos.
  if (!errors.birthA && !errors.birthB) {
    errors.birthA = INVALID_DATE_ERROR;
    errors.birthB = INVALID_DATE_ERROR;
  }
  return { success: false, errors };
}
