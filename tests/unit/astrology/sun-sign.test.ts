import { describe, expect, it } from "vitest";
import { getSunSign } from "@/lib/astrology/sun-sign";
import { SPEC, type SpecSign } from "./spec";

const sign = (year: number, month: number, day: number) => getSunSign({ year, month, day });

const isLeap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

/** Todos los días del año como [mes, día], sin usar Date. */
function daysOf(year: number): [number, number][] {
  const lengths = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths.flatMap((length, i): [number, number][] =>
    Array.from({ length }, (_, d) => [i + 1, d + 1]),
  );
}

const key = (month: number, day: number) => month * 100 + day;

function contains(spec: SpecSign, month: number, day: number): boolean {
  const from = key(spec.from.month, spec.from.day);
  const to = key(spec.to.month, spec.to.day);
  const x = key(month, day);
  return from <= to ? x >= from && x <= to : x >= from || x <= to;
}

// Casos de la sección 7 de docs/astrologia-reglas.md: [día, mes, signo esperado]
const CASOS: [number, number, string][] = [
  [20, 3, "Piscis"],
  [21, 3, "Aries"],
  [20, 4, "Aries"],
  [21, 4, "Tauro"],
  [21, 8, "Leo"],
  [22, 8, "Virgo"],
  [29, 2, "Piscis"],
  [31, 12, "Capricornio"],
  [1, 1, "Capricornio"],
  [19, 1, "Capricornio"],
  [20, 1, "Acuario"],
  [21, 12, "Sagitario"],
  [22, 12, "Capricornio"],
];

const validYears = (day: number, month: number, years: number[]) =>
  day === 29 && month === 2 ? years.filter(isLeap) : years;

describe("getSunSign", () => {
  it.each(CASOS)("el caso de la sección 7: %i/%i es %s (1990 y 2000)", (day, month, esperado) => {
    for (const year of validYears(day, month, [1990, 2000])) {
      expect(sign(year, month, day)).toBe(esperado);
    }
  });

  it("el 29 de febrero es Piscis, igual que el día anterior y el siguiente", () => {
    for (const year of [1904, 1996, 2000, 2024]) {
      expect(sign(year, 2, 29)).toBe("Piscis");
    }
    expect(sign(2000, 2, 28)).toBe("Piscis");
    expect(sign(2000, 3, 1)).toBe("Piscis");
  });

  it("Capricornio cruza el año: del 22/12 al 19/01 (29 días)", () => {
    const dias: [number, number][] = [
      ...Array.from({ length: 10 }, (_, i): [number, number] => [12, 22 + i]),
      ...Array.from({ length: 19 }, (_, i): [number, number] => [1, 1 + i]),
    ];
    expect(dias).toHaveLength(29);
    for (const year of [1990, 2000]) {
      for (const [month, day] of dias) {
        expect(sign(year, month, day)).toBe("Capricornio");
      }
    }
  });

  it("los bordes de Capricornio son Sagitario el 21/12 y Acuario el 20/01", () => {
    expect(sign(1990, 12, 21)).toBe("Sagitario");
    expect(sign(1990, 1, 20)).toBe("Acuario");
  });

  it("el signo no depende del año (1900, 1990, 2000 y 2024)", () => {
    for (const [day, month, esperado] of CASOS) {
      for (const year of validYears(day, month, [1900, 1990, 2000, 2024])) {
        expect(sign(year, month, day)).toBe(esperado);
      }
    }
  });

  // Cada signo con el siguiente del zodiaco (Piscis vuelve a Aries).
  const CONSECUTIVOS = SPEC.signs.map(
    (signo, i, todos) => [signo.name, signo, todos.at(i + 1) ?? todos[0]] as const,
  );

  it.each(CONSECUTIVOS)(
    "%s: el primer y el último día son suyos y el siguiente signo empieza a continuación",
    (name, { from, to }, next) => {
      expect(sign(2000, from.month, from.day)).toBe(name);
      expect(sign(2000, to.month, to.day)).toBe(name);
      expect(sign(2000, next.from.month, next.from.day)).toBe(next.name);
    },
  );

  it.each([2000, 1990])("en %i cada día tiene exactamente un signo", (year) => {
    const dias = daysOf(year);
    expect(dias).toHaveLength(isLeap(year) ? 366 : 365);
    for (const [month, day] of dias) {
      const candidatos = SPEC.signs.filter((s) => contains(s, month, day));
      expect(candidatos).toHaveLength(1);
      expect(sign(year, month, day)).toBe(candidatos[0].name);
    }
  });

  it("aparecen los 12 signos a lo largo de un año", () => {
    const vistos = new Set(daysOf(2000).map(([month, day]) => sign(2000, month, day)));
    expect([...vistos].sort()).toEqual(SPEC.signs.map((s) => s.name).sort());
  });

  it("es determinista y no muta la entrada", () => {
    const fecha = Object.freeze({ year: 2000, month: 3, day: 21 });
    expect(getSunSign(fecha)).toBe(getSunSign(fecha));
    expect(fecha).toEqual({ year: 2000, month: 3, day: 21 });
  });

  it.each([
    ["el 30 de febrero", { year: 2023, month: 2, day: 30 }],
    ["el 29 de febrero de un año no bisiesto", { year: 2023, month: 2, day: 29 }],
    ["el mes 13", { year: 2000, month: 13, day: 1 }],
  ])("falla cerrado ante %s", (_caso, fecha) => {
    expect(() => getSunSign(fecha)).toThrow("Fecha no válida");
  });
});
