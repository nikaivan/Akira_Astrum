import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { installCapture, lastCaptured, replay } from "./support/action-capture";
import { MIB, pngOfSize, REAL_PNG, svgOfSize } from "./support/cover-images";
import {
  countE2E,
  createE2EUser,
  deleteE2EByPrefix,
  deleteE2EUser,
  e2eObjectServed,
  findE2EObjectsBySize,
  getE2EContent,
  newE2EPrefix,
  removeE2EObjects,
} from "./support/service-role";
import { addSessionCookies, createSessionCookies } from "./support/session-cookies";

// Los textos de la interfaz se escriben a propósito aquí y no se importan de la aplicación.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const INVALID_TYPE = "La imagen debe ser JPEG, PNG o WebP.";
const TOO_LARGE = "La imagen no puede superar los 2 MB.";
const ALT_REQUIRED = "El texto alternativo de la imagen es obligatorio.";
const FILE_REQUIRED = "Elige una imagen para insertar.";
const GENERIC = "No se pudo completar la operación. Inténtalo de nuevo.";
const INSERTED = "Imagen insertada.";
const EVIL = "https://evil.example";
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\((https:\/\/[^)\s]+\/storage\/v1\/object\/public\/post-images\/([0-9a-f-]{36}\.(?:png|jpg|webp)))\)/;

const prefixes: string[] = [];
const leftovers: string[] = [];
const prefix = () => {
  const value = newE2EPrefix();
  prefixes.push(value);
  return value;
};
test.afterEach(async () => {
  for (const value of prefixes.splice(0)) await deleteE2EByPrefix(value);
  await removeE2EObjects(leftovers.splice(0));
});

// Una sesión de admin por trabajador, reutilizada: cada inicio de sesión cuenta para el límite de Supabase Auth.
let panelSession: Promise<{ id: string; cookies: Awaited<ReturnType<typeof createSessionCookies>> }> | null = null;
async function asAdmin(page: Page) {
  panelSession ??= (async () => {
    const user = await createE2EUser(`itest-e2e-${Math.random().toString(16).slice(2, 10)}`, "content-image", "admin");
    return { id: user.id, cookies: await createSessionCookies(user.email, user.password) };
  })();
  await page.context().addCookies((await panelSession).cookies);
}
test.afterAll(async () => {
  const session = panelSession;
  panelSession = null;
  if (session) await deleteE2EUser((await session).id);
});

const isMobile = () => test.info().project.name === "mobile";
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const loaded = (image: Locator) => expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
const png = (buffer: Buffer = REAL_PNG, name = "imagen.png") => ({ name, mimeType: "image/png", buffer });
const content = (page: Page) => page.getByLabel("Contenido (Markdown)");
const fileInput = (page: Page) => page.getByLabel("Imagen para insertar en el contenido");
const altInput = (page: Page) => page.getByLabel("Texto alternativo de la imagen");
const insertButton = (page: Page) => page.getByRole("button", { name: "Insertar imagen", exact: true });
const imageStatus = (page: Page) => page.locator('[data-slot="image-status"]');
const rowOf = (page: Page, title: string): Locator => page.getByRole("listitem").filter({ hasText: title });

async function newPost(page: Page, fields: { title: string; slug: string; content?: string }) {
  await page.goto("/admin/posts/new");
  await page.getByLabel("Título").fill(fields.title);
  await page.getByLabel("Dirección (slug)").fill(fields.slug);
  if (fields.content) await content(page).fill(fields.content);
}

/** Elige el archivo, escribe el texto alternativo y pulsa «Insertar imagen». */
async function insert(page: Page, alt: string, file = png()) {
  await fileInput(page).setInputFiles(file);
  await altInput(page).fill(alt);
  await insertButton(page).click();
}

/** Inserta una imagen y devuelve lo que se escribió en el contenido. */
async function insertOk(page: Page, alt: string, file = png()) {
  await insert(page, alt, file);
  await expect(imageStatus(page)).toContainText(INSERTED);
  const value = await content(page).inputValue();
  const match = value.match(MARKDOWN_IMAGE);
  expect(match, `el contenido debería llevar la línea de la imagen: ${value}`).not.toBeNull();
  return { markdown: match![0], alt: match![1], url: match![2], name: match![3], value };
}

async function savedPostWithImage(page: Page, base: string, alt: string, intent: "Guardar borrador" | "Publicar" = "Publicar") {
  const slug = `${base}-imagen`;
  await newPost(page, { title: `${base} Con imagen`, slug, content: "Texto de la entrada." });
  const inserted = await insertOk(page, alt);
  await page.getByRole("button", { name: intent, exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin");
  return { slug, ...inserted };
}

test.describe("criterio de hecho del bloque: imagen en el contenido de punta a punta", () => {
  test("crear → insertar con alt → vista previa → guardar → publicar → imagen visible en el blog", async ({ page }) => {
    const base = prefix();
    const alt = "Luna llena sobre el mar";
    await asAdmin(page);
    const slug = `${base}-imagen`;
    await newPost(page, { title: `${base} Con imagen`, slug, content: "Antes de la imagen." });

    const inserted = await insertOk(page, alt);
    expect(inserted.alt).toBe(alt);
    expect(inserted.value).toContain("Antes de la imagen.");
    await expect(fileInput(page)).toHaveValue(""); // el formulario de inserción queda listo para otra imagen
    await expect(altInput(page)).toHaveValue("");

    // Vista previa: el mismo pipeline que el blog (en móvil, en su pestaña).
    if (isMobile()) await page.getByRole("tab", { name: "Vista previa" }).click();
    const preview = page.getByRole("region", { name: "Vista previa" });
    const previewImage = preview.locator(`img[alt="${alt}"]`);
    await expect(previewImage).toBeVisible();
    await loaded(previewImage);
    if (isMobile()) await page.getByRole("tab", { name: "Editar" }).click();

    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    expect(await getE2EContent(slug)).toContain(inserted.url);

    await page.goto(`/blog/${slug}`);
    const image = page.locator(`.article-body img[alt="${alt}"]`);
    await expect(image).toBeVisible();
    await loaded(image);
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect(image).toHaveAttribute("sizes", /100vw/);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const box = await image.boundingBox();
    expect((box?.width ?? 0) <= (page.viewportSize()?.width ?? 0)).toBe(true); // no desborda en móvil
  });

  test("el texto alternativo se escapa: uno hostil no cambia el destino ni añade imágenes", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Alt hostil`, slug: `${base}-alt-hostil` });
    await insert(page, `x](${EVIL}/a.png) ![y](${EVIL}/b.png`);
    await expect(imageStatus(page)).toContainText(INSERTED);
    if (isMobile()) await page.getByRole("tab", { name: "Vista previa" }).click();
    const preview = page.getByRole("region", { name: "Vista previa" });
    await expect(preview.locator("img")).toHaveCount(1);
    await expect(preview.locator(`img[src*="evil.example"]`)).toHaveCount(0);
  });

  test("quitar la línea y guardar borra el archivo; eliminar la entrada borra el resto", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    const post = await savedPostWithImage(page, base, "Imagen que se quita", "Guardar borrador");
    expect(await e2eObjectServed(post.name)).toBe(true);

    await rowOf(page, `${base} Con imagen`).getByRole("link", { name: /^Editar/ }).click();
    expect(await content(page).inputValue()).toContain(post.name);
    await content(page).fill("Ya no hay imagen.");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
    expect(await e2eObjectServed(post.name)).toBe(false);

    const second = await insertOk(page, "Otra imagen");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cambios guardados." })).toBeVisible();
    expect(await e2eObjectServed(second.name)).toBe(true);

    await page.goto("/admin");
    await rowOf(page, `${base} Con imagen`).getByRole("button", { name: /^Eliminar/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden(); // con el diálogo abierto el resto de la página no está en el árbol de accesibilidad
    await expect(rowOf(page, `${base} Con imagen`)).toHaveCount(0);
    expect(await countE2E("posts", base)).toBe(0);
    expect(await e2eObjectServed(second.name)).toBe(false);
  });
});

test.describe("lo que no se puede insertar", () => {
  test("un SVG se rechaza con un mensaje claro: no se sube nada ni se escribe nada en el contenido", async ({ page }) => {
    const base = prefix();
    const svg = svgOfSize(888);
    await asAdmin(page);
    await newPost(page, { title: `${base} Svg`, slug: `${base}-svg`, content: "Texto." });
    await insert(page, "Alt", { name: "imagen.png", mimeType: "image/png", buffer: svg }); // con nombre y tipo de PNG: solo el contenido lo delata

    const alert = page.getByRole("alert").filter({ hasText: INVALID_TYPE });
    await expect(alert).toBeVisible();
    await expect(fileInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(content(page)).toHaveValue("Texto.");
    expect(await findE2EObjectsBySize(888)).toEqual([]);
  });

  test("un HTML o un archivo dañado con extensión .png tampoco se inserta", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Roto`, slug: `${base}-roto`, content: "Texto." });
    await insert(page, "Alt", { name: "imagen.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
    await expect(page.getByRole("alert").filter({ hasText: /no es una imagen válida|JPEG, PNG o WebP/ })).toBeVisible();
    await expect(content(page)).toHaveValue("Texto.");
    expect(await countE2E("posts", base)).toBe(0);
  });

  test("sin texto alternativo: error asociado al campo, nada se sube y nada se escribe", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Sin alt`, slug: `${base}-sin-alt`, content: "Texto." });
    const posts: string[] = [];
    page.on("request", (request) => request.method() === "POST" && posts.push(request.url()));

    await fileInput(page).setInputFiles(png(pngOfSize(10_101)));
    await insertButton(page).click();

    await expect(page.getByRole("alert").filter({ hasText: ALT_REQUIRED })).toBeVisible();
    await expect(altInput(page)).toHaveAttribute("aria-invalid", "true");
    const describedBy = await altInput(page).getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(ALT_REQUIRED);
    await expect(content(page)).toHaveValue("Texto.");
    expect(posts).toEqual([]); // el navegador lo detiene antes de enviar
    expect(await findE2EObjectsBySize(10_101)).toEqual([]);
  });

  test("sin archivo: pide elegir una imagen", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Sin archivo`, slug: `${base}-sin-archivo`, content: "Texto." });
    await altInput(page).fill("Alt");
    await insertButton(page).click();
    await expect(page.getByRole("alert").filter({ hasText: FILE_REQUIRED })).toBeVisible();
    await expect(content(page)).toHaveValue("Texto.");
  });

  test("más de 2 MB: aviso claro sin enviar nada", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Grande`, slug: `${base}-grande`, content: "Texto." });
    const posts: string[] = [];
    page.on("request", (request) => request.method() === "POST" && posts.push(request.url()));
    await insert(page, "Alt", png(pngOfSize(2 * MIB + 1_000)));
    await expect(page.getByRole("alert").filter({ hasText: TOO_LARGE })).toBeVisible();
    await expect(content(page)).toHaveValue("Texto.");
    expect(posts).toEqual([]);
    expect(await findE2EObjectsBySize(2 * MIB + 1_000)).toEqual([]);
  });

  test("fail closed: si la petición de subida falla, no se inserta ninguna línea rota y se muestra un error genérico", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Fallo`, slug: `${base}-fallo`, content: "Texto." });
    await page.route("**/admin/posts/new", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.fallback()));

    await insert(page, "Alt", png(pngOfSize(10_102)));

    await expect(page.getByRole("alert").filter({ hasText: GENERIC })).toBeVisible();
    await expect(content(page)).toHaveValue("Texto.");
    await expect(imageStatus(page)).not.toContainText(INSERTED);
    expect(await findE2EObjectsBySize(10_102)).toEqual([]);
  });
});

test.describe("A05: lo que se escribe a mano en el Markdown", () => {
  test("una imagen externa, data: y con ../ no se muestran ni en la vista previa ni en el blog, y el resto del texto se conserva", async ({ page }) => {
    const base = prefix();
    const slug = `${base}-externa`;
    const requested: string[] = [];
    await page.route(/evil\.example/, (route) => {
      requested.push(route.request().url());
      return route.abort();
    });
    await asAdmin(page);
    const hostile = [
      "Párrafo que debe sobrevivir.",
      `![externa](${EVIL}/a.png)`,
      "![datos](data:image/svg+xml,<svg onload=alert(1)>)",
      "![salto](/storage/v1/object/public/post-images/../x.png)",
      `<img src="${EVIL}/b.png" onerror="alert(1)">`,
      "Último párrafo.",
    ].join("\n\n");
    await newPost(page, { title: `${base} Externa`, slug, content: hostile });

    if (isMobile()) await page.getByRole("tab", { name: "Vista previa" }).click();
    const preview = page.getByRole("region", { name: "Vista previa" });
    await expect(preview.getByText("Párrafo que debe sobrevivir.")).toBeVisible();
    await expect(preview.getByText("Último párrafo.")).toBeVisible();
    await expect(preview.locator("img")).toHaveCount(0);
    if (isMobile()) await page.getByRole("tab", { name: "Editar" }).click();

    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    await page.goto(`/blog/${slug}`);
    await expect(page.getByText("Párrafo que debe sobrevivir.")).toBeVisible();
    await expect(page.locator(".article-body img")).toHaveCount(0);
    expect(requested).toEqual([]);
  });
});

test.describe("seguridad", () => {
  test("A01: la acción de subida capturada y reenviada con la sesión de un usuario sin rol no sube nada", async ({ page, browser, users }) => {
    const base = prefix();
    const size = (n: number) => n + (isMobile() ? 100 : 0); // escritorio y móvil corren este test a la vez: cada uno reconoce SU archivo por el tamaño
    await asAdmin(page);
    await installCapture(page);
    await newPost(page, { title: `${base} Captura`, slug: `${base}-captura`, content: "Texto." });
    await insert(page, "Alt", png(pngOfSize(size(10_103))));
    await expect(imageStatus(page)).toContainText(INSERTED);
    const captured = await lastCaptured(page);
    expect(await findE2EObjectsBySize(size(10_103))).toHaveLength(1);

    // Control positivo: con la sesión del admin el mismo reenvío SÍ sube el archivo, así que el rechazo de abajo significa algo.
    await replay(page.context().request, captured, { fileField: "_image", file: pngOfSize(size(10_104)) });
    expect(await findE2EObjectsBySize(size(10_104))).toHaveLength(1);

    const baseURL = test.info().project.use.baseURL;
    const intruder = await browser.newContext({ baseURL });
    try {
      await addSessionCookies(intruder, users.user.email, users.user.password);
      await replay(intruder.request, captured, { fileField: "_image", file: pngOfSize(size(10_105)) });
    } finally {
      await intruder.close();
    }
    expect(await findE2EObjectsBySize(size(10_105))).toEqual([]);
  });

  test("peticiones forjadas: ni el servidor ni el límite de Next dejan pasar un archivo de más de 2 MB", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await installCapture(page);
    await newPost(page, { title: `${base} Forjada`, slug: `${base}-forjada`, content: "Texto." });
    await insert(page, "Alt", png(pngOfSize(10_106)));
    await expect(imageStatus(page)).toContainText(INSERTED);
    const captured = await lastCaptured(page);

    for (const [label, size] of [["medio", 2 * MIB + 500_000], ["enorme", 4 * MIB]] as const) {
      await replay(page.context().request, captured, { fileField: "_image", file: pngOfSize(size) });
      expect(await findE2EObjectsBySize(size), label).toEqual([]);
    }
  });
});

test.describe("editor en móvil, teclado y accesibilidad", () => {
  test("campos y botón: 44 px, sin scroll lateral, teclado completo y foco visible", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Teclado`, slug: `${base}-teclado` });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    for (const target of [fileInput(page), altInput(page), insertButton(page)]) {
      expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Teclado: desde el campo de archivo, Tab llega al texto alternativo y al botón, con el foco visible.
    await fileInput(page).focus();
    const reached: string[] = [];
    for (let i = 0; i < 4 && reached.length < 2; i++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const style = getComputedStyle(element);
        return { id: element.id, text: element.textContent?.trim() ?? "", visible: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none" };
      });
      if (state.text === "Insertar imagen" || /alt/i.test(state.id)) {
        expect(state.visible).toBe(true);
        reached.push(state.text || state.id);
      }
    }
    expect(reached).toHaveLength(2);

    // Con el teclado se puede insertar: Enter en el botón.
    await fileInput(page).setInputFiles(png());
    await altInput(page).fill("Insertada con el teclado");
    await insertButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(imageStatus(page)).toContainText(INSERTED);
  });

  test("el error se anuncia como alerta y el foco no se pierde", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Alerta`, slug: `${base}-alerta` });
    await fileInput(page).setInputFiles(png());
    await insertButton(page).click();
    const alert = page.getByRole("alert").filter({ hasText: ALT_REQUIRED });
    await expect(alert).toBeVisible();
    await expect(altInput(page)).toBeFocused(); // el foco va al campo que hay que corregir
  });

  test.describe("axe-core (WCAG 2 A y AA)", () => {
    const violations = async (page: Page) => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

    test("editor con el bloque de inserción: en reposo, con errores y con la imagen insertada", async ({ page }) => {
      const base = prefix();
      await asAdmin(page);
      await newPost(page, { title: `${base} Axe`, slug: `${base}-axe` });
      expect(await violations(page)).toEqual([]);

      await insertButton(page).click(); // sin archivo ni alt: errores visibles
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);

      await insert(page, "Texto alternativo para axe");
      await expect(imageStatus(page)).toContainText(INSERTED);
      expect(await violations(page)).toEqual([]);
    });

    test("entrada pública con una imagen en el texto", async ({ page }) => {
      const base = prefix();
      await asAdmin(page);
      const post = await savedPostWithImage(page, base, "Texto alternativo público");
      await page.goto(`/blog/${post.slug}`);
      const image = page.locator('.article-body img[alt="Texto alternativo público"]');
      await expect(image).toBeVisible();
      await loaded(image);
      expect(await violations(page)).toEqual([]);
    });
  });
});
