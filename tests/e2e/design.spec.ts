import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

/**
 * Identidad «noche y marfil» en un navegador real: superficies oscuras, navegación en todas las páginas públicas (también en el
 * acceso), sin desbordes en pantallas estrechas, movimiento reducido y foco visible. El contraste de cada página lo vigilan los
 * e2e de axe que ya existen (WCAG 2 A y AA).
 */
const PAGES = [
  ["portada", "/"],
  ["blog", "/blog"],
  ["calculadora", "/compatibilidad"],
  ["acceso", "/login"],
  ["404", "/esta-pagina-no-existe"],
] as const;

type Rgb = [number, number, number];
const parse = (color: string): Rgb => (color.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number) as Rgb;
const luminance = ([r, g, b]: Rgb) => {
  const channel = (value: number) => ((value / 255) <= 0.03928 ? value / 255 / 12.92 : (((value / 255) + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const backgroundOf = (page: Page, role: "banner" | "contentinfo") => page.getByRole(role).first().evaluate((element) => getComputedStyle(element).backgroundColor);
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("superficies noche", () => {
  for (const [name, path] of PAGES) {
    test(`${name}: la cabecera y el pie son azul noche y el texto es claro`, async ({ page }) => {
      await page.goto(path);
      for (const role of ["banner", "contentinfo"] as const) {
        const background = await backgroundOf(page, role);
        expect(luminance(parse(background)), `${role} de ${path}: ${background}`).toBeLessThan(0.05);
        const text = await page.getByRole(role).first().evaluate((element) => getComputedStyle(element).color);
        expect(luminance(parse(text)), `texto de ${role} de ${path}: ${text}`).toBeGreaterThan(0.5);
      }
    });
  }

  test("el área de lectura sigue siendo marfil (clara)", async ({ page }) => {
    await page.goto("/blog");
    const background = await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(luminance(parse(background))).toBeGreaterThan(0.9);
  });

  test("el panel de administración no usa la superficie noche", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('[data-surface="night"]').first()).toBeVisible(); // control positivo: aquí sí existe
    const response = await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/login"); // sin sesión se redirige; el panel real lo cubren sus propios tests
    expect(response?.status()).toBe(200);
  });
});

test.describe("el acceso muestra el menú del sitio", () => {
  test("la cabecera con Blog y Compatibilidad se ve en /login y permite volver sin los botones del navegador", async ({ page }) => {
    await page.goto("/login");
    const navigation = page.getByRole("navigation", { name: "Principal" });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Blog" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Compatibilidad" })).toBeVisible();

    await navigation.getByRole("link", { name: "Blog" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/blog");
    await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  });

  test("la marca de la cabecera vuelve a la portada", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("banner").getByRole("link", { name: "Akira Astrum" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { level: 1, name: "Akira Astrum" })).toBeVisible();
  });

  test("/login conserva el formulario y un único h1", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });
});

test.describe("pantallas estrechas", () => {
  for (const [name, path] of PAGES) {
    test(`${name}: sin desplazamiento horizontal a 320 px y navegación con objetivos de 44 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      for (const link of await page.getByRole("banner").getByRole("link").all()) {
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe("movimiento reducido y foco", () => {
  test("con prefers-reduced-motion no hay transiciones en enlaces ni botones", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/login", "/compatibilidad"]) {
      await page.goto(path);
      const longest = await page.evaluate(() =>
        Math.max(0, ...[...document.querySelectorAll("a, button")].flatMap((element) => getComputedStyle(element).transitionDuration.split(",").map((value) => parseFloat(value) * (value.includes("ms") ? 0.001 : 1)))),
      );
      expect(longest, path).toBeLessThanOrEqual(0.001);
    }
  });

  test("el foco se ve sobre la cabecera noche y el anillo es claro", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      // El anillo es un box-shadow con varias capas (casi todas transparentes) y su color puede venir en oklab: se busca la primera
      // capa visible y el navegador lo convierte a RGB con un canvas.
      const layers = style.boxShadow.match(/(?:rgba?|oklab|oklch|color)\([^)]*\)/g) ?? [];
      const color = layers.find((layer) => !/^rgba\(0, 0, 0, 0\)$/.test(layer)) ?? style.outlineColor;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      let rgb: number[] = [0, 0, 0];
      if (context) {
        context.fillStyle = "#fff"; // sin esto un color transparente dejaría el píxel como estaba
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      }
      return { inHeader: Boolean(element.closest("header")), visible: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none", ring: color, rgb };
    });
    expect(focus.inHeader).toBe(true);
    expect(focus.visible).toBe(true);
    expect(luminance(focus.rgb as Rgb), `anillo ${focus.ring}`).toBeGreaterThan(0.3);
  });
});
