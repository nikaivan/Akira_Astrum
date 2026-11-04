import { afterEach, describe, expect, it, vi } from "vitest";
import { clientId } from "@/lib/security/client-id";

afterEach(() => vi.resetModules());

describe("clientId", () => {
  it("tiene 12 caracteres hexadecimales", () => {
    expect(clientId("203.0.113.5")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("la misma IP da siempre el mismo identificador en una instancia", () => {
    expect(clientId("203.0.113.5")).toBe(clientId("203.0.113.5"));
  });

  it("IPs distintas dan identificadores distintos", () => {
    const ids = new Set(Array.from({ length: 200 }, (_, i) => clientId(`198.51.100.${i}`)));
    expect(ids.size).toBe(200);
  });

  it("no contiene la IP ni sus partes", () => {
    const id = clientId("203.0.113.5");
    expect(id).not.toContain("203");
    expect(id).not.toContain("113");
  });

  it("admite IPv6 y el valor 'unknown' sin lanzar", () => {
    expect(clientId("2001:db8::1")).toMatch(/^[0-9a-f]{12}$/);
    expect(clientId("unknown")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("la sal cambia en cada arranque: otra instancia da otro identificador", async () => {
    const first = clientId("203.0.113.5");
    vi.resetModules();
    const { clientId: again } = await import("@/lib/security/client-id");
    expect(again("203.0.113.5")).not.toBe(first);
  });
});
