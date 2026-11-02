import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./support/fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("/login no tiene violaciones de accesibilidad", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test("/login con el mensaje de error visible no tiene violaciones de accesibilidad", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("no-es-un-correo");
  await page.getByLabel("Contraseña").fill("x");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations).toEqual([]);
});
