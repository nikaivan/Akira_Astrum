import { expect, test } from "@playwright/test";

test("la portada muestra Akira Astrum", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Akira Astrum");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akira Astrum");
});
