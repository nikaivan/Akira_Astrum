import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { setE2EPostPublished } from "./support/service-role";
import { addSessionCookies } from "./support/session-cookies";

// Los textos de la interfaz se escriben a propósito aquí y no se importan de la aplicación.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SITE = "Akira Astrum";
const EMPTY_CATEGORY = "Todavía no hay entradas en esta categoría.";

const WEIRD_SLUGS = [
  "..%2F..%2Fetc%2Fpasswd",
  "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
  "MAYUSCULAS",
  "a--b",
  "-empieza",
  "a".repeat(81),
  "con%20espacios",
  "%00",
  "%27%3B%20drop%20table%20posts%3B%20--",
];

const cardOf = (page: Page, title: string): Locator =>
  page.locator("article", { has: page.getByRole("link", { name: title, exact: true }) });
const titleLink = (page: Page, title: string) => page.getByRole("link", { name: title, exact: true });
const cardTitles = (page: Page) => page.locator("article h2 a, article h3 a").allInnerTexts();
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const mainText = (page: Page) => page.locator("main").innerText();

async function expectNotFound(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBe(404);
  return mainText(page);
}

// ◇ No necesita datos: un slug raro se rechaza antes de consultar la base de datos.
test.describe("slugs raros (sin datos)", () => {
  test("devuelven 404 con el mismo mensaje y sin eco del slug", async ({ page }) => {
    const bodies: string[] = [];
    for (const slug of WEIRD_SLUGS) {
      bodies.push(await expectNotFound(page, `/blog/${slug}`));
      bodies.push(await expectNotFound(page, `/categorias/${slug}`));
    }
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).not.toMatch(/script|passwd|MAYUSCULAS|drop table/i);
    expect(bodies[0].trim()).not.toBe("");
  });
});

test.describe("blog público", () => {
  test("la portada lista solo las publicadas, por fecha, con imagen, título, categoría, fecha y tiempo de lectura", async ({ page, blog }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(SITE);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SITE);

    await expect(titleLink(page, blog.plain.title)).toBeVisible();
    await expect(titleLink(page, blog.rich.title)).toBeVisible();
    for (const hidden of [blog.draft, blog.unpublished, blog.draftInDraftsOnly]) {
      await expect(page.getByText(hidden.title)).toHaveCount(0);
    }

    const titles = await cardTitles(page);
    expect(titles.indexOf(blog.plain.title)).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf(blog.plain.title)).toBeLessThan(titles.indexOf(blog.rich.title)); // la más nueva primero

    const rich = cardOf(page, blog.rich.title);
    await expect(rich.getByRole("link", { name: blog.category.name })).toBeVisible();
    await expect(rich.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
    await expect(rich.locator("time")).toHaveText(/^\d{1,2} de [a-záéíóú]+ de \d{4}$/);
    await expect(rich).toContainText(/\d+ min de lectura/);
    await expect(rich.locator('img[alt=""]')).toHaveCount(1);
    await rich.scrollIntoViewIfNeeded();
    await expect.poll(() => rich.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(cardOf(page, blog.plain.title).locator("img")).toHaveCount(0);
  });

  test("/blog lista las publicadas con un único h1", async ({ page, blog }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(titleLink(page, blog.plain.title)).toBeVisible();
    await expect(titleLink(page, blog.rich.title)).toBeVisible();
    await expect(page.getByText(blog.draft.title)).toHaveCount(0);
    await expect(page.getByText(blog.unpublished.title)).toHaveCount(0);
  });

  test("flujo: portada → entrada → volver → categoría", async ({ page, blog }) => {
    await page.goto("/");
    await titleLink(page, blog.rich.title).click();
    await expect(page).toHaveURL((url) => url.pathname === `/blog/${blog.rich.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(blog.rich.title);
    // El contenido baja un nivel: «## Sección legítima» sale como h3 (el único h1 es el título de la entrada).
    await expect(page.locator("article").getByRole("heading", { level: 3, name: "Sección legítima" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(titleLink(page, blog.rich.title)).toBeVisible();

    await cardOf(page, blog.rich.title).getByRole("link", { name: blog.category.name }).click();
    await expect(page).toHaveURL((url) => url.pathname === `/categorias/${blog.category.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(blog.category.name);
    expect(await cardTitles(page)).toEqual([blog.plain.title, blog.rich.title]); // solo las publicadas, por fecha
  });

  test("borrador, despublicada y slug inexistente dan el mismo 404, sin revelar nada", async ({ page, blog }) => {
    const bodies = [
      await expectNotFound(page, `/blog/${blog.draft.slug}`),
      await expectNotFound(page, `/blog/${blog.unpublished.slug}`),
      await expectNotFound(page, `/blog/${blog.prefix}-no-existe`),
    ];
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).not.toContain(blog.draft.title);
    expect(bodies[0]).not.toContain(blog.draft.slug);
    expect(bodies[0]).not.toContain("Contenido secreto");
  });

  test("categoría inexistente: 404; categoría con solo borradores: 200 vacía", async ({ page, blog }) => {
    await expectNotFound(page, `/categorias/${blog.prefix}-nada`);

    const response = await page.goto(`/categorias/${blog.draftsOnlyCategory.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(blog.draftsOnlyCategory.name);
    await expect(page.getByText(EMPTY_CATEGORY)).toBeVisible();
    await expect(page.getByText(blog.draftInDraftsOnly.title)).toHaveCount(0);
  });

  test("con la sesión del admin abierta, el borrador sigue siendo invisible", async ({ page, context, blog, users }) => {
    await addSessionCookies(context, users.admin.email, users.admin.password);

    await expectNotFound(page, `/blog/${blog.draft.slug}`);
    await page.goto("/");
    await expect(page.getByText(blog.draft.title)).toHaveCount(0);
    await page.goto(`/categorias/${blog.category.slug}`);
    expect(await cardTitles(page)).toEqual([blog.plain.title, blog.rich.title]);
  });

  test("sin caché: publicar y despublicar tienen efecto al recargar", async ({ page, blog }) => {
    try {
      await setE2EPostPublished(blog.unpublished.id, true);
      const published = await page.goto(`/blog/${blog.unpublished.slug}`);
      expect(published?.status()).toBe(200);
      await page.goto("/blog");
      await expect(titleLink(page, blog.unpublished.title)).toBeVisible();

      await setE2EPostPublished(blog.unpublished.id, false);
      expect((await page.goto(`/blog/${blog.unpublished.slug}`))?.status()).toBe(404);
      await page.goto("/blog");
      await expect(page.getByText(blog.unpublished.title)).toHaveCount(0);
      await page.goto("/");
      await expect(page.getByText(blog.unpublished.title)).toHaveCount(0);
    } finally {
      await setE2EPostPublished(blog.unpublished.id, false);
    }
  });

  test("todas las páginas llevan Cache-Control: no-store y siguen siendo indexables", async ({ page, blog }) => {
    for (const path of ["/", "/blog", `/blog/${blog.plain.slug}`, `/categorias/${blog.category.slug}`]) {
      const response = await page.goto(path);
      expect(response?.headers()["cache-control"], path).toMatch(/no-store/);
      expect(response?.headers()["x-robots-tag"] ?? "", path).not.toMatch(/noindex/);
    }
  });

  test("sanitizado en el navegador: no se ejecuta ni se conserva nada del contenido hostil", async ({ page, blog }) => {
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await page.goto(`/blog/${blog.rich.slug}`);
    await page.waitForTimeout(500);
    const article = page.locator("article");

    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(article.locator("iframe, script, object, embed, form")).toHaveCount(0);
    // next/image escribe su propio style en sus <img>; cualquier otro elemento con style o manejador sería contenido sin sanear.
    await expect(article.locator('[onerror], [onclick], [onload], [style]:not(img[data-nimg]), a[href^="javascript" i]')).toHaveCount(0);

    const external = article.getByRole("link", { name: "enlace externo" });
    await expect(external).toHaveAttribute("href", "https://example.com/pagina");
    await expect(external).toHaveAttribute("rel", "noopener noreferrer");
    await expect(external).toHaveAttribute("target", "_blank");
    await expect(article.getByText("trampa")).toBeVisible(); // el enlace javascript: queda como texto
    await expect(article.getByRole("link", { name: "trampa" })).toHaveCount(0);

    await expect(article.locator('img[src*="example.com"]')).toHaveCount(0); // imagen externa descartada
    const photo = article.getByRole("img", { name: "Foto del proyecto" });
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });

  test("metadatos: título con «| Akira Astrum», descripción y un único h1 en cada página", async ({ page, blog }) => {
    await page.goto(`/blog/${blog.rich.slug}`);
    await expect(page).toHaveTitle(`${blog.rich.title} | ${SITE}`);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description?.length ?? 0).toBeGreaterThan(0);
    expect(description).not.toMatch(/[<>]/);

    await page.goto(`/categorias/${blog.category.slug}`);
    await expect(page).toHaveTitle(`${blog.category.name} | ${SITE}`);
    await page.goto("/blog");
    await expect(page).toHaveTitle(`Blog | ${SITE}`);

    for (const path of ["/", "/blog", `/blog/${blog.plain.slug}`, `/categorias/${blog.category.slug}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });

  test("responsive: sin desplazamiento horizontal, ancho de lectura cómodo y objetivos táctiles de 44 px", async ({ page, blog }) => {
    await page.goto(`/blog/${blog.plain.slug}`);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const pre = page.locator("article pre").first();
    expect(await pre.evaluate((element) => getComputedStyle(element).overflowX)).toMatch(/auto|scroll/); // el código se desplaza dentro de su caja
    const paragraph = page.locator("article p", { hasText: "Un párrafo normal" });
    expect((await paragraph.boundingBox())?.width ?? Infinity).toBeLessThanOrEqual(760); // ~70 caracteres

    await page.goto("/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const targets = [
      ...(await page.getByRole("navigation").getByRole("link").all()),
      titleLink(page, blog.plain.title),
      cardOf(page, blog.plain.title).getByRole("link", { name: blog.category.name }),
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.goto(`/categorias/${blog.category.slug}`);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("teclado: Tab llega a las tarjetas en orden, el foco se ve y Enter abre la entrada", async ({ page, blog }) => {
    await page.goto("/");
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate((title) => document.activeElement?.textContent?.trim() === title, blog.plain.title);
    }
    expect(reached).toBe(true);

    const visible = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
    });
    expect(visible).toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((url) => url.pathname === `/blog/${blog.plain.slug}`);
  });

  test.describe("accesibilidad (axe-core, WCAG 2 A y AA)", () => {
    const violations = async (page: Page) => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

    test("portada", async ({ page, blog }) => {
      await page.goto("/");
      await expect(titleLink(page, blog.plain.title)).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("listado", async ({ page, blog }) => {
      await page.goto("/blog");
      await expect(titleLink(page, blog.plain.title)).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("entrada (con contenido variado)", async ({ page, blog }) => {
      await page.goto(`/blog/${blog.rich.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(blog.rich.title);
      expect(await violations(page)).toEqual([]);
    });

    test("entrada (con palabras largas y código)", async ({ page, blog }) => {
      await page.goto(`/blog/${blog.plain.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(blog.plain.title);
      expect(await violations(page)).toEqual([]);
    });

    test("categoría", async ({ page, blog }) => {
      await page.goto(`/categorias/${blog.category.slug}`);
      await expect(titleLink(page, blog.plain.title)).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("categoría vacía", async ({ page, blog }) => {
      await page.goto(`/categorias/${blog.draftsOnlyCategory.slug}`);
      await expect(page.getByText(EMPTY_CATEGORY)).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("página 404", async ({ page, blog }) => {
      await page.goto(`/blog/${blog.prefix}-no-existe`);
      expect(await violations(page)).toEqual([]);
    });
  });
});
