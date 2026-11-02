import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compatibilityAction } from "@/lib/compatibility/actions";
import { RATE_LIMIT_ERROR } from "@/lib/compatibility/messages";
import { dates } from "./support";

let forwardedFor: string | null = "203.0.113.1";
vi.mock("next/headers", () => ({
  headers: async () => new Headers(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
}));

const call = (a: string, b: string) => compatibilityAction(null, dates(a, b));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T23:30:00Z"));
  forwardedFor = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
});
afterEach(() => vi.useRealTimers());

describe("la Server Action de la calculadora", () => {
  it("'hoy' es la fecha UTC del servidor: acepta hoy y rechaza mañana", async () => {
    expect((await call("2024-06-15", "2000-03-21")).ok).toBe(true);
    expect((await call("2024-06-16", "2000-03-21")).ok).toBe(false);
  });

  it("al pasar la medianoche UTC, mañana pasa a ser hoy", async () => {
    vi.setSystemTime(new Date("2024-06-16T00:30:00Z"));
    expect((await call("2024-06-16", "2000-03-21")).ok).toBe(true);
  });

  it("calcula el resultado con los datos del dominio", async () => {
    const state = await call("2001-03-21", "2001-07-22");
    expect(state.ok && state.result.level).toBe("alta");
  });

  it("limita por IP (x-forwarded-for): la 31.ª consulta se bloquea", async () => {
    for (let i = 0; i < 30; i++) await call("1990-05-17", "2000-03-21");
    const blocked = await call("1990-05-17", "2000-03-21");
    expect(blocked.ok === false && blocked.message).toBe(RATE_LIMIT_ERROR);
  });

  it("sin cabecera de IP, todas comparten la clave 'unknown'", async () => {
    forwardedFor = null;
    for (let i = 0; i < 30; i++) await call("1990-05-17", "2000-03-21");
    expect((await call("1990-05-17", "2000-03-21")).ok).toBe(false);
  });
});
