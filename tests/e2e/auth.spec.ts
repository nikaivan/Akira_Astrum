import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { addSessionCookies } from "./support/session-cookies";

// Los mensajes se escriben a propósito aquí y no se importan de la aplicación.
const GENERIC = "Correo o contraseña incorrectos.";
const RATE_LIMIT = "Demasiados intentos. Inténtalo de nuevo más tarde.";
const WRONG_PASSWORD = "Clave-incorrecta-1";
const unknownEmail = () => `nadie-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

async function login(page: Page, email: string, password: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await submitLogin(page, email, password);
}

const sessionCookies = async (page: Page) =>
  (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("sb-"));

test.describe("sin sesión (sin Supabase)", () => {
  for (const path of ["/admin", "/admin/posts/new", "/admin/loquesea"]) {
    test(`${path} redirige a /login conservando la ruta`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("next")).toBe(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("/login se sirve con noindex, sin caché y con un formulario accesible", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toMatch(/noindex/);
    expect(response?.headers()["cache-control"]).toMatch(/no-store/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("/login no tiene desplazamiento horizontal", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("/admin redirigido también se sirve sin caché y con noindex", async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["x-robots-tag"]).toMatch(/noindex/);
    expect(response.headers()["cache-control"]).toMatch(/no-store/);
  });

  test("no existe ninguna página de registro y /login no enlaza a una", async ({ page }) => {
    for (const path of ["/registro", "/register", "/signup", "/sign-up", "/auth/signup"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    const login = await page.goto("/login");
    expect(login?.status()).toBe(200);
    const hrefs = await page.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.filter((href) => /regist|signup|sign-up/i.test(href))).toEqual([]);
  });

  test("una entrada inválida muestra el mensaje genérico sin llegar a Supabase", async ({ page }) => {
    await page.goto("/login");
    await submitLogin(page, "no-es-un-correo", "x");
    await expect(page.locator("form").getByRole("alert")).toHaveText(GENERIC);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(await sessionCookies(page)).toEqual([]);
  });
});

test.describe("con Supabase (proyecto de test)", () => {
  test("un admin inicia sesión y entra al panel con una cookie httpOnly de 8 horas", async ({ page, users }) => {
    await login(page, users.admin.email, users.admin.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de administración" })).toBeVisible();

    const cookies = await sessionCookies(page);
    expect(cookies.length).toBeGreaterThan(0);
    const now = Date.now() / 1000;
    for (const cookie of cookies) {
      expect(cookie.httpOnly, cookie.name).toBe(true);
      expect(cookie.sameSite, cookie.name).toBe("Lax");
      expect(cookie.path, cookie.name).toBe("/");
      expect(cookie.expires - now, cookie.name).toBeLessThanOrEqual(8 * 3600 + 300);
    }
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/auth-token/);
  });

  test("tras el login se va al destino indicado dentro de /admin", async ({ page, users }) => {
    await login(page, users.admin.email, users.admin.password, "/admin/loquesea");
    await expect(page).toHaveURL(/\/admin\/loquesea$/);
  });

  for (const next of ["//evil.com", "https://evil.com", "/login", "/admin/../login"]) {
    test(`un destino malicioso (${next}) no saca de /admin`, async ({ page, users, baseURL }) => {
      await login(page, users.admin.email, users.admin.password, next);
      await expect(page).toHaveURL(/\/admin$/);
      expect(new URL(page.url()).origin).toBe(new URL(baseURL ?? "").origin);
    });
  }

  test("contraseña incorrecta y correo inexistente muestran el mismo mensaje", async ({ page, users }) => {
    await login(page, users.admin.email, WRONG_PASSWORD);
    await expect(page.locator("form").getByRole("alert")).toHaveText(GENERIC);
    const wrongPassword = await page.locator("form").getByRole("alert").innerText();
    expect(await sessionCookies(page)).toEqual([]);

    await page.goto("/login");
    await submitLogin(page, unknownEmail(), WRONG_PASSWORD);
    await expect(page.locator("form").getByRole("alert")).toHaveText(GENERIC);
    expect(await page.locator("form").getByRole("alert").innerText()).toBe(wrongPassword);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(await sessionCookies(page)).toEqual([]);
  });

  test("un usuario sin rol admin con credenciales correctas recibe el mismo mensaje y no queda con sesión", async ({ page, users }) => {
    await login(page, users.user.email, users.user.password);
    await expect(page.locator("form").getByRole("alert")).toHaveText(GENERIC);
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(await sessionCookies(page)).toEqual([]);
  });

  test("una sesión de un usuario sin rol admin recibe un 403 en /admin, no solo se oculta el panel", async ({ page, users }) => {
    await addSessionCookies(page.context(), users.user.email, users.user.password);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(403);
    expect(new URL(page.url()).pathname).toBe("/admin");
    await expect(page.getByText("Panel de administración")).toHaveCount(0);
  });

  test("tras 5 fallos desde la misma IP se bloquea el sexto intento, incluso con la clave correcta", async ({ browser, users }, testInfo) => {
    // Cada proyecto (escritorio/móvil) usa sus propias IPs: corren en paralelo contra el mismo servidor.
    const octet = testInfo.project.name === "mobile" ? 87 : 77;
    const blockedIp = { "x-forwarded-for": `203.0.113.${octet}` };
    const context = await browser.newContext({ extraHTTPHeaders: blockedIp });
    const page = await context.newPage();
    await page.goto("/login");
    for (let attempt = 1; attempt <= 5; attempt++) {
      await submitLogin(page, users.admin.email, WRONG_PASSWORD);
      await expect(page.locator("form").getByRole("alert")).toHaveText(GENERIC);
    }
    await submitLogin(page, users.admin.email, WRONG_PASSWORD);
    await expect(page.locator("form").getByRole("alert")).toHaveText(RATE_LIMIT);

    await submitLogin(page, users.admin.email, users.admin.password);
    await expect(page.locator("form").getByRole("alert")).toHaveText(RATE_LIMIT);
    expect(new URL(page.url()).pathname).toBe("/login");
    await context.close();

    const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${octet + 1}` } });
    const otherPage = await other.newPage();
    await login(otherPage, users.admin.email, users.admin.password);
    await expect(otherPage).toHaveURL(/\/admin$/);
    await other.close();
  });

  test("cerrar sesión vuelve a /login, no deja ver el panel y revoca la sesión en el servidor", async ({ page, users }) => {
    await login(page, users.admin.email, users.admin.password);
    await expect(page).toHaveURL(/\/admin$/);
    const saved = await page.context().cookies();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(await sessionCookies(page)).toEqual([]);

    await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/login");

    await page.goBack();
    await expect(page.getByText("Panel de administración")).toHaveCount(0);

    // La cookie anterior ya no sirve: la sesión está revocada en el servidor.
    await page.context().clearCookies();
    await page.context().addCookies(saved);
    await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/login");
    await expect(page.getByText("Panel de administración")).toHaveCount(0);
  });
});
