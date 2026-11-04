import type { APIRequestContext, Page } from "@playwright/test";

/** Partes del FormData que el navegador envía a una Server Action (los archivos, en base64). */
export type Captured = {
  url: string;
  headers: Record<string, string>;
  entries: Array<{ name: string; text?: string; file?: { name: string; type: string; base64: string } }>;
};

/**
 * Playwright no expone el cuerpo de una petición con FormData (`postDataBuffer()` es nulo), así que se envuelve `fetch` en la
 * página y se guardan las partes de cada Server Action. Debe instalarse ANTES de navegar a la página que envía el formulario.
 */
export async function installCapture(page: Page) {
  await page.addInitScript(() => {
    const store: unknown[] = [];
    (window as unknown as { __actions: unknown[] }).__actions = store;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      if (init?.method === "POST" && headers.has("next-action") && init.body instanceof FormData) {
        const entries: Captured["entries"] = [];
        for (const [name, value] of init.body.entries()) {
          if (typeof value === "string") entries.push({ name, text: value });
          else {
            const bytes = new Uint8Array(await value.arrayBuffer());
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            entries.push({ name, file: { name: value.name, type: value.type, base64: btoa(binary) } });
          }
        }
        store.push({ url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url, headers: Object.fromEntries(headers), entries });
      }
      return original(input, init);
    };
  });
}

/** Última petición de Server Action capturada en la página (espera a que exista). */
export async function lastCaptured(page: Page): Promise<Captured> {
  await page.waitForFunction(() => ((window as unknown as { __actions?: unknown[] }).__actions?.length ?? 0) > 0);
  return page.evaluate(() => (window as unknown as { __actions: Captured[] }).__actions.at(-1) as Captured);
}

/**
 * Reenvía la petición capturada con otro contexto (otras cookies) y, si se pide, con otro archivo en el campo cuyo nombre
 * termina en `fileField`. Se construye un FormData y no un objeto: React necesita recibir las partes anidadas ANTES de la
 * raíz «0», y en un objeto de JavaScript las claves numéricas se enumeran siempre primero.
 */
export function replay(request: APIRequestContext, captured: Captured, changes: { fileField: string; file?: Buffer }) {
  const multipart = new FormData();
  for (const entry of captured.entries) {
    if (entry.file) {
      const bytes = entry.name.endsWith(changes.fileField) && changes.file ? changes.file : Buffer.from(entry.file.base64, "base64");
      multipart.append(entry.name, new File([new Uint8Array(bytes)], entry.file.name || "imagen.png", { type: entry.file.type || "image/png" }));
    } else {
      multipart.append(entry.name, entry.text ?? "");
    }
  }
  const headers = Object.fromEntries(Object.entries(captured.headers).filter(([name]) => !["content-type", "content-length"].includes(name.toLowerCase())));
  return request.post(captured.url, { headers, multipart, failOnStatusCode: false });
}
