import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { installCapture, lastCaptured, type Captured } from "./support/action-capture";

// ZAP baseline (Fase 3, E): «Absence of Anti-CSRF Tokens» en los formularios y «Cross-Origin-Resource-Policy» en los chunks.
// Los formularios usan Server Actions, que solo aceptan una petición si su `Origin` coincide con el `Host`; aquí se fija ese
// comportamiento con peticiones reales, y la política de recursos con las respuestas reales.
const LABEL_A = "Fecha de nacimiento de la primera persona";
const LABEL_B = "Fecha de nacimiento de la segunda persona";
const FOREIGN_ORIGINS = ["https://evil.example", "null", "http://localhost:9999"];

/** Reenvía una Server Action capturada con otro Origin (y, si se pide, con otros valores de texto). */
function replayWithOrigin(request: APIRequestContext, url: string, captured: Captured, origin: string, overrides: Record<string, string> = {}) {
  const multipart = new FormData();
  for (const entry of captured.entries) {
    const override = Object.entries(overrides).find(([suffix]) => entry.name.endsWith(suffix));
    multipart.append(entry.name, override ? override[1] : (entry.text ?? ""));
  }
  const headers = Object.fromEntries(Object.entries(captured.headers).filter(([name]) => !["content-type", "content-length"].includes(name.toLowerCase())));
  return request.post(url, { headers: { ...headers, origin }, multipart, failOnStatusCode: false, maxRedirects: 0 });
}

test.describe("las Server Actions rechazan un Origin ajeno (CSRF)", () => {
  test("calculadora: con su origen responde y con un origen ajeno se aborta sin devolver nada", async ({ page, request, baseURL }) => {
    await installCapture(page);
    await page.goto("/compatibilidad");
    await page.getByLabel(LABEL_A).fill("2001-03-21");
    await page.getByLabel(LABEL_B).fill("2001-07-22");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByRole("region", { name: "Resultado" })).toBeVisible();

    const captured = await lastCaptured(page);
    const url = new URL(captured.url, baseURL).href;

    // Control: la misma petición con el origen propio funciona, así que el rechazo de abajo es por el origen y no por el reenvío.
    const own = await replayWithOrigin(request, url, captured, new URL(baseURL as string).origin);
    expect(own.status()).toBe(200);

    for (const origin of FOREIGN_ORIGINS) {
      const foreign = await replayWithOrigin(request, url, captured, origin);
      expect(foreign.status(), origin).toBeGreaterThanOrEqual(400);
      expect(await foreign.text(), origin).not.toBe(await own.text());
      expect(foreign.headers()["set-cookie"], origin).toBeUndefined();
    }
  });

  test("acceso: con credenciales correctas y un origen ajeno no se abre sesión ni se envía ninguna cookie", async ({ page, request, baseURL, users }) => {
    await installCapture(page);
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill("nadie@example.com");
    await page.getByLabel("Contraseña").fill("una-clave-cualquiera-1");
    await page.getByRole("button", { name: /entrar|acceder|iniciar/i }).click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();

    const captured = await lastCaptured(page);
    const url = new URL(captured.url, baseURL).href;
    const credentials = { email: users.admin.email, password: users.admin.password };

    const own = await replayWithOrigin(request, url, captured, new URL(baseURL as string).origin, credentials);
    expect(own.status()).toBeLessThan(400);
    expect(own.headers()["set-cookie"]).toBeDefined();

    for (const origin of FOREIGN_ORIGINS) {
      const foreign = await replayWithOrigin(request, url, captured, origin, credentials);
      expect(foreign.status(), origin).toBeGreaterThanOrEqual(400);
      expect(foreign.headers()["set-cookie"], origin).toBeUndefined();
    }
  });
});

test.describe("política de recursos de origen cruzado", () => {
  test("el HTML, los chunks de _next/static y los iconos llevan Cross-Origin-Resource-Policy: same-origin", async ({ request }) => {
    const page = await request.get("/");
    expect(page.headers()["cross-origin-resource-policy"]).toBe("same-origin");

    const chunk = /src="(\/_next\/static\/[^"]+\.js)"/.exec(await page.text())?.[1];
    expect(chunk, "el HTML enlaza algún chunk de _next/static").toBeTruthy();
    expect((await request.get(chunk as string)).headers()["cross-origin-resource-policy"]).toBe("same-origin");
    expect((await request.get("/icon-192.png")).headers()["cross-origin-resource-policy"]).toBe("same-origin");
  });

  test("no se activa Cross-Origin-Embedder-Policy (se acepta el aviso bajo de ZAP) y sigue Cross-Origin-Opener-Policy", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  });
});
