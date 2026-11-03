import { describe, expect, it } from "vitest";
import { coverImageUrl } from "@/lib/blog/cover";
import { COVER_NAME, COVER_URL, ORIGIN } from "./support";

describe("coverImageUrl", () => {
  it.each(["jpg", "png", "webp"])("construye la URL pública de Storage para un nombre generado .%s", (extension) => {
    const name = `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.${extension}`;
    expect(coverImageUrl(ORIGIN, name)).toBe(`${ORIGIN}/storage/v1/object/public/post-images/${name}`);
  });

  it("acepta la URL del proyecto con barra final o con ruta y usa solo su origen", () => {
    expect(coverImageUrl(`${ORIGIN}/`, COVER_NAME)).toBe(COVER_URL);
    expect(coverImageUrl(`${ORIGIN}/rest/v1`, COVER_NAME)).toBe(COVER_URL);
  });

  it.each([null, "", "portada.png", "../x.png", "a/b.png", `${COVER_NAME}/../x`, "11111111-2222-3333-4444-555555555555.gif", "11111111-2222-3333-4444-555555555555.svg", "11111111-2222-3333-4444-555555555555.png?x=1", "11111111-2222-3333-4444-555555555555.PNG", " 11111111-2222-3333-4444-555555555555.png", "<script>.png"])(
    "un nombre que no es el generado (%j) no da URL",
    (path) => {
      expect(coverImageUrl(ORIGIN, path)).toBeNull();
    },
  );

  it.each([undefined, null, "", "no es una url", "http://abcdefghijklmnopqrst.supabase.co", "ftp://x.test", "https://user:pw@abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co:8443"])(
    "un origen que no es un https limpio (%j) no da URL",
    (origin) => {
      expect(coverImageUrl(origin, COVER_NAME)).toBeNull();
    },
  );
});
