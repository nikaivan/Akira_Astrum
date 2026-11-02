import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBirthDate } from "@/lib/astrology/birth-date";
import { getSunSign } from "@/lib/astrology/sun-sign";

const ZONES = ["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Auckland"];
const TODAY = "2026-11-02";
const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const signOf = (date: string) => getSunSign(parseBirthDate(date, TODAY));

it("la zona horaria de prueba cambia de verdad", () => {
  process.env.TZ = "UTC";
  const utc = new Date(2000, 5, 1).getTimezoneOffset();
  process.env.TZ = "America/Los_Angeles";
  const losAngeles = new Date(2000, 5, 1).getTimezoneOffset();
  expect(utc).not.toBe(losAngeles);
  // El fallo clásico: new Date("2000-03-21") cae en el día 20 en Los Ángeles.
  expect(new Date("2000-03-21").getDate()).toBe(20);
});

describe.each(ZONES)("en la zona %s", (zone) => {
  beforeEach(() => {
    process.env.TZ = zone;
  });

  it.each([
    ["2000-03-21", "Aries"],
    ["2000-03-20", "Piscis"],
    ["1990-12-31", "Capricornio"],
    ["1991-01-01", "Capricornio"],
    ["2000-01-19", "Capricornio"],
    ["2000-01-20", "Acuario"],
    ["2000-08-21", "Leo"],
    ["2000-08-22", "Virgo"],
    ["2000-02-29", "Piscis"],
    ["2024-02-29", "Piscis"],
  ])("%s se lee como día y mes y es %s", (date, esperado) => {
    const [year, month, day] = date.split("-").map(Number);
    expect(parseBirthDate(date, TODAY)).toEqual({ year, month, day });
    expect(signOf(date)).toBe(esperado);
  });

  it.each(["2023-02-29", "2024-04-31"])("la fecha inexistente %s sigue siendo inválida", (date) => {
    expect(() => parseBirthDate(date, TODAY)).toThrow("Fecha no válida");
  });

  it("hoy es válido y mañana no, igual en todas las zonas", () => {
    expect(parseBirthDate("2026-11-02", TODAY)).toEqual({ year: 2026, month: 11, day: 2 });
    expect(() => parseBirthDate("2026-11-03", TODAY)).toThrow("Fecha no válida");
  });
});
