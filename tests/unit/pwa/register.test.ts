import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "@/lib/pwa/register";

describe("registerServiceWorker", () => {
  it("registra /sw.js con alcance / y sin caché HTTP del propio archivo", async () => {
    const register = vi.fn().mockResolvedValue({});
    await registerServiceWorker({ serviceWorker: { register } });
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("si el navegador no admite service workers, no hace nada ni lanza", async () => {
    await expect(registerServiceWorker({})).resolves.toBeUndefined();
    await expect(registerServiceWorker(undefined)).resolves.toBeUndefined();
  });

  it("si el registro se rechaza, el error no sale (la web funciona igual sin service worker)", async () => {
    const register = vi.fn().mockRejectedValue(new Error("SecurityError"));
    await expect(registerServiceWorker({ serviceWorker: { register } })).resolves.toBeUndefined();
  });

  it("si el registro lanza de forma síncrona, tampoco sale", async () => {
    const register = vi.fn(() => {
      throw new Error("boom");
    });
    await expect(registerServiceWorker({ serviceWorker: { register } })).resolves.toBeUndefined();
  });
});
