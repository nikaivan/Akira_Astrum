import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { DISCLAIMER } from "../../lib/astrology/compatibility-data";
import { getCompatibility } from "../../lib/astrology/compatibility";
import { expect, randomIp, test } from "./support/fixtures";

// Los textos de la interfaz se escriben a propósito aquí y no se importan de la aplicación.
const LABEL_A = "Fecha de nacimiento de la primera persona";
const LABEL_B = "Fecha de nacimiento de la segunda persona";
const MISSING_A = "Indica la fecha de nacimiento de la primera persona.";
const MISSING_B = "Indica la fecha de nacimiento de la segunda persona.";
const INVALID = "Introduce una fecha real entre el 1 de enero de 1900 y hoy.";
const RATE_LIMIT = "Demasiadas consultas. Inténtalo de nuevo en unos minutos.";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Fechas de la sección 7 de astrologia-reglas.md (año 2001).
const ARIES = "2001-03-21";
const CANCER = "2001-06-21";
const LEO = "2001-07-22";

async function calculate(page: Page, a: string, b: string) {
  await page.getByLabel(LABEL_A).fill(a);
  await page.getByLabel(LABEL_B).fill(b);
  await page.getByRole("button", { name: "Calcular" }).click();
}

const result = (page: Page) => page.getByRole("region", { name: "Resultado" });
const form = (page: Page) => page.locator("form");

test.describe("calculadora de compatibilidad", () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto("/compatibilidad");
    expect(response?.status()).toBe(200);
  });

  test("es pública y tiene un formulario accesible, con el aviso visible", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel(LABEL_A)).toBeVisible();
    await expect(page.getByLabel(LABEL_B)).toBeVisible();
    await expect(page.getByLabel(LABEL_A)).toHaveAttribute("type", "date");
    await expect(page.getByLabel(LABEL_B)).toHaveAttribute("type", "date");
    await expect(page.getByRole("button", { name: "Calcular" })).toBeVisible();
    await expect(page.getByTestId("disclaimer")).toHaveCount(1);
    await expect(page.getByTestId("disclaimer")).toHaveText(DISCLAIMER);
    await expect(page.getByTestId("disclaimer")).toBeVisible();
  });

  test("es indexable: no lleva noindex", async ({ page }) => {
    const response = await page.goto("/compatibilidad");
    expect(response?.headers()["x-robots-tag"] ?? "").not.toMatch(/noindex/);
    const robots = await page.locator('meta[name="robots"]').evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")));
    expect(robots.join(",")).not.toMatch(/noindex/);
  });

  test("Aries y Leo (sección 7): compatibilidad Alta, con signos, elementos, explicación y aviso junto al resultado", async ({ page }) => {
    await calculate(page, ARIES, LEO);

    await expect(result(page)).toBeVisible();
    await expect(page.getByTestId("sign-a")).toContainText("Aries");
    await expect(page.getByTestId("sign-a")).toContainText("Fuego");
    await expect(page.getByTestId("sign-b")).toContainText("Leo");
    await expect(page.getByTestId("level")).toContainText("Alta");
    await expect(page.getByTestId("level").locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(page.getByTestId("explanation")).toHaveText(getCompatibility("Aries", "Leo").text);
    await expect(result(page).getByTestId("disclaimer")).toHaveText(DISCLAIMER);
    await expect(page.getByTestId("disclaimer")).toHaveCount(1);
  });

  test("Aries y Cáncer (sección 7): compatibilidad Baja", async ({ page }) => {
    await calculate(page, ARIES, CANCER);

    await expect(page.getByTestId("level")).toContainText("Baja");
    await expect(page.getByTestId("level").locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(page.getByTestId("sign-b")).toContainText("Cáncer");
    await expect(page.getByTestId("sign-b")).toContainText("Agua");
    await expect(page.getByTestId("explanation")).toHaveText(getCompatibility("Aries", "Cáncer").text);
  });

  test("al intercambiar las fechas, el nivel y la pareja de signos son los mismos", async ({ page }) => {
    await calculate(page, ARIES, LEO);
    await expect(page.getByTestId("level")).toContainText("Alta");
    const direct = await page.getByTestId("level").innerText();

    await calculate(page, LEO, ARIES);
    await expect(page.getByTestId("sign-a")).toContainText("Leo");
    await expect(page.getByTestId("sign-b")).toContainText("Aries");
    expect(await page.getByTestId("level").innerText()).toBe(direct);
  });

  test.describe("fechas inválidas", () => {
    test("campos vacíos: un error legible por campo y un resumen", async ({ page }) => {
      await page.getByRole("button", { name: "Calcular" }).click();

      for (const [label, message] of [
        [LABEL_A, MISSING_A],
        [LABEL_B, MISSING_B],
      ] as const) {
        const field = page.getByLabel(label);
        await expect(field).toHaveAttribute("aria-invalid", "true");
        const describedBy = await field.getAttribute("aria-describedby");
        expect(describedBy).toBeTruthy();
        await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(message);
      }
      await expect(form(page).getByRole("alert")).toBeVisible();
      await expect(page.getByLabel(LABEL_A)).toBeFocused();
      await expect(result(page)).toHaveCount(0);
    });

    for (const [name, value] of [
      ["futura", "2999-01-01"],
      ["anterior a 1900", "1899-12-31"],
    ] as const) {
      test(`fecha ${name}`, async ({ page }) => {
        await calculate(page, ARIES, value);
        const field = page.getByLabel(LABEL_B);
        await expect(field).toHaveAttribute("aria-invalid", "true");
        const describedBy = await field.getAttribute("aria-describedby");
        await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(INVALID);
        await expect(page.getByLabel(LABEL_A)).not.toHaveAttribute("aria-invalid", "true");
        await expect(field).toBeFocused();
        await expect(result(page)).toHaveCount(0);
      });
    }

    for (const [name, value] of [
      ["texto que no es fecha", "abc"],
      ["inexistente (30 de febrero)", "2023-02-30"],
      ["29 de febrero de un año no bisiesto", "2023-02-29"],
    ] as const) {
      test(`${name}: llega al servidor y se rechaza`, async ({ page }) => {
        // El campo nativo no deja escribir estos valores: se cambia a texto para llegar a la validación del servidor.
        await page.getByLabel(LABEL_A).evaluate((input: HTMLInputElement) => {
          input.type = "text";
        });
        await calculate(page, value, ARIES);

        const field = page.getByLabel(LABEL_A);
        await expect(field).toHaveAttribute("aria-invalid", "true");
        const describedBy = await field.getAttribute("aria-describedby");
        await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(INVALID);
        await expect(form(page).getByRole("alert")).toBeVisible();
        await expect(result(page)).toHaveCount(0);
        expect(await form(page).innerText()).not.toContain(value);
      });
    }
  });

  test("no deja rastro: ni URL, ni cookies, ni almacenamiento, ni peticiones a terceros", async ({ page, context, baseURL }) => {
    const origins = new Set<string>();
    page.on("request", (request) => {
      if (request.url().startsWith("http")) origins.add(new URL(request.url()).origin);
    });

    await calculate(page, "1990-05-17", "2000-03-21");
    await expect(result(page)).toBeVisible();

    const url = new URL(page.url());
    expect(url.pathname).toBe("/compatibilidad");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
    expect(await page.title()).not.toMatch(/1990|2000/);
  });

  test("la respuesta de la página y la de la acción llevan Cache-Control: no-store", async ({ page }) => {
    const pageResponse = await page.goto("/compatibilidad");
    expect(pageResponse?.headers()["cache-control"]).toMatch(/no-store/);

    const actionResponse = page.waitForResponse((response) => response.request().method() === "POST");
    await calculate(page, ARIES, LEO);
    expect((await actionResponse).headers()["cache-control"]).toMatch(/no-store/);
  });

  test("el teclado recorre los campos y el botón en orden, y Enter envía", async ({ page }) => {
    await page.getByLabel(LABEL_A).focus();
    await page.keyboard.type("21032001");
    const order: string[] = [];
    for (let i = 0; i < 14 && !order.includes("calculate"); i++) {
      await page.keyboard.press("Tab");
      const id = await page.evaluate(() => document.activeElement?.id ?? "");
      if (id === "birth-b" || id === "calculate") order.push(id);
      if (id === "birth-b" && order.filter((item) => item === "birth-b").length === 1) await page.keyboard.type("22072001");
    }
    expect(order[0]).toBe("birth-b");
    expect(order.at(-1)).toBe("calculate");
    await page.keyboard.press("Enter");
    await expect(result(page)).toBeVisible();
    await expect(page.getByTestId("level")).toContainText("Alta");
  });

  test("el foco es visible en los campos y el botón", async ({ page }) => {
    for (const locator of [page.getByLabel(LABEL_A), page.getByLabel(LABEL_B), page.getByRole("button", { name: "Calcular" })]) {
      await locator.focus();
      const visible = await locator.evaluate((element) => {
        const style = getComputedStyle(element);
        const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        return outline || style.boxShadow !== "none";
      });
      expect(visible).toBe(true);
    }
  });

  test("sin desplazamiento horizontal y con objetivos táctiles de al menos 44 px", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    for (const locator of [page.getByLabel(LABEL_A), page.getByLabel(LABEL_B), page.getByRole("button", { name: "Calcular" })]) {
      const box = await locator.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }

    await calculate(page, ARIES, LEO);
    await expect(result(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test.describe("accesibilidad (axe-core, WCAG 2 A y AA)", () => {
    const violations = async (page: Page) => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

    test("estado inicial", async ({ page }) => {
      expect(await violations(page)).toEqual([]);
    });

    test("con el resultado visible", async ({ page }) => {
      await calculate(page, ARIES, LEO);
      await expect(result(page)).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("con los errores visibles", async ({ page }) => {
      await page.getByRole("button", { name: "Calcular" }).click();
      await expect(form(page).getByRole("alert")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
});

test.describe("calculadora: casos que necesitan su propio contexto", () => {
  test("funciona sin JavaScript: se envía por POST y la URL no cambia", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      extraHTTPHeaders: { "x-forwarded-for": randomIp() },
    });
    const page = await context.newPage();
    await page.goto("/compatibilidad");

    const post = page.waitForRequest((request) => request.method() === "POST");
    await calculate(page, ARIES, LEO);
    expect((await post).url()).not.toContain("?");

    await expect(page.getByTestId("level")).toContainText("Alta");
    expect(new URL(page.url()).search).toBe("");
    await context.close();
  });

  test("tras 30 consultas desde la misma IP se bloquea la 31.ª; otra IP funciona", async ({ browser, baseURL }, testInfo) => {
    // Cada proyecto (escritorio/móvil) usa sus propias IPs: corren en paralelo contra el mismo servidor.
    const octet = testInfo.project.name === "mobile" ? 187 : 177;
    const open = async (ip: string) => {
      const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
      const page = await context.newPage();
      await page.goto("/compatibilidad");
      return { context, page };
    };

    const blocked = await open(`203.0.113.${octet}`);
    for (let i = 1; i <= 30; i++) {
      await calculate(blocked.page, ARIES, LEO);
      await expect(blocked.page.getByTestId("level")).toContainText("Alta");
    }
    await calculate(blocked.page, ARIES, LEO);
    await expect(form(blocked.page).getByRole("alert")).toHaveText(RATE_LIMIT);
    await expect(result(blocked.page)).toHaveCount(0);
    await blocked.context.close();

    const other = await open(`203.0.113.${octet + 1}`);
    await calculate(other.page, ARIES, LEO);
    await expect(other.page.getByTestId("level")).toContainText("Alta");
    await other.context.close();
  });
});
