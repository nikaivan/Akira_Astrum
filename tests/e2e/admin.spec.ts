import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { countE2E, createE2EDraft, createE2EUser, deleteE2EByPrefix, deleteE2EUser, findE2ECategory, newE2EPrefix } from "./support/service-role";
import { addSessionCookies, createSessionCookies } from "./support/session-cookies";

// Los textos de la interfaz se escriben a propósito aquí y no se importan de la aplicación.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SLUG_TAKEN = "Ya existe una entrada con esa dirección.";
const TITLE_REQUIRED = "El título es obligatorio.";
const HOSTILE = [
  "## Sección legítima",
  "",
  "Un párrafo con **negrita** y un [enlace](https://example.com/pagina).",
  "",
  "<script>window.__xss = 1</script>",
  "",
  '<img src=x onerror="window.__xss = 2">',
  "",
  "[trampa](javascript:window.__xss=3)",
  "",
  '<iframe src="https://example.com/frame"></iframe>',
].join("\n");

const prefixes: string[] = [];
const prefix = () => {
  const value = newE2EPrefix();
  prefixes.push(value);
  return value;
};
test.afterEach(async () => {
  for (const value of prefixes.splice(0)) await deleteE2EByPrefix(value);
});

const isMobile = () => test.info().project.name === "mobile";
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rowOf = (page: Page, title: string): Locator => page.getByRole("listitem").filter({ hasText: title });
const publicStatus = async (request: { get: (url: string) => Promise<{ status: () => number }> }, path: string) => (await request.get(path)).status();

// Una sesión de admin por trabajador, reutilizada en todos los tests del panel: cada inicio de sesión cuenta para el
// límite de Supabase Auth. Es un usuario propio (no users.admin): el test de cerrar sesión revoca todas las sesiones
// de users.admin y dejaría inservibles estas cookies.
let panelSession: Promise<{ id: string; cookies: Awaited<ReturnType<typeof createSessionCookies>> }> | null = null;

async function asAdmin(page: Page) {
  panelSession ??= (async () => {
    const user = await createE2EUser(`itest-e2e-${Math.random().toString(16).slice(2, 10)}`, "panel", "admin");
    return { id: user.id, cookies: await createSessionCookies(user.email, user.password) };
  })();
  await page.context().addCookies((await panelSession).cookies);
}

test.afterAll(async () => {
  const session = panelSession;
  panelSession = null;
  if (session) await deleteE2EUser((await session).id);
});

async function fillAndSave(page: Page, fields: { title: string; slug?: string; content?: string }, button: string) {
  await page.getByLabel("Título").fill(fields.title);
  if (fields.slug !== undefined) await page.getByLabel("Dirección (slug)").fill(fields.slug);
  if (fields.content !== undefined) await page.getByLabel("Contenido (Markdown)").fill(fields.content);
  await page.getByRole("button", { name: button, exact: true }).click();
}

test.describe("sin sesión (sin Supabase)", () => {
  for (const path of ["/admin/categorias", "/admin/posts/11111111-1111-4111-8111-111111111111/edit"]) {
    test(`${path} redirige a /login conservando la ruta`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("next")).toBe(path);
    });
  }
});

test.describe("flujo del admin", () => {
  test("login → crear borrador → listado → publicar → blog → despublicar (404) → eliminar", async ({ page, request, users }) => {
    const base = prefix();
    const title = `${base} Luna nueva`;
    const slug = `${base}-luna-nueva`;

    // Login por el formulario real.
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(users.admin.email);
    await page.getByLabel("Contraseña").fill(users.admin.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();

    // Crear y guardar un borrador.
    await page.getByRole("link", { name: "Nueva entrada" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nueva entrada" })).toBeVisible();
    await fillAndSave(page, { title, slug, content: "Texto de la **luna nueva**." }, "Guardar borrador");

    // Aparece en el listado como borrador y el público no lo ve.
    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    const row = rowOf(page, title);
    await expect(row).toBeVisible();
    await expect(row.getByText("Borrador", { exact: true })).toBeVisible();
    expect(await publicStatus(request, `/blog/${slug}`)).toBe(404);

    // Publicar: aparece en el blog público.
    await row.getByRole("button", { name: /^Publicar/ }).click();
    await expect(row.getByText("Publicada", { exact: true })).toBeVisible();
    expect(await publicStatus(request, `/blog/${slug}`)).toBe(200);
    expect(await (await request.get("/blog")).text()).toContain(title);

    // Editar una publicada: el slug no se puede cambiar.
    await row.getByRole("link", { name: /^Editar/ }).click();
    await expect(page.getByLabel("Dirección (slug)")).toHaveAttribute("readonly", "");
    await expect(page.getByText("Despublícala primero")).toBeVisible();
    await page.getByLabel("Título").fill(`${title} editada`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados.");
    expect(await (await request.get(`/blog/${slug}`)).text()).toContain(`${title} editada`);

    // Despublicar: deja de verse al instante (404 sin recargar el servidor).
    await page.goto("/admin");
    const published = rowOf(page, `${title} editada`);
    await published.getByRole("button", { name: /^Despublicar/ }).click();
    await expect(published.getByText("Borrador", { exact: true })).toBeVisible();
    expect(await publicStatus(request, `/blog/${slug}`)).toBe(404);
    expect(await (await request.get("/blog")).text()).not.toContain(title);

    // Eliminar: primero se cancela, después se confirma.
    await published.getByRole("button", { name: /^Eliminar/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(published).toBeVisible();
    expect(await countE2E("posts", base)).toBe(1);

    await published.getByRole("button", { name: /^Eliminar/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar definitivamente" }).click();
    // Con el modal abierto el fondo no está en el árbol de accesibilidad: sin esperar a que se cierre, el recuento de filas sería 0 de inmediato.
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(rowOf(page, title)).toHaveCount(0);
    expect(await countE2E("posts", base)).toBe(0);
  });

  test("crear y publicar a la vez, y filtrar el listado por estado", async ({ page, request, users }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await fillAndSave(page, { title: `${base} Publicada`, slug: `${base}-publicada`, content: "Hola" }, "Publicar");
    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    expect(await publicStatus(request, `/blog/${base}-publicada`)).toBe(200);

    await createE2EDraft(users.admin.id, `${base}-borrador`, `${base} Borrador`);
    await page.goto("/admin");
    await expect(rowOf(page, `${base} Publicada`)).toBeVisible();
    await expect(rowOf(page, `${base} Borrador`)).toBeVisible();

    await page.getByLabel("Estado").selectOption("borrador");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get("estado") === "borrador");
    await expect(rowOf(page, `${base} Borrador`)).toBeVisible();
    await expect(rowOf(page, `${base} Publicada`)).toHaveCount(0);
  });

  test("validación: un título vacío no crea nada y el error se asocia al campo", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await fillAndSave(page, { title: "", slug: `${base}-vacio`, content: "x" }, "Guardar borrador");

    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();
    await expect(alert).toBeFocused();
    const title = page.getByLabel("Título");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    const describedBy = await title.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(TITLE_REQUIRED);
    expect(await countE2E("posts", base)).toBe(0);
  });

  test("un slug repetido da un mensaje claro y no crea otra entrada", async ({ page, users }) => {
    const base = prefix();
    await createE2EDraft(users.admin.id, `${base}-repetido`, `${base} Primera`);
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await fillAndSave(page, { title: `${base} Segunda`, slug: `${base}-repetido`, content: "x" }, "Guardar borrador");

    const slugField = page.getByLabel("Dirección (slug)");
    await expect(slugField).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").first()).toContainText(SLUG_TAKEN);
    expect(await countE2E("posts", base)).toBe(1);
  });

  test("el slug se autorrellena desde el título mientras no se toca", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await page.getByLabel("Título").fill(`${base} Ñandú: ¿Qué es el Sol?`);
    await expect(page.getByLabel("Dirección (slug)")).toHaveValue(`${base}-nandu-que-es-el-sol`);
  });
});

test.describe("categorías", () => {
  test("crear, renombrar, asignar a una entrada y eliminar con confirmación", async ({ page, request }) => {
    const base = prefix();
    const name = `${base} Fuego`;
    await asAdmin(page);

    await page.goto("/admin/categorias");
    await page.getByLabel("Nombre de la nueva categoría").fill(name);
    await page.getByRole("button", { name: "Crear categoría" }).click();
    const row = rowOf(page, name);
    await expect(row).toBeVisible();
    const category = await findE2ECategory(base);
    expect(category).not.toBeNull();

    await row.getByRole("textbox").fill(`${name} vivo`);
    await row.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(rowOf(page, `${name} vivo`)).toBeVisible();
    expect((await findE2ECategory(base))?.slug).toBe(category?.slug);

    // Asignarla a una entrada publicada: se ve en la entrada y en la página de la categoría.
    await page.goto("/admin/posts/new");
    await page.getByLabel(`${name} vivo`).check();
    await fillAndSave(page, { title: `${base} Con categoría`, slug: `${base}-con-categoria`, content: "x" }, "Publicar");
    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    expect(await (await request.get(`/categorias/${category?.slug}`)).text()).toContain(`${base} Con categoría`);

    // Eliminar: el diálogo avisa de cuántas entradas la usan y las entradas se conservan.
    await page.goto("/admin/categorias");
    await rowOf(page, `${name} vivo`).getByRole("button", { name: /^Eliminar/ }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(/1 entrada/);
    await dialog.getByRole("button", { name: "Eliminar definitivamente" }).click();
    await expect(dialog).toBeHidden(); // ver el comentario del flujo: hasta que se cierra, las filas no están en el árbol de accesibilidad
    await expect(rowOf(page, `${name} vivo`)).toHaveCount(0);
    expect(await publicStatus(request, `/categorias/${category?.slug}`)).toBe(404);
    expect(await publicStatus(request, `/blog/${base}-con-categoria`)).toBe(200);
  });
});

test.describe("vista previa", () => {
  test("usa el mismo sanitizado que el blog: nada se ejecuta y el resultado coincide", async ({ page, request }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await page.getByLabel("Contenido (Markdown)").fill(HOSTILE);
    if (isMobile()) await page.getByRole("tab", { name: "Vista previa" }).click();

    const preview = page.getByRole("region", { name: "Vista previa" });
    await expect(preview.getByRole("heading", { level: 3, name: "Sección legítima" })).toBeVisible();
    await expect(preview.locator("script, iframe, [onerror], a[href^='javascript' i]")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    const previewParagraphs = await preview.locator("p").allInnerTexts();

    if (isMobile()) await page.getByRole("tab", { name: "Editar" }).click();
    await fillAndSave(page, { title: `${base} Hostil`, slug: `${base}-hostil` }, "Publicar");
    await expect(page).toHaveURL((url) => url.pathname === "/admin");

    await page.goto(`/blog/${base}-hostil`);
    expect(await page.locator(".article-body p").allInnerTexts()).toEqual(previewParagraphs);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("el contenido hostil se guarda tal cual lo escribió el admin", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await fillAndSave(page, { title: `${base} Crudo`, slug: `${base}-crudo`, content: HOSTILE }, "Guardar borrador");
    await expect(page).toHaveURL((url) => url.pathname === "/admin");
    await rowOf(page, `${base} Crudo`).getByRole("link", { name: /^Editar/ }).click();
    await expect(page.getByLabel("Contenido (Markdown)")).toHaveValue(HOSTILE);
  });
});

test.describe("seguridad", () => {
  test("A01: una sesión sin rol admin no entra en el panel", async ({ page, users }) => {
    await addSessionCookies(page.context(), users.user.email, users.user.password);
    for (const path of ["/admin", "/admin/posts/new", "/admin/categorias"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(403);
      await expect(page.getByRole("heading", { name: /Panel de administración|Nueva entrada|Categorías/ })).toHaveCount(0);
    }
  });

  test("CSRF: la petición real de una acción, reenviada con otro Origin, se rechaza", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/categorias");

    const captured = page.waitForRequest((req) => req.method() === "POST" && "next-action" in req.headers());
    await page.getByLabel("Nombre de la nueva categoría").fill(`${base} Real`);
    await page.getByRole("button", { name: "Crear categoría" }).click();
    const original = await captured;
    await expect(rowOf(page, `${base} Real`)).toBeVisible();
    expect(await countE2E("categories", base)).toBe(1);

    const headers = original.headers();
    await page.context().request.post(original.url(), {
      headers: { "content-type": headers["content-type"], "next-action": headers["next-action"], accept: headers.accept ?? "text/x-component", origin: "https://evil.example" },
      data: original.postDataBuffer() ?? undefined,
      failOnStatusCode: false,
    });
    expect(await countE2E("categories", base)).toBe(1); // la copia forjada no creó nada
  });
});

test.describe("responsive y teclado", () => {
  test("el listado se adapta: tarjetas sin tabla, sin scroll lateral y objetivos de 44 px", async ({ page, users }) => {
    const base = prefix();
    await createE2EDraft(users.admin.id, `${base}-uno`, `${base} Uno`);
    await asAdmin(page);
    await page.goto("/admin");
    await expect(rowOf(page, `${base} Uno`)).toBeVisible();

    expect(await page.locator("table").count()).toBe(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const targets = page.locator("main").locator("a[href], button, select, input:not([type=hidden])");
    for (const target of await targets.all()) {
      expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("el editor: pestañas en móvil, doble columna en escritorio, 44 px y sin scroll lateral", async ({ page }) => {
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await page.getByLabel("Contenido (Markdown)").fill("Hola");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const editor = page.getByLabel("Contenido (Markdown)");
    const preview = page.getByRole("region", { name: "Vista previa" });
    if (isMobile()) {
      await expect(page.getByRole("tab", { name: "Editar" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Vista previa" })).toBeVisible();
      await expect(preview).toBeHidden();
      await page.getByRole("tab", { name: "Vista previa" }).click();
      await expect(preview).toBeVisible();
      await expect(editor).toBeHidden();
      await page.getByRole("tab", { name: "Editar" }).click();
    } else {
      await expect(page.getByRole("tab")).toHaveCount(0);
      await expect(editor).toBeVisible();
      await expect(preview).toBeVisible();
      const [a, b] = [await editor.boundingBox(), await preview.boundingBox()];
      expect(a && b && a.x + a.width <= b.x + 1).toBe(true); // lado a lado
    }

    const targets = page.locator("main").locator("a[href], button, select, textarea, input:not([type=hidden]):not([type=checkbox]), label:has(input[type=checkbox]), [role=tab]");
    for (const target of await targets.all()) {
      if (!(await target.isVisible())) continue;
      expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("teclado: Tab recorre el formulario con el foco visible hasta Guardar borrador, y el diálogo se cierra con Esc", async ({ page, users }) => {
    const base = prefix();
    await createE2EDraft(users.admin.id, `${base}-teclado`, `${base} Teclado`);
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    await page.getByLabel("Título").focus();

    let reached = false;
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const style = getComputedStyle(element);
        const visible = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
        return { name: element.textContent?.trim() ?? "", visible };
      });
      expect(state.visible).toBe(true);
      reached = state.name === "Guardar borrador";
    }
    expect(reached).toBe(true);

    await page.goto("/admin");
    const trigger = rowOf(page, `${base} Teclado`).getByRole("button", { name: /^Eliminar/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("accesibilidad (axe-core, WCAG 2 A y AA)", () => {
  const violations = async (page: Page) => (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;

  test("listado vacío y con entradas", async ({ page, users }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto(`/admin?categoria=${base}-no-existe`);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await createE2EDraft(users.admin.id, `${base}-a`, `${base} A`);
    await page.goto("/admin");
    await expect(rowOf(page, `${base} A`)).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("editor nuevo, con errores y en edición", async ({ page, users }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/posts/new");
    expect(await violations(page)).toEqual([]);

    await page.getByLabel("Contenido (Markdown)").fill(HOSTILE);
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(await violations(page)).toEqual([]);

    const id = await createE2EDraft(users.admin.id, `${base}-edit`, `${base} Edit`);
    await page.goto(`/admin/posts/${id}/edit`);
    await expect(page.getByLabel("Título")).toHaveValue(`${base} Edit`);
    expect(await violations(page)).toEqual([]);
  });

  test("categorías y diálogo de confirmación abierto", async ({ page }) => {
    const base = prefix();
    await asAdmin(page);
    await page.goto("/admin/categorias");
    await page.getByLabel("Nombre de la nueva categoría").fill(`${base} Axe`);
    await page.getByRole("button", { name: "Crear categoría" }).click();
    await expect(rowOf(page, `${base} Axe`)).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await rowOf(page, `${base} Axe`).getByRole("button", { name: /^Eliminar/ }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
