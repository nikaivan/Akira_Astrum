import type { Page } from "@playwright/test";
import { REAL_PNG } from "./support/cover-images";
import { expect, test } from "./support/fixtures";
import { addSessionCookies } from "./support/session-cookies";

// Cabeceras reales y CSP (A02). El servidor de e2e es `next dev`, donde React necesita 'unsafe-eval': aquí solo se
// exige lo que vale también en desarrollo. La política estricta de producción se comprueba con `next build` + `next start`.
const PUBLIC_PAGES = ["/", "/blog", "/compatibilidad", "/login", "/ruta-que-no-existe"];
const LABEL_A = "Fecha de nacimiento de la primera persona";
const LABEL_B = "Fecha de nacimiento de la segunda persona";

const directive = (policy: string, name: string) =>
  policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([head]) => head === name)
    ?.slice(1) ?? [];

/** Recoge las violaciones de CSP del navegador (evento y mensajes de consola) para comprobarlas al final. */
async function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (load|execute|apply|connect)/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const list = ((window as unknown as { __csp?: string[] }).__csp ??= []);
      list.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  return async () => {
    const fromEvents = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
    return [...violations, ...fromEvents];
  };
}

test.describe("cabeceras de seguridad reales", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} lleva CSP y las cabeceras estáticas, sin X-Powered-By`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();
      const csp = headers["content-security-policy"] ?? "";

      expect(csp).toContain("default-src 'self'");
      expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
      expect(directive(csp, "script-src").some((source) => source.startsWith("'nonce-"))).toBe(true);
      expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
      expect(directive(csp, "object-src")).toEqual(["'none'"]);
      expect(directive(csp, "img-src")).toEqual(expect.arrayContaining(["'self'", "blob:"]));
      expect(directive(csp, "img-src")).not.toContain("data:");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["x-powered-by"]).toBeUndefined();
    });
  }

  test("el nonce de la cabecera es el de los scripts del HTML y cambia en cada petición", async ({ request }) => {
    const nonces: string[] = [];
    for (let i = 0; i < 2; i++) {
      const response = await request.get("/blog");
      const nonce = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "")?.[1];
      expect(nonce).toBeTruthy();
      expect(await response.text()).toContain(`nonce="${nonce}"`);
      nonces.push(nonce ?? "");
    }
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  test("/admin sin sesión redirige a /login con CSP y sin caché", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["cache-control"]).toMatch(/no-store/);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("sin violaciones de CSP en el navegador", () => {
  test("pantallas públicas: portada, blog, entrada con imagen del Storage, categoría, calculadora, login y 404", async ({ page, blog }) => {
    const violations = await watchCsp(page);
    for (const path of ["/", "/blog", `/blog/${blog.rich.slug}`, `/categorias/${blog.category.slug}`, "/compatibilidad", "/login", "/ruta-que-no-existe"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(await violations()).toEqual([]);
  });

  test("la entrada con portada carga la imagen del Storage (img-src la admite)", async ({ page, blog }) => {
    const violations = await watchCsp(page);
    await page.goto(`/blog/${blog.rich.slug}`);
    const cover = page.locator("main img").first();
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await violations()).toEqual([]);
  });

  test("la calculadora funciona con la CSP: se envía el formulario y aparece el resultado", async ({ page }) => {
    const violations = await watchCsp(page);
    await page.goto("/compatibilidad");
    await page.getByLabel(LABEL_A).fill("2001-03-21");
    await page.getByLabel(LABEL_B).fill("2001-07-22");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByRole("region", { name: "Resultado" })).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  test("intranet: panel, editor y vista previa blob: de la portada", async ({ page, users }) => {
    const violations = await watchCsp(page);
    await addSessionCookies(page.context(), users.admin.email, users.admin.password);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await page.goto("/admin/posts/new");
    await page.getByLabel("Imagen de portada").setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: REAL_PNG });
    const preview = page.locator("img[src^='blob:']");
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await violations()).toEqual([]);
  });
});
