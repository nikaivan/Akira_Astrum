import { SIGNS } from "@/lib/astrology/signs";

/** "Hoy" fijo para los tests (la aplicación lo calcula en UTC). */
export const TODAY = "2025-06-15";

const pad = (n: number) => String(n).padStart(2, "0");

/** Una fecha de nacimiento (año 2001, no bisiesto) cuyo signo solar es `name`. */
export function dateOfSign(name: string): string {
  const sign = SIGNS.find((item) => item.name === name);
  if (!sign) throw new Error(`Signo desconocido: ${name}`);
  return `2001-${pad(sign.from.month)}-${pad(sign.from.day)}`;
}

export function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

export const dates = (birthA: string, birthB: string) => form({ birthA, birthB });
