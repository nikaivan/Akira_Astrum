import { describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { LEAK_PATTERN } from "./support";

describe("mensajes del panel", () => {
  it("los textos que ve el admin son los acordados", () => {
    expect(messages.SLUG_TAKEN).toBe("Ya existe una entrada con esa dirección.");
    expect(messages.SLUG_LOCKED).toBe("La dirección de una entrada publicada no se puede cambiar. Despublícala primero.");
    expect(messages.SLUG_FROM_TITLE_FAILED).toBe("No se pudo generar la dirección a partir del título. Escríbela a mano.");
    expect(messages.CATEGORY_MISSING).toBe("Alguna de las categorías elegidas ya no existe.");
    expect(messages.ALREADY_PUBLISHED).toBe("La entrada ya estaba publicada.");
    expect(messages.ALREADY_DRAFT).toBe("La entrada ya estaba en borrador.");
    expect(messages.POST_NOT_FOUND).toBe("La entrada no existe.");
    expect(messages.CATEGORY_NOT_FOUND).toBe("La categoría no existe.");
    expect(messages.INVALID_REQUEST).toBe("La solicitud no es válida.");
    expect(messages.GENERIC_ERROR).toBe("No se pudo completar la operación. Inténtalo de nuevo.");
  });

  it("ningún mensaje contiene términos técnicos de la base de datos", () => {
    const texts = Object.values(messages).filter((value) => typeof value === "string") as string[];
    expect(texts.length).toBeGreaterThanOrEqual(10);
    for (const text of texts) expect(text).not.toMatch(LEAK_PATTERN);
  });
});
