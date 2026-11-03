import AxeBuilder from "@axe-core/playwright";
import type { APIResponse, Locator, Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { brokenPng, MIB, pngOfSize, REAL_JPEG, REAL_PNG, svgOfSize } from "./support/cover-images";
import {
  countE2E,
  createE2EUser,
  deleteE2EByPrefix,
  deleteE2EUser,
  e2eObjectServed,
  findE2EObjectsBySize,
  getE2ECoverAlt,
  getE2ECoverPath,
  newE2EPrefix,
  removeE2EObjects,
} from "./support/service-role";
import { addSessionCookies, createSessionCookies } from "./support/session-cookies";

// Los textos de la interfaz se escriben a propósito aquí y no se importan de la aplicación.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const INVALID_TYPE = "La imagen debe ser JPEG, PNG o WebP.";
const TOO_LARGE = "La imagen no puede superar los 2 MB.";
const ALT_REQUIRED = "El texto alternativo de la portada es obligatorio.";
const EVIL = "https://evil.example";

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
    const user = await createE2EUser(`itest-e2e-${Math.random().toString(16).slice(2, 10)}`, "cover", "admin");
    return { id: user.id, cookies: await createSessionCookies(user.email, user.password) };
  })();
  await page.context().addCookies((await panelSession).cookies);
}
test.afterAll(async () => {
  const session = panelSession;
  panelSession = null;
  if (session) await deleteE2EUser((await session).id);
});

const rowOf = (page: Page, title: string): Locator => page.getByRole("listitem").filter({ hasText: title });
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const loaded = (image: Locator) => expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
const pick = (page: Page, file: { name: string; mimeType: string; buffer: Buffer }) => page.getByLabel("Imagen de portada").setInputFiles(file);
const png = (buffer: Buffer = REAL_PNG, name = "portada.png") => ({ name, mimeType: "image/png", buffer });

async function newPost(page: Page, fields: { title: string; slug: string; content?: string }) {
  await page.goto("/admin/posts/new");
  await page.getByLabel("Título").fill(fields.title);
  await page.getByLabel("Dirección (slug)").fill(fields.slug);
  await page.getByLabel("Contenido (Markdown)").fill(fields.content ?? "Texto de la entrada.");
}

/** Crea la entrada con portada desde el panel y devuelve su slug. */
async function publishWithCover(page: Page, base: string, alt: string, file = png()) {
  const slug = `${base}-portada`;
  await newPost(page, { title: `${base} Con portada`, slug });
  await pick(page, file);
  await page.getByLabel("Texto alternativo de la portada").fill(alt);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin");
  return slug;
}

/** Captura la petición real de la Server Action que crea una entrada (con su archivo) para poder reenviarla modificada. */
async function captureCreateRequest(page: Page, base: string, label: string, file: Buffer) {
  const slug = `${base}-${label}`;
  await newPost(page, { title: `${base} ${label}`, slug });
  await pick(page, png(file));
  await page.getByLabel("Texto alternativo de la portada").fill("Texto de prueba");
  const captured = page.waitForRequest((request) => request.method() === "POST" && "next-action" in request.headers());
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
  const request = await captured;
  await expect(page).toHaveURL((url) => url.pathname === "/admin");
  return { request, slug };
}

/** Reenvía una petición capturada cambiando el archivo y el slug (con la misma longitud, para no alterar el resto del cuerpo). */
async function replay(page: Page, original: Request, from: { file: Buffer; slug: string }, to: { file: Buffer; slug: string }): Promise<APIResponse> {
  const body = original.postDataBuffer();
  if (!body) throw new Error("La petición capturada no tiene cuerpo.");
  const start = body.indexOf(from.file);
  if (start < 0) throw new Error("No se encontró el archivo en el cuerpo capturado.");
  const swapped = Buffer.concat([body.subarray(0, start), to.file, body.subarray(start + from.file.length)]);
  const data = Buffer.from(swapped.toString("latin1").replaceAll(from.slug, to.slug), "latin1");
  const headers = original.headers();
  return page.context().request.post(original.url(), {
    headers: { "content-type": headers["content-type"], "next-action": headers["next-action"], accept: headers.accept ?? "text/x-component" },
    data,
    failOnStatusCode: false,
  });
}

test.describe("criterio de hecho de la Fase 2: portada de punta a punta", () => {
  test("login → crear borrador con portada y alt → guardar → publicar → se ve en el blog con su imagen", async ({ page, users }) => {
    const base = prefix();
    const title = `${base} Luna llena`;
    const slug = `${base}-luna-llena`;
    const alt = "Luna llena sobre el mar";

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(users.admin.email);
    await page.getByLabel("Contraseña").fill(users.admin.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();

    await page.getByRole("link", { name: "Nueva entrada" }).click();
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Dirección (slug)").fill(slug);
    await page.getByLabel("Contenido (Markdown)").fill("Un texto sobre la luna llena.");
    await pick(page, png());
    await expect(page.locator('img[src^="blob:"]')).toBeVisible(); // vista previa local de la portada elegida
    await page.getByLabel("Texto alternativo de la portada").fill(alt);
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();

    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    await expect(rowOf(page, title).getByText("Borrador", { exact: true })).toBeVisible();

    // Al volver a editar, la portada guardada se ve con su texto alternativo.
    await rowOf(page, title).getByRole("link", { name: /^Editar/ }).click();
    const preview = page.locator(`main img[alt="${alt}"]`);
    await expect(preview).toBeVisible();
    await loaded(preview);
    expect(await getE2ECoverAlt(slug)).toBe(alt);

    // Publicar y comprobar el blog público.
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Entrada publicada.");

    await page.goto(`/blog/${slug}`);
    const hero = page.locator(`article img[alt="${alt}"]`);
    await expect(hero).toBeVisible();
    await loaded(hero);

    for (const path of ["/", "/blog"]) {
      await page.goto(path);
      const card = page.locator("article", { has: page.getByRole("link", { name: title, exact: true }) });
      const image = card.locator(`img[alt="${alt}"]`);
      await expect(image).toBeVisible();
      await loaded(image);
      await expect(image).toHaveAttribute("sizes", /\(min-width/); // tamaños responsivos
      await expect(image).toHaveAttribute("loading", "lazy"); // carga diferida
    }
  });
});

test.describe("lo que no se puede subir", () => {
  test("un SVG se rechaza con un mensaje claro y no se crea ni se sube nada", async ({ page }) => {
    const base = prefix();
    const svg = svgOfSize(777);
    await asAdmin(page);
    await newPost(page, { title: `${base} Svg`, slug: `${base}-svg` });
    await pick(page, { name: "portada.png", mimeType: "image/png", buffer: svg }); // con nombre y tipo de PNG: solo el contenido lo delata
    await page.getByLabel("Texto alternativo de la portada").fill("Alt");
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();

    const alert = page.getByRole("alert").first();
    await expect(alert).toContainText(INVALID_TYPE);
    await expect(alert).toBeFocused();
    expect(await countE2E("posts", base)).toBe(0);
    expect(await findE2EObjectsBySize(777)).toEqual([]);
  });

  test("un archivo con firma de PNG pero dañado y uno vacío se rechazan", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Roto`, slug: `${base}-roto` });
    await pick(page, png(brokenPng()));
    await page.getByLabel("Texto alternativo de la portada").fill("Alt");
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("El archivo no es una imagen válida o está dañado.");

    await pick(page, png(Buffer.alloc(0), "vacia.png"));
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("El archivo está vacío.");
    expect(await countE2E("posts", base)).toBe(0);
  });

  test("un archivo de más de 2 MB da un aviso claro sin enviar nada", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Grande`, slug: `${base}-grande` });
    const posts: string[] = [];
    page.on("request", (request) => request.method() === "POST" && posts.push(request.url()));

    await pick(page, png(pngOfSize(2 * MIB + 1_000)));
    await expect(page.getByText(TOO_LARGE)).toBeVisible();
    await pick(page, png(pngOfSize(5 * MIB)));
    await expect(page.getByText(TOO_LARGE)).toBeVisible();
    expect(posts).toEqual([]); // el navegador avisa antes de enviar
    expect(await findE2EObjectsBySize(2 * MIB + 1_000)).toEqual([]);
    expect(await findE2EObjectsBySize(5 * MIB)).toEqual([]);
  });

  test("sin texto alternativo: error asociado al campo y nada subido", async ({ page }) => {
    const base = prefix();
    const file = pngOfSize(10_003);
    await asAdmin(page);
    await newPost(page, { title: `${base} Sin alt`, slug: `${base}-sin-alt` });
    await pick(page, png(file));
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();

    await expect(page.getByRole("alert").first()).toContainText(ALT_REQUIRED);
    const alt = page.getByLabel("Texto alternativo de la portada");
    await expect(alt).toHaveAttribute("aria-invalid", "true");
    const describedBy = await alt.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(ALT_REQUIRED);
    expect(await countE2E("posts", base)).toBe(0);
    expect(await findE2EObjectsBySize(10_003)).toEqual([]);
  });

  test("peticiones forjadas: ni el servidor ni el límite de Next dejan pasar un archivo de más de 2 MB", async ({ page }) => {
    const base = prefix();
    const small = pngOfSize(10_010);
    await asAdmin(page);
    const { request, slug } = await captureCreateRequest(page, base, "original", small);
    expect(await countE2E("posts", base)).toBe(1);

    for (const [label, size] of [["medio", 2 * MIB + 500_000], ["enorme", 4 * MIB]] as const) {
      const forged = pngOfSize(size);
      await replay(page, request, { file: small, slug }, { file: forged, slug: `${base}-${label.padEnd(8, "x")}`.slice(0, slug.length) });
      expect(await findE2EObjectsBySize(size), label).toEqual([]);
    }
    expect(await countE2E("posts", base)).toBe(1); // solo la entrada original
  });
});

test.describe("reemplazar, quitar y eliminar borran el archivo", () => {
  test("reemplazar: la nueva se ve en el blog y la antigua deja de servirse", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    const slug = await publishWithCover(page, base, "Primera portada");
    const old = await getE2ECoverPath(slug);
    expect(old).toMatch(/\.png$/);
    expect(await e2eObjectServed(old as string)).toBe(true);

    await rowOf(page, `${base} Con portada`).getByRole("link", { name: /^Editar/ }).click();
    await pick(page, { name: "otra.jpg", mimeType: "image/jpeg", buffer: REAL_JPEG });
    await page.getByLabel("Texto alternativo de la portada").fill("Segunda portada");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados.");

    const current = await getE2ECoverPath(slug);
    expect(current).toMatch(/\.jpg$/);
    expect(await e2eObjectServed(current as string)).toBe(true);
    expect(await e2eObjectServed(old as string)).toBe(false);

    await page.goto(`/blog/${slug}`);
    const hero = page.locator('article img[alt="Segunda portada"]');
    await expect(hero).toBeVisible();
    await loaded(hero);
  });

  test("quitar: el archivo desaparece y el blog muestra el marcador neutro, sin imagen rota", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    const slug = await publishWithCover(page, base, "Portada temporal", png());
    const old = await getE2ECoverPath(slug);

    await rowOf(page, `${base} Con portada`).getByRole("link", { name: /^Editar/ }).click();
    await page.getByRole("button", { name: "Quitar portada" }).click();
    await expect(page.getByRole("button", { name: "Mantener portada" })).toBeVisible(); // se puede deshacer antes de guardar
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados.");

    expect(await getE2ECoverPath(slug)).toBeNull();
    expect(await getE2ECoverAlt(slug)).toBeNull();
    expect(await e2eObjectServed(old as string)).toBe(false);

    await page.goto("/blog");
    const card = page.locator("article", { has: page.getByRole("link", { name: `${base} Con portada`, exact: true }) });
    await expect(card.locator('[data-slot="cover-placeholder"]')).toBeVisible();
    await expect(card.locator("img")).toHaveCount(0);
  });

  test("«Mantener portada» deshace el borrado antes de guardar", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    const slug = await publishWithCover(page, base, "Portada que se queda");
    const path = await getE2ECoverPath(slug);

    await rowOf(page, `${base} Con portada`).getByRole("link", { name: /^Editar/ }).click();
    await page.getByRole("button", { name: "Quitar portada" }).click();
    await page.getByRole("button", { name: "Mantener portada" }).click();
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados.");
    expect(await getE2ECoverPath(slug)).toBe(path);
    expect(await e2eObjectServed(path as string)).toBe(true);
  });

  test("cambiar solo el texto alternativo no toca el archivo", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    const slug = await publishWithCover(page, base, "Texto inicial");
    const path = await getE2ECoverPath(slug);

    await rowOf(page, `${base} Con portada`).getByRole("link", { name: /^Editar/ }).click();
    await page.getByLabel("Texto alternativo de la portada").fill("Texto corregido");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados.");
    expect(await getE2ECoverAlt(slug)).toBe("Texto corregido");
    expect(await getE2ECoverPath(slug)).toBe(path);
  });

  test("eliminar la entrada desde el listado borra también su imagen", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    const slug = await publishWithCover(page, base, "Portada de una entrada que se borra");
    const path = await getE2ECoverPath(slug);
    expect(await e2eObjectServed(path as string)).toBe(true);

    await rowOf(page, `${base} Con portada`).getByRole("button", { name: /^Eliminar/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(rowOf(page, `${base} Con portada`)).toHaveCount(0);
    expect(await countE2E("posts", base)).toBe(0);
    expect(await e2eObjectServed(path as string)).toBe(false);
  });
});

test.describe("seguridad", () => {
  test("A01: la acción de subida capturada y reenviada con la sesión de un usuario sin rol no sube nada", async ({ page, browser, users }) => {
    const base = prefix();
    const original = pngOfSize(10_004);
    await asAdmin(page);
    const { request, slug } = await captureCreateRequest(page, base, "admin", original);
    expect(await countE2E("posts", base)).toBe(1);
    expect(await findE2EObjectsBySize(10_004)).toHaveLength(1);

    const baseURL = test.info().project.use.baseURL;
    const intruder = await browser.newContext({ baseURL });
    try {
      await addSessionCookies(intruder, users.user.email, users.user.password);
      const body = request.postDataBuffer();
      if (!body) throw new Error("Sin cuerpo");
      const headers = request.headers();
      const forged = Buffer.from(body.toString("latin1").replaceAll(slug, `${base}-intruso`.slice(0, slug.length).padEnd(slug.length, "x")), "latin1");
      await intruder.request.post(request.url(), { headers: { "content-type": headers["content-type"], "next-action": headers["next-action"], accept: headers.accept ?? "text/x-component" }, data: forged, failOnStatusCode: false });
    } finally {
      await intruder.close();
    }
    expect(await countE2E("posts", base)).toBe(1);
    expect(await findE2EObjectsBySize(10_004)).toHaveLength(1); // solo la del admin
  });

  test("next/image no sirve imágenes de otros hosts, otros proyectos, otros buckets ni con consulta", async ({ request, blog }) => {
    const legit = blog.coverUrl;
    const origin = new URL(legit).origin;
    const optimize = (url: string) => request.get(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`);

    expect((await optimize(legit)).status()).toBe(200); // control positivo: el Storage de este proyecto sí
    const rejected = [
      `${EVIL}/storage/v1/object/public/post-images/${blog.coverName}`,
      `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/post-images/${blog.coverName}`,
      `${origin}/storage/v1/object/public/otro-bucket/${blog.coverName}`,
      `${origin}/storage/v1/object/sign/post-images/${blog.coverName}`,
      `${legit}?parametro=1`,
      "javascript:alert(1)",
      "//evil.example/x.png",
    ];
    for (const url of rejected) expect((await optimize(url)).status(), url).toBe(400);
  });
});

test.describe("editor de la portada: móvil, teclado y accesibilidad", () => {
  test("campo de archivo, alt y quitar: 44 px, sin scroll lateral, teclado completo y foco visible", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await newPost(page, { title: `${base} Teclado`, slug: `${base}-teclado` });
    await pick(page, png());
    await expect(page.locator('img[src^="blob:"]')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    for (const target of [page.getByLabel("Imagen de portada"), page.getByLabel("Texto alternativo de la portada"), page.getByRole("button", { name: "Quitar portada" })]) {
      expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    // Teclado: desde el campo de archivo, Tab llega al texto alternativo y al botón de quitar, con el foco visible.
    await page.getByLabel("Imagen de portada").focus();
    const reached = new Set<string>();
    for (let i = 0; i < 8 && reached.size < 2; i++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const style = getComputedStyle(element);
        return { label: element.getAttribute("name") ?? element.textContent?.trim() ?? "", visible: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none" };
      });
      if (state.label === "coverAlt" || state.label === "Quitar portada") {
        expect(state.visible).toBe(true);
        reached.add(state.label);
      }
    }
    expect([...reached].sort()).toEqual(["Quitar portada", "coverAlt"]);

    await page.getByRole("button", { name: "Quitar portada" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(0); // quitar descarta la selección
  });

  test.describe("axe-core (WCAG 2 A y AA)", () => {
    const violations = async (page: Page) => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

    test("editor con la portada elegida y con errores", async ({ page }) => {
      const base = prefix();
      await asAdmin(page);
      await newPost(page, { title: `${base} Axe`, slug: `${base}-axe` });
      await pick(page, png());
      await expect(page.locator('img[src^="blob:"]')).toBeVisible();
      expect(await violations(page)).toEqual([]);

      await page.getByRole("button", { name: "Guardar borrador", exact: true }).click(); // sin alt: errores visibles
      await expect(page.getByRole("alert").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("editor con una portada ya guardada", async ({ page }) => {
      const base = prefix();
      await asAdmin(page);
      const slug = await publishWithCover(page, base, "Texto alternativo para axe");
      await rowOf(page, `${base} Con portada`).getByRole("link", { name: /^Editar/ }).click();
      await expect(page.locator('main img[alt="Texto alternativo para axe"]')).toBeVisible();
      expect(await violations(page)).toEqual([]);
      expect(slug).toContain(base);
    });

    test("entrada pública con imagen", async ({ page }) => {
      const base = prefix();
      await asAdmin(page);
      const slug = await publishWithCover(page, base, "Texto alternativo público");
      await page.goto(`/blog/${slug}`);
      const hero = page.locator('article img[alt="Texto alternativo público"]');
      await expect(hero).toBeVisible();
      await loaded(hero);
      expect(await violations(page)).toEqual([]);
    });
  });
});
