import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { addSessionCookies } from "./support/session-cookies";

// PWA mínima (Fase 3, D). El service worker solo sirve /offline sin conexión y no guarda nada de la intranet.
const PRECACHE = ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/offline", "/offline.css"];
const LABEL_A = "Fecha de nacimiento de la primera persona";
const LABEL_B = "Fecha de nacimiento de la segunda persona";

/** Espera a que el service worker esté activo y controlando la página. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

/** Rutas de todo lo que hay en las cachés del navegador. */
async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths.sort();
  });
}

test.describe("manifiesto, iconos y cabecera", () => {
  test("el manifiesto es válido y todos sus iconos se descargan como PNG", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: "Akira Astrum", display: "standalone", start_url: "/", theme_color: "#0B1026", background_color: "#FBF8F3" });
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons as { src: string }[]) {
      const image = await request.get(icon.src);
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("la página declara el manifiesto, el color de tema, viewport-fit=cover y el icono de iOS", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#0B1026");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});

test.describe("service worker", () => {
  test("/sw.js se revalida siempre, se sirve como JavaScript y lleva CSP", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-cache");
    expect(response.headers()["content-type"]).toContain("javascript");
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  });

  test("se registra y se activa sin violaciones de CSP, y solo precachea lo previsto", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy|refused to/i.test(message.text())) violations.push(message.text());
    });
    await page.goto("/");
    await waitForServiceWorker(page);
    expect(await cachedPaths(page)).toEqual(PRECACHE);
    expect(violations).toEqual([]);
  });

  test("sin conexión se muestra la página /offline y al volver la red vuelve el blog", async ({ page, context }) => {
    await page.goto("/");
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeVisible();
    await expect(page.getByRole("link", { name: /portada/i })).toBeVisible();

    await context.setOffline(false);
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toHaveCount(0);
  });

  test("la intranet nunca se guarda: la caché no contiene /admin ni /login y sin conexión /admin no muestra contenido", async ({ page, context, users }) => {
    await addSessionCookies(context, users.admin.email, users.admin.password);
    await page.goto("/admin");
    await waitForServiceWorker(page);
    await page.goto("/admin/posts/new");
    await page.goto("/admin/categorias");
    await page.goto("/login");

    const paths = await cachedPaths(page);
    expect(paths.filter((path) => /^\/(admin|login)/i.test(path))).toEqual([]);
    expect(paths).toEqual(PRECACHE);

    await context.setOffline(true);
    await expect(page.goto("/admin")).rejects.toThrow();
    await expect(page.goto("/admin/posts/new")).rejects.toThrow();
    await context.setOffline(false);
  });

  test("la calculadora (Server Action) funciona con el service worker y no deja nada en la caché", async ({ page }) => {
    await page.goto("/compatibilidad");
    await waitForServiceWorker(page);
    await page.getByLabel(LABEL_A).fill("2001-03-21");
    await page.getByLabel(LABEL_B).fill("2001-07-22");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page.getByRole("region", { name: "Resultado" })).toBeVisible();
    expect(await cachedPaths(page)).toEqual(PRECACHE);
  });
});
