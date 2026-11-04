import { describe, expect, it } from "vitest";
import * as messages from "@/lib/admin/messages";
import { LEAK_PATTERN } from "../admin/support";

describe("mensajes de la portada", () => {
  it("los textos que ve el admin son los acordados", () => {
    expect(messages.COVER_INVALID_TYPE).toBe("La imagen debe ser JPEG, PNG o WebP.");
    expect(messages.COVER_CORRUPT).toBe("El archivo no es una imagen válida o está dañado.");
    expect(messages.COVER_EMPTY).toBe("El archivo está vacío.");
    expect(messages.COVER_TOO_LARGE).toBe("La imagen no puede superar los 2 MB.");
    expect(messages.COVER_DIMENSIONS).toBe("La imagen es demasiado grande (máximo 8000 px por lado y 25 megapíxeles).");
    expect(messages.COVER_ALT_REQUIRED).toBe("El texto alternativo de la portada es obligatorio.");
    expect(messages.COVER_ALT_TOO_LONG).toBe("El texto alternativo no puede superar los 200 caracteres.");
    expect(messages.COVER_ALT_WITHOUT_COVER).toBe("El texto alternativo solo se usa con una portada.");
    expect(messages.COVER_CONFLICT).toBe("Elige entre quitar la portada o subir una nueva.");
    expect(messages.UPLOAD_RATE_LIMIT).toBe("Demasiadas subidas seguidas. Inténtalo de nuevo en unos minutos.");
    expect(messages.COVER_OLD_NOT_REMOVED).toBe("Los cambios se guardaron, pero no se pudo borrar la imagen anterior.");
    expect(messages.COVER_NOT_REMOVED_ON_DELETE).toBe("La entrada se eliminó, pero no se pudo borrar su imagen.");
  });

  it("ninguno revela rutas, nombres de archivo ni términos técnicos", () => {
    const texts = [
      messages.COVER_INVALID_TYPE,
      messages.COVER_CORRUPT,
      messages.COVER_EMPTY,
      messages.COVER_TOO_LARGE,
      messages.COVER_DIMENSIONS,
      messages.COVER_ALT_REQUIRED,
      messages.COVER_ALT_TOO_LONG,
      messages.COVER_ALT_WITHOUT_COVER,
      messages.COVER_CONFLICT,
      messages.UPLOAD_RATE_LIMIT,
      messages.COVER_OLD_NOT_REMOVED,
      messages.COVER_NOT_REMOVED_ON_DELETE,
    ];
    for (const text of texts) {
      expect(text).not.toMatch(LEAK_PATTERN);
      expect(text).not.toMatch(/post-images|storage|bucket|\.png|\.jpg|\/|\\/i);
    }
  });
});
