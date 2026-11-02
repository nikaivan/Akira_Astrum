import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateCompatibility } from "@/lib/compatibility/calculate";
import { createCompatibilityLimiter } from "@/lib/compatibility/limiter";
import { dates, TODAY } from "./support";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const DATE_A = "1990-05-17";
const DATE_B = "2000-03-21";

// Si la calculadora usara Supabase, estos módulos fallarían al importarse o usarse.
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => {
    throw new Error("la calculadora no debe usar Supabase");
  },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    throw new Error("la calculadora no debe usar Supabase");
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function watchEverything() {
  const consoles = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
  const forbidden = () => {
    throw new Error("la calculadora no debe usar red ni almacenamiento");
  };
  const storage = { getItem: vi.fn(forbidden), setItem: vi.fn(forbidden), removeItem: vi.fn(forbidden), clear: vi.fn(forbidden) };
  const fetchSpy = vi.fn(forbidden);
  const beacon = vi.fn(forbidden);
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("XMLHttpRequest", vi.fn(forbidden));
  vi.stubGlobal("WebSocket", vi.fn(forbidden));
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("navigator", { sendBeacon: beacon });
  return { consoles, storage, fetchSpy, beacon };
}

describe("la calculadora no guarda, registra ni envía las fechas", () => {
  const scenarios: [string, () => ReturnType<typeof calculateCompatibility>][] = [
    ["un cálculo correcto", () => run(DATE_A, DATE_B)],
    ["fechas inválidas", () => run("2023-02-30", "abc")],
    ["campos vacíos", () => run("", "")],
    ["una IP bloqueada", async () => {
      const limiter = createCompatibilityLimiter();
      for (let i = 0; i < 30; i++) limiter.recordFailure("203.0.113.9");
      return calculateCompatibility({ formData: dates(DATE_A, DATE_B), today: TODAY, limiter, ip: "203.0.113.9" });
    }],
  ];

  function run(a: string, b: string) {
    return calculateCompatibility({
      formData: dates(a, b),
      today: TODAY,
      limiter: createCompatibilityLimiter(),
      ip: "203.0.113.9",
    });
  }

  it.each(scenarios)("%s: ni consola, ni red, ni almacenamiento, ni Supabase", async (_caso, scenario) => {
    const watch = watchEverything();
    await scenario();

    for (const spy of watch.consoles) expect(spy).not.toHaveBeenCalled();
    expect(watch.fetchSpy).not.toHaveBeenCalled();
    expect(watch.beacon).not.toHaveBeenCalled();
    for (const spy of Object.values(watch.storage)) expect(spy).not.toHaveBeenCalled();
  });

  it("la respuesta de un cálculo no contiene las fechas escritas", async () => {
    const state = await run(DATE_A, DATE_B);
    expect(JSON.stringify(state)).not.toMatch(/1990|2000-03|05-17/);
  });

  it("la respuesta de un error no repite las fechas escritas", async () => {
    const state = await run("2023-02-30", "<script>1999-12-31</script>");
    expect(JSON.stringify(state)).not.toMatch(/2023|1999|script/);
  });
});
