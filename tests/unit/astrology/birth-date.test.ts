import { describe, expect, it } from "vitest";
import { parseBirthDate } from "@/lib/astrology/birth-date";

const TODAY = "2026-11-02";
const INVALID_DATE = "Fecha no válida";

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return (error as Error).message;
  }
  return "no lanzó ningún error";
}

describe("parseBirthDate", () => {
  it.each([
    ["una fecha válida", "1990-05-15", { year: 1990, month: 5, day: 15 }],
    ["el mínimo admitido", "1900-01-01", { year: 1900, month: 1, day: 1 }],
    ["hoy", "2026-11-02", { year: 2026, month: 11, day: 2 }],
    ["el 29/02 de un año bisiesto", "1996-02-29", { year: 1996, month: 2, day: 29 }],
    ["el 29/02 de un año divisible por 400", "2000-02-29", { year: 2000, month: 2, day: 29 }],
  ])("acepta %s", (_caso, entrada, esperado) => {
    expect(parseBirthDate(entrada, TODAY)).toEqual(esperado);
  });

  const rechazadas: [string, unknown][] = [
    ["el 30 de febrero", "2024-02-30"],
    ["el 31 de abril", "2024-04-31"],
    ["el 29/02 de un año no bisiesto", "2023-02-29"],
    ["el 29/02 de un año secular no bisiesto", "1900-02-29"],
    ["la fecha de mañana", "2026-11-03"],
    ["una fecha muy futura", "2099-01-01"],
    ["una fecha anterior a 1900", "1899-12-31"],
    ["un texto vacío", ""],
    ["un texto en blanco", "   "],
    ["un texto que no es una fecha", "abc"],
    ["el formato día/mes/año", "15/05/1990"],
    ["un mes sin cero inicial", "1990-5-15"],
    ["un espacio al final", "1990-05-15 "],
    ["un espacio al principio", " 1990-05-15"],
    ["una fecha con hora", "1990-05-15T00:00:00Z"],
    ["un signo + delante", "+1990-05-15"],
    ["un año de cinco cifras", "10000-01-01"],
    ["el mes 13", "1990-13-01"],
    ["el mes 0", "1990-00-10"],
    ["el día 32", "1990-01-32"],
    ["el día 0", "1990-01-00"],
    ["null", null],
    ["undefined", undefined],
    ["un número", 19900515],
    ["un objeto", {}],
    ["una lista", []],
    ["una instancia de Date", new Date()],
    ["un script", "<script>alert(1)</script>"],
    ["una inyección SQL", "1990-05-15'; DROP TABLE x; --"],
    ["una ruta relativa", "../../etc/passwd"],
  ];

  it.each(rechazadas)("rechaza %s con un mensaje genérico que no repite la entrada", (_caso, entrada) => {
    expect(messageOf(() => parseBirthDate(entrada, TODAY))).toBe(INVALID_DATE);
  });

  it.each(["hoy", "", "2026-13-01", "2026-11-02T00:00:00Z"])("rechaza un today inválido: %j", (today) => {
    expect(() => parseBirthDate("1990-05-15", today)).toThrow(INVALID_DATE);
  });
});
