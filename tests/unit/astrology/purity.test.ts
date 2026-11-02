/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBirthDate } from "@/lib/astrology/birth-date";
import { getCompatibility } from "@/lib/astrology/compatibility";
import { getSunSign } from "@/lib/astrology/sun-sign";

const TODAY = "2026-11-02";
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("lógica pura: nada se guarda ni se registra", () => {
  it("el flujo completo no registra ni envía datos", () => {
    const spies = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const a = getSunSign(parseBirthDate("1990-05-15", TODAY));
    const b = getSunSign(parseBirthDate("2000-03-21", TODAY));
    getCompatibility(a, b);

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(["1990-02-30", "abc", "2999-01-01", "<script>alert(1)</script>"])(
    "el error de la fecha %j no la filtra",
    (entrada) => {
      let message = "";
      try {
        parseBirthDate(entrada, TODAY);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(entrada);
    },
  );
});

const SOURCES = import.meta.glob("/lib/astrology/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

describe("código fuente de lib/astrology", () => {
  it("contiene los cinco módulos esperados", () => {
    const names = Object.keys(SOURCES).map((path) => path.split("/").pop());
    expect(names.sort()).toEqual(
      ["birth-date.ts", "compatibility-data.ts", "compatibility.ts", "signs.ts", "sun-sign.ts"].sort(),
    );
  });

  const PROHIBIDOS: [string, RegExp][] = [
    ["imports de Supabase, Next o Node", /from\s+["'](@supabase|@\/lib\/supabase|next\/|node:)/],
    ["red o almacenamiento", /\b(fetch|localStorage|sessionStorage|XMLHttpRequest)\b/],
    ["registro por consola", /\bconsole\b/],
    ["variables de entorno", /\bprocess\.env\b/],
    ["fechas del sistema y zona horaria (D10)", /\bDate\b|getTimezoneOffset|toISOString|toLocale/],
  ];

  it.each(PROHIBIDOS)("no usa %s", (_motivo, patron) => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
    for (const source of Object.values(SOURCES)) {
      expect(source).not.toMatch(patron);
    }
  });
});
