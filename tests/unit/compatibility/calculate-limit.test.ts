import { describe, expect, it } from "vitest";
import { calculateCompatibility, type CompatibilityState } from "@/lib/compatibility/calculate";
import { createCompatibilityLimiter } from "@/lib/compatibility/limiter";
import { RATE_LIMIT_ERROR } from "@/lib/compatibility/messages";
import { dates, TODAY } from "./support";

const MINUTE = 60_000;

function setup() {
  const clock = { now: 1_000_000 };
  const limiter = createCompatibilityLimiter({ now: () => clock.now });
  const run = (ip: string, birthA = "1990-05-17", birthB = "2000-03-21"): Promise<CompatibilityState> =>
    calculateCompatibility({ formData: dates(birthA, birthB), today: TODAY, limiter, ip });
  return { clock, limiter, run };
}

describe("límite de consultas de la calculadora", () => {
  it("permite 30 consultas y bloquea la 31.ª de la misma IP", async () => {
    const { run } = setup();
    for (let i = 1; i <= 30; i++) expect((await run("203.0.113.1")).ok, `consulta ${i}`).toBe(true);

    const blocked = await run("203.0.113.1");
    expect(blocked).toStrictEqual({ ok: false, message: RATE_LIMIT_ERROR, errors: {} });
  });

  it("un bloqueo no calcula nada, ni siquiera con fechas válidas", async () => {
    const { run } = setup();
    for (let i = 0; i < 30; i++) await run("203.0.113.1");
    const blocked = await run("203.0.113.1", "1990-05-17", "2000-03-21");
    expect(blocked.ok).toBe(false);
    expect(JSON.stringify(blocked)).not.toMatch(/Aries|Tauro|Géminis|Piscis|Alta|Media|Baja/);
  });

  it("las consultas con fechas inválidas también cuentan", async () => {
    const { run } = setup();
    for (let i = 0; i < 30; i++) await run("203.0.113.1", "abc", "");
    expect(await run("203.0.113.1")).toStrictEqual({ ok: false, message: RATE_LIMIT_ERROR, errors: {} });
  });

  it("otra IP no se ve afectada", async () => {
    const { run } = setup();
    for (let i = 0; i < 31; i++) await run("203.0.113.1");
    expect((await run("198.51.100.9")).ok).toBe(true);
  });

  it("el bloqueo expira a los 10 minutos", async () => {
    const { clock, run } = setup();
    for (let i = 0; i < 31; i++) await run("203.0.113.1");

    clock.now += 10 * MINUTE - 1;
    expect((await run("203.0.113.1")).ok).toBe(false);
    clock.now += 1;
    expect((await run("203.0.113.1")).ok).toBe(true);
  });

  it("el limitador de la calculadora es independiente del del login", () => {
    const first = createCompatibilityLimiter();
    const second = createCompatibilityLimiter();
    for (let i = 0; i < 30; i++) first.recordFailure("203.0.113.1");
    expect(first.isBlocked("203.0.113.1")).toBe(true);
    expect(second.isBlocked("203.0.113.1")).toBe(false);
  });
});
