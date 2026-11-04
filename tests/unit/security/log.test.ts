import { afterEach, describe, expect, it, vi } from "vitest";
import { recordSecurityEvent, setSecuritySink } from "@/lib/security/log";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  setSecuritySink(null);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("recordSecurityEvent", () => {
  it("entrega exactamente una línea JSON con la fecha, el nivel y el evento", () => {
    const lines: string[] = [];
    setSecuritySink((line) => lines.push(line));
    recordSecurityEvent({ event: "login_succeeded", user: USER });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(/[\r\n]/);
    const parsed = JSON.parse(lines[0] ?? "");
    expect(parsed).toMatchObject({ event: "login_succeeded", level: "info", user: USER });
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
  });

  it("un evento no válido no escribe nada y no lanza", () => {
    const sink = vi.fn();
    setSecuritySink(sink);
    expect(() => recordSecurityEvent({ event: "inventado" })).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("un sumidero que lanza una excepción no la propaga", () => {
    setSecuritySink(() => {
      throw new Error("disco lleno");
    });
    expect(() => recordSecurityEvent({ event: "login_failed", reason: "credentials" })).not.toThrow();
  });

  it("recibe también el nivel, para elegir el canal de salida", () => {
    const sink = vi.fn();
    setSecuritySink(sink);
    recordSecurityEvent({ event: "login_failed", reason: "credentials" });
    expect(sink).toHaveBeenCalledWith(expect.any(String), "warn");
  });

  it("en los tests, sin sumidero instalado, no escribe nada en la consola", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    recordSecurityEvent({ event: "login_failed", reason: "credentials" });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("fuera de los tests, por defecto escribe la línea en la consola (aviso o información)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    recordSecurityEvent({ event: "login_failed", reason: "credentials" });
    recordSecurityEvent({ event: "login_succeeded", user: USER });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({ event: "login_failed" });
  });
});
