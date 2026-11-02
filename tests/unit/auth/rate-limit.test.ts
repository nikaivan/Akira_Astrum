import { describe, expect, it } from "vitest";
import { clientIpFrom, createRateLimiter } from "@/lib/auth/rate-limit";

const MINUTE = 60_000;

function limiterWithClock() {
  const clock = { now: 1_000_000 };
  const limiter = createRateLimiter({ limit: 5, windowMs: 15 * MINUTE, maxKeys: 3, now: () => clock.now });
  return { clock, limiter };
}

const failTimes = (limiter: ReturnType<typeof createRateLimiter>, key: string, times: number) => {
  for (let i = 0; i < times; i++) limiter.recordFailure(key);
};

describe("createRateLimiter", () => {
  it("permite 5 fallos y bloquea el sexto intento", () => {
    const { limiter } = limiterWithClock();
    for (let i = 0; i < 5; i++) {
      expect(limiter.isBlocked("1.1.1.1")).toBe(false);
      limiter.recordFailure("1.1.1.1");
    }
    expect(limiter.isBlocked("1.1.1.1")).toBe(true);
  });

  it("el bloqueo expira al cumplirse la ventana de 15 minutos", () => {
    const { clock, limiter } = limiterWithClock();
    failTimes(limiter, "1.1.1.1", 5);
    clock.now += 15 * MINUTE - 1;
    expect(limiter.isBlocked("1.1.1.1")).toBe(true);
    clock.now += 1;
    expect(limiter.isBlocked("1.1.1.1")).toBe(false);
  });

  it("tras expirar, el contador empieza de cero", () => {
    const { clock, limiter } = limiterWithClock();
    failTimes(limiter, "1.1.1.1", 5);
    clock.now += 15 * MINUTE;
    failTimes(limiter, "1.1.1.1", 4);
    expect(limiter.isBlocked("1.1.1.1")).toBe(false);
  });

  it("cada clave cuenta por separado", () => {
    const { limiter } = limiterWithClock();
    failTimes(limiter, "1.1.1.1", 5);
    expect(limiter.isBlocked("1.1.1.1")).toBe(true);
    expect(limiter.isBlocked("2.2.2.2")).toBe(false);
  });

  it("un éxito reinicia el contador de esa clave", () => {
    const { limiter } = limiterWithClock();
    failTimes(limiter, "1.1.1.1", 4);
    limiter.reset("1.1.1.1");
    failTimes(limiter, "1.1.1.1", 4);
    expect(limiter.isBlocked("1.1.1.1")).toBe(false);
  });

  it("no crece sin límite: expulsa las claves más antiguas", () => {
    const { limiter } = limiterWithClock();
    for (const key of ["a", "b", "c", "d", "e"]) failTimes(limiter, key, 5);
    expect(limiter.size()).toBeLessThanOrEqual(3);
    expect(limiter.isBlocked("e")).toBe(true);
    expect(limiter.isBlocked("a")).toBe(false);
  });

  it("limpia las entradas caducadas", () => {
    const { clock, limiter } = limiterWithClock();
    failTimes(limiter, "a", 1);
    failTimes(limiter, "b", 1);
    clock.now += 15 * MINUTE;
    limiter.isBlocked("c");
    expect(limiter.size()).toBe(0);
  });
});

describe("clientIpFrom", () => {
  const headers = (value: string | null) => ({ get: (name: string) => (name === "x-forwarded-for" ? value : null) });

  it.each([
    ["1.2.3.4", "1.2.3.4"],
    ["1.2.3.4, 5.6.7.8", "1.2.3.4"],
    ["  9.9.9.9  , 1.1.1.1", "9.9.9.9"],
    ["2001:db8::1", "2001:db8::1"],
  ])("toma la primera IP de %j", (entrada, esperado) => {
    expect(clientIpFrom(headers(entrada))).toBe(esperado);
  });

  it.each([
    ["la cabecera falta", null],
    ["la cabecera está vacía", ""],
    ["solo hay espacios", "   "],
    ["el valor es un script", "<script>alert(1)</script>"],
    ["el valor es muy largo", "1".repeat(200)],
    ["el valor tiene saltos de línea", "1.2.3.4\r\nX: y"],
    ["el primer valor no es una IP", "unknown, 1.2.3.4"],
  ])("usa 'unknown' cuando %s", (_caso, entrada) => {
    expect(clientIpFrom(headers(entrada))).toBe("unknown");
  });
});
