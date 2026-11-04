import { describe, expect, it } from "vitest";
import { IMAGE_URL, ORIGIN, render, tagsOf } from "./support";

/**
 * A05: el contenido de las entradas es hostil por defecto. Complementa a images.test.ts con el HTML que se puede
 * escribir a mano junto a una imagen válida y con lo que debe cumplir la imagen del proyecto al pintarse.
 */
const imgs = (html: string) => html.match(/<img\b/g)?.length ?? 0;
const IMG_TAGS = (html: string) => tagsOf(html).filter((tag) => tag.name === "img");
const HOST = "abcdefghijklmnopqrst.supabase.co";
const FILE = "11111111-2222-3333-4444-555555555555.png";

describe("HTML escrito a mano alrededor de las imágenes", () => {
  it.each([
    ["onerror en una etiqueta img", `<img src="${IMAGE_URL}" onerror="alert(1)">`],
    ["style en una etiqueta img", `<img src="${IMAGE_URL}" style="width:9999px;position:fixed">`],
    ["una etiqueta img con srcset", `<img src="${IMAGE_URL}" srcset="https://evil.test/a.png 1x">`],
    ["una etiqueta img con otros atributos", `<img src="${IMAGE_URL}" width="9999" height="1" class="x" id="y" loading="eager">`],
    ["un SVG en línea", '<svg onload="alert(1)"><image href="https://evil.test/a.png"/></svg>'],
    ["una imagen externa en HTML", '<img src="https://evil.test/a.png">'],
    ["una imagen data: en HTML", '<img src="data:image/svg+xml,<svg onload=alert(1)>">'],
    ["un iframe", '<iframe src="https://evil.test"></iframe>'],
  ])("%s no genera ninguna imagen ni atributo peligroso", (_caso, html) => {
    const out = render(`Antes\n\n${html}\n\nDespués`, ORIGIN);
    expect(imgs(out)).toBe(0);
    expect(out).not.toMatch(/evil\.test|onerror|<svg|<iframe|style=|srcset=/i);
    expect(out).toContain("Antes");
    expect(out).toContain("Después");
  });

  it("una imagen válida junto a una externa: solo se pinta la del proyecto y el resto del texto se conserva", () => {
    const out = render(`Primero\n\n![ok](${IMAGE_URL})\n\n![mala](https://evil.test/a.png)\n\nÚltimo párrafo con **negrita**`, ORIGIN);
    expect(imgs(out)).toBe(1);
    expect(out).not.toMatch(/evil\.test/);
    expect(out).toContain("<strong>negrita</strong>");
    expect(out).toContain("Primero");
    expect(out).toContain("Último párrafo");
  });

  it.each([
    ["un título con un manejador", `![x](${IMAGE_URL} "t\\" onerror=\\"alert(1)")`],
    ["una consulta añadida", `![x](${IMAGE_URL}?onerror=1)`],
    ["un fragmento añadido", `![x](${IMAGE_URL}#x)`],
    ["un puerto añadido", `![x](https://${HOST}:444/storage/v1/object/public/post-images/${FILE})`],
    ["una imagen dentro de un enlace a otro sitio", `[![x](${IMAGE_URL})](https://evil.test/)`],
  ])("%s: no queda ningún atributo que no esté en la lista blanca", (_caso, source) => {
    const out = render(source, ORIGIN);
    // next/image añade su propio style (posición y color); lo que no puede haber es un manejador ni un style con url().
    for (const tag of IMG_TAGS(out)) expect([...tag.attributes.keys()].filter((name) => /^on/i.test(name))).toEqual([]);
    expect(out).not.toMatch(/\sonerror\s*=|\sonload\s*=|style="[^"]*url\(/i);
  });
});

describe("la imagen del contenido se muestra de forma segura y responsiva", () => {
  const out = render(`![Luna llena sobre el mar](${IMAGE_URL})`, ORIGIN);
  const [img] = IMG_TAGS(out);

  it("lleva su texto alternativo", () => {
    expect(img.attributes.get("alt")).toBe("Luna llena sobre el mar");
  });

  it("se carga de forma diferida y con tamaños responsivos", () => {
    expect(img.attributes.get("loading")).toBe("lazy");
    expect(img.attributes.get("sizes")).toMatch(/100vw/);
    expect(img.attributes.get("srcSet")).toBeTruthy();
  });

  it("nunca desborda: ocupa como máximo el ancho del contenedor y mantiene sus proporciones", () => {
    expect(out).toMatch(/class="[^"]*\bw-full\b[^"]*"/);
    expect(out).toMatch(/object-contain|object-cover/);
    expect(out).not.toMatch(/\bwidth="\d{4,}"/);
  });

  it("no usa priority ni precarga (no compite con el contenido principal)", () => {
    expect(img.attributes.get("fetchpriority")).not.toBe("high");
    expect(out).not.toMatch(/<link[^>]*rel="preload"/);
  });

  it("solo se pinta si su nombre es el generado: un nombre elegido por el autor se descarta", () => {
    expect(imgs(render(`![x](${ORIGIN}/storage/v1/object/public/post-images/mi-foto.png)`, ORIGIN))).toBe(0);
  });
});
