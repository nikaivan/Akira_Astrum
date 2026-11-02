import { describe, expect, it } from "vitest";
import { DISCLAIMER, LEVELS } from "@/lib/astrology/compatibility-data";
import { getCompatibility } from "@/lib/astrology/compatibility";
import { SIGNS } from "@/lib/astrology/signs";
import { calculateCompatibility } from "@/lib/compatibility/calculate";
import { createCompatibilityLimiter } from "@/lib/compatibility/limiter";
import { MISSING_DATE_ERRORS, INVALID_DATE_ERROR } from "@/lib/compatibility/messages";
import { dateOfSign, dates, TODAY } from "./support";

const run = (formData: FormData, ip = "203.0.113.5") =>
  calculateCompatibility({ formData, today: TODAY, limiter: createCompatibilityLimiter(), ip });

function success(formData: FormData) {
  const state = run(formData);
  return state.then((value) => {
    if (!value.ok) throw new Error("Se esperaba un resultado");
    return value.result;
  });
}

describe("calculateCompatibility: casos de la sección 7 de astrologia-reglas.md", () => {
  it.each([
    ["2001-03-20", "Piscis"],
    ["2001-03-21", "Aries"],
    ["2001-04-20", "Aries"],
    ["2001-04-21", "Tauro"],
    ["2001-08-21", "Leo"],
    ["2001-08-22", "Virgo"],
    ["2000-02-29", "Piscis"],
    ["2001-12-31", "Capricornio"],
    ["2001-01-01", "Capricornio"],
    ["2001-01-19", "Capricornio"],
    ["2001-01-20", "Acuario"],
    ["2001-12-21", "Sagitario"],
    ["2001-12-22", "Capricornio"],
  ])("la fecha %s es del signo %s (en las dos posiciones)", async (date, sign) => {
    const first = await success(dates(date, "2001-03-21"));
    const second = await success(dates("2001-03-21", date));
    expect(first.people[0].sign).toBe(sign);
    expect(second.people[1].sign).toBe(sign);
  });

  it.each([
    ["Aries", "Leo", "alta"],
    ["Aries", "Aries", "media"],
    ["Aries", "Libra", "media"],
    ["Aries", "Cáncer", "baja"],
    ["Tauro", "Virgo", "alta"],
    ["Tauro", "Leo", "baja"],
    ["Géminis", "Libra", "alta"],
    ["Cáncer", "Escorpio", "alta"],
    ["Libra", "Cáncer", "baja"],
    ["Libra", "Escorpio", "media"],
    ["Virgo", "Acuario", "media"],
    ["Piscis", "Capricornio", "alta"],
    ["Leo", "Escorpio", "baja"],
    ["Escorpio", "Cáncer", "alta"],
  ])("%s con %s tiene compatibilidad %s", async (a, b, level) => {
    const result = await success(dates(dateOfSign(a), dateOfSign(b)));
    expect(result.level).toBe(level);
  });
});

describe("calculateCompatibility: el resultado sale de los datos de lib/astrology/", () => {
  it("incluye signo, símbolo y elemento de cada persona, y nivel, explicación y aviso", async () => {
    const result = await success(dates(dateOfSign("Aries"), dateOfSign("Cáncer")));
    const aries = SIGNS.find((sign) => sign.name === "Aries");
    const cancer = SIGNS.find((sign) => sign.name === "Cáncer");
    const domain = getCompatibility("Aries", "Cáncer");

    expect(result.people[0]).toStrictEqual({ sign: "Aries", symbol: aries?.symbol, element: aries?.element });
    expect(result.people[1]).toStrictEqual({ sign: "Cáncer", symbol: cancer?.symbol, element: cancer?.element });
    expect(result.level).toBe(domain.level);
    expect(result.levelName).toBe(domain.levelName);
    expect(result.levelDescription).toBe(LEVELS.find((level) => level.code === domain.level)?.description);
    expect(result.textKind).toBe(domain.textKind);
    expect(result.text).toBe(domain.text);
    expect(result.disclaimer).toBe(DISCLAIMER);
  });

  it("el texto sigue el orden de las fechas (la primera persona es el signo A)", async () => {
    const result = await success(dates(dateOfSign("Aries"), dateOfSign("Leo")));
    expect(result.text).toBe(getCompatibility("Aries", "Leo").text);
  });

  it("la misma entrada da siempre la misma salida", async () => {
    const input = () => dates("1990-05-17", "2000-03-21");
    expect(await success(input())).toStrictEqual(await success(input()));
  });
});

describe("calculateCompatibility: simetría (ADR 0007)", () => {
  const pairs = SIGNS.flatMap((a) => SIGNS.map((b) => [a.name, b.name] as const));

  it("las 144 combinaciones dan el mismo nivel y tipo de texto al intercambiar las fechas", async () => {
    expect(pairs).toHaveLength(144);
    for (const [a, b] of pairs) {
      const direct = await success(dates(dateOfSign(a), dateOfSign(b)));
      const swapped = await success(dates(dateOfSign(b), dateOfSign(a)));
      expect({ pair: [a, b], level: swapped.level, kind: swapped.textKind }).toStrictEqual({
        pair: [a, b],
        level: direct.level,
        kind: direct.textKind,
      });
      expect(swapped.people.map((person) => person.sign)).toEqual(direct.people.map((person) => person.sign).reverse());
    }
  });
});

describe("calculateCompatibility: entradas inválidas", () => {
  it("devuelve los errores por campo y un resumen, sin calcular nada", async () => {
    const state = await run(dates("", "2023-02-30"));
    expect(state.ok).toBe(false);
    if (state.ok) return;
    expect(state.errors).toStrictEqual({ birthA: MISSING_DATE_ERRORS.birthA, birthB: INVALID_DATE_ERROR });
    expect(state.message).toBeTruthy();
  });

  it.each([
    ["fecha futura", "2999-01-01"],
    ["fecha anterior a 1900", "1899-12-31"],
    ["texto", "abc"],
    ["vacía", ""],
  ])("rechaza %s", async (_caso, bad) => {
    expect((await run(dates(bad, "2000-03-21"))).ok).toBe(false);
    expect((await run(dates("2000-03-21", bad))).ok).toBe(false);
  });

  it("los campos ausentes también se rechazan", async () => {
    expect((await run(new FormData())).ok).toBe(false);
  });
});
