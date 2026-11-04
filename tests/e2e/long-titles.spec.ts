import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { createE2EDraft, deleteE2EByPrefix, newE2EPrefix, setE2EPostPublished } from "./support/service-role";

/**
 * Un título con una palabra larguísima sin espacios (lo escribe el admin) no debe ensanchar la página en un móvil:
 * un desborde horizontal obliga a desplazarse de lado y descoloca toda la maquetación.
 */
const LONG_WORD = "Supercalifragilisticoespialidosoastrologicamenteincreíbletituloexcesivamentelargosinespacios";
const WIDTHS = [320, 412] as const;
const PATHS = ["/", "/blog"] as const;

const prefixes: string[] = [];
test.afterEach(async () => {
  for (const value of prefixes.splice(0)) await deleteE2EByPrefix(value);
});

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("títulos largos sin espacios", () => {
  for (const width of WIDTHS) {
    for (const path of PATHS) {
      test(`${path} a ${width} px: sin desplazamiento horizontal y el título cabe en la pantalla`, async ({ page, users }) => {
        const prefix = newE2EPrefix();
        prefixes.push(prefix);
        const title = `${prefix} ${LONG_WORD}`;
        const id = await createE2EDraft(users.admin.id, `${prefix}-largo`, title);
        await setE2EPostPublished(id, true);

        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        const link = page.getByRole("link", { name: title, exact: true });
        await expect(link).toBeVisible();

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
        const box = await link.boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      });
    }
  }
});
