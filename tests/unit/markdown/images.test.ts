import { describe, expect, it } from "vitest";
import { IMAGE_URL, ORIGIN, render, tagsOf } from "./support";

const imgs = (html: string) => html.match(/<img\b/g)?.length ?? 0;
const HOST = "abcdefghijklmnopqrst.supabase.co";
const FILE = "11111111-2222-3333-4444-555555555555.png";

describe("imágenes del Markdown: solo las del Storage público del proyecto", () => {
  it("una imagen del bucket del proyecto se pinta con next/image y su texto alternativo", () => {
    const html = render(`![Un gato dormido](${IMAGE_URL})`, ORIGIN);
    expect(imgs(html)).toBe(1);
    expect(html).toContain('alt="Un gato dormido"');
    expect(html).toContain(encodeURIComponent(IMAGE_URL)); // pasa por el optimizador de next/image
  });

  it("sin texto alternativo, la imagen es decorativa (alt vacío)", () => {
    const html = render(`![](${IMAGE_URL})`, ORIGIN);
    expect(imgs(html)).toBe(1);
    expect(html).toContain('alt=""');
  });

  it("el texto alternativo sale escapado", () => {
    const html = render(`![" onerror="alert(1)<script>](${IMAGE_URL})`, ORIGIN);
    expect(html).not.toMatch(/<script/);
    // El texto «onerror=» queda dentro del valor escapado del alt; lo que no puede existir es ese atributo.
    expect(tagsOf(html).flatMap((tag) => [...tag.attributes.keys()]).filter((name) => /^on/i.test(name))).toEqual([]);
  });

  it.each([
    ["otro host", "https://evil.test/x.png"],
    ["http en el host del proyecto", `http://${HOST}/storage/v1/object/public/post-images/${FILE}`],
    ["un subdominio engañoso", `https://${HOST}.evil.test/storage/v1/object/public/post-images/${FILE}`],
    ["un prefijo engañoso", `https://evil-${HOST}/storage/v1/object/public/post-images/${FILE}`],
    ["el host del proyecto como usuario", `https://${HOST}@evil.test/storage/v1/object/public/post-images/${FILE}`],
    ["otro bucket", `${ORIGIN}/storage/v1/object/public/otro-bucket/${FILE}`],
    ["un bucket que solo empieza igual", `${ORIGIN}/storage/v1/object/public/post-images-2/${FILE}`],
    ["la ruta privada de Storage", `${ORIGIN}/storage/v1/object/authenticated/post-images/${FILE}`],
    ["una ruta fuera de Storage", `${ORIGIN}/rest/v1/posts`],
    ["un salto de directorio", `${ORIGIN}/storage/v1/object/public/post-images/../otro/${FILE}`],
    ["un salto de directorio codificado", `${ORIGIN}/storage/v1/object/public/post-images/%2e%2e/${FILE}`],
    ["credenciales en la URL", `https://usuario:clave@${HOST}/storage/v1/object/public/post-images/${FILE}`],
    ["un puerto", `https://${HOST}:8443/storage/v1/object/public/post-images/${FILE}`],
    ["una URL sin protocolo", `//${HOST}/storage/v1/object/public/post-images/${FILE}`],
    ["una ruta relativa", `/storage/v1/object/public/post-images/${FILE}`],
    ["un fichero relativo", FILE],
    ["data:", "data:image/png;base64,iVBORw0KGgo="],
    ["data: svg", "data:image/svg+xml,<svg onload=alert(1)>"],
    ["javascript:", "javascript:alert(1)"],
    ["file:", "file:///etc/passwd"],
    ["blob:", "blob:https://evil.test/1"],
  ])("se descarta una imagen con %s", (_caso, src) => {
    const html = render(`![x](${src})`, ORIGIN);
    expect(imgs(html)).toBe(0);
    expect(html).not.toMatch(/evil\.test/);
    expect(html).not.toMatch(/src=/);
  });

  it.each([undefined, "", "no es una url", "http://abcdefghijklmnopqrst.supabase.co", "https://usuario@abcdefghijklmnopqrst.supabase.co"])(
    "sin un origen https limpio configurado (%j) se descarta toda imagen, incluso la del bucket",
    (origin) => {
      expect(imgs(render(`![x](${IMAGE_URL})`, origin))).toBe(0);
    },
  );

  it("en un texto con varias imágenes solo se pintan las permitidas", () => {
    const html = render(`![a](${IMAGE_URL})\n\n![b](https://evil.test/x.png)\n\n![c](${IMAGE_URL})`, ORIGIN);
    expect(imgs(html)).toBe(2);
    expect(html).not.toMatch(/evil\.test/);
  });
});
