import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compatibilityAction } from "@/lib/compatibility/actions";
import { RATE_LIMIT_ERROR } from "@/lib/compatibility/messages";
import { setSecuritySink } from "@/lib/security/log";
import { dates } from "../compatibility/support";

let forwardedFor: string | null = "203.0.113.77";
vi.mock("next/headers", () => ({
  headers: async () => new Headers(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
}));

// Fechas distintivas: si alguna aparece en una línea del registro, el test lo detecta.
const BIRTH_A = "1953-11-27";
const BIRTH_B = "1961-08-14";
const FRAGMENTS = [BIRTH_A, BIRTH_B, "1953", "1961", "11-27", "08-14"];

let lines: string[] = [];
const events = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
const call = (a = BIRTH_A, b = BIRTH_B) => compatibilityAction(null, dates(a, b));

beforeEach(() => {
  forwardedFor = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  lines = [];
  setSecuritySink((line) => lines.push(line));
});
afterEach(() => setSecuritySink(null));

describe("calculadora: eventos de seguridad", () => {
  it("las 30 primeras consultas no registran nada y la 31.ª registra rate_limited/calculator", async () => {
    for (let i = 0; i < 30; i++) await call();
    expect(events()).toEqual([]);

    const blocked = await call();
    expect(blocked.ok === false && blocked.message).toBe(RATE_LIMIT_ERROR);
    expect(events()).toEqual([expect.objectContaining({ event: "rate_limited", level: "warn", scope: "calculator", client: expect.stringMatching(/^[0-9a-f]{12}$/) })]);
  });

  it("ninguna línea contiene las fechas, sus partes ni la IP", async () => {
    for (let i = 0; i < 33; i++) await call();
    await call("2023-02-30", "abc");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const text of [...FRAGMENTS, forwardedFor ?? ""]) expect(lines.join("\n")).not.toContain(text);
  });

  it("las fechas inválidas no son un evento de seguridad", async () => {
    await call("2023-02-30", "abc");
    await call("", "");
    expect(events()).toEqual([]);
  });

  it("el registro no cambia la respuesta: con un sumidero que lanza, la 31.ª sigue siendo el mismo mensaje", async () => {
    setSecuritySink(() => {
      throw new Error("el registro ha fallado");
    });
    for (let i = 0; i < 30; i++) await call();
    const blocked = await call();
    expect(blocked.ok === false && blocked.message).toBe(RATE_LIMIT_ERROR);
  });
});
