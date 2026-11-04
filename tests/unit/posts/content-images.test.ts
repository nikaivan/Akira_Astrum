import { describe, expect, it } from "vitest";
import { imageMarkdown, insertSnippet, projectImageNames } from "@/lib/posts/content-images";
import { IMAGE_URL, ORIGIN, render, tagsOf } from "../markdown/support";

const NAME_A = "11111111-2222-3333-4444-555555555555.png";
const NAME_B = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
const NAME_C = "99999999-8888-4777-8666-555555555555.webp";
const BASE = `${ORIGIN}/storage/v1/object/public/post-images/`;
const HOST = "abcdefghijklmnopqrst.supabase.co";
const imgs = (html: string) => html.match(/<img\b/g)?.length ?? 0;

describe("imageMarkdown: la línea que se escribe en el contenido", () => {
  it("es la sintaxis estándar con el texto alternativo y la URL", () => {
    expect(imageMarkdown(IMAGE_URL, "Luna llena")).toBe(`![Luna llena](${IMAGE_URL})`);
  });

  it("escapa los corchetes y la barra invertida del texto alternativo", () => {
    expect(imageMarkdown(IMAGE_URL, "a [b] \\ c")).toBe(`![a \\[b\\] \\\\ c](${IMAGE_URL})`);
  });

  it.each([
    ["saltos de línea", "una\nlínea\r\ndoble", "una línea doble"],
    ["tabuladores y caracteres de control", "a\tb\u0000c\u001bd", "a b c d"],
    ["espacios al principio, al final y repetidos", "   hola    mundo   ", "hola mundo"],
  ])("normaliza %s a un solo espacio", (_caso, alt, expected) => {
    expect(imageMarkdown(IMAGE_URL, alt)).toBe(`![${expected}](${IMAGE_URL})`);
  });

  it("siempre es una sola línea", () => {
    expect(imageMarkdown(IMAGE_URL, "uno\ndos\n\ntres")).not.toMatch(/\n/);
  });

  it.each([
    ["cerrar la imagen y abrir otra", "x](https://evil.test/a.png) ![y](https://evil.test/b.png"],
    ["un enlace", "[pulsa](https://evil.test)"],
    ["HTML con un manejador", '<img src=x onerror="alert(1)">'],
    ["un título", 'a" title="b'],
    ["varios cierres", "]]]]((((\\\\"],
  ])("el texto alternativo hostil (%s) no cambia el destino: se pinta una sola imagen, la del proyecto", (_caso, alt) => {
    const html = render(imageMarkdown(IMAGE_URL, alt), ORIGIN);
    expect(imgs(html)).toBe(1);
    expect(html).not.toMatch(/src="https?:\/\/evil\.test/);
    expect(html).not.toMatch(/<a\b/);
    expect(tagsOf(html).flatMap((tag) => [...tag.attributes.keys()]).filter((name) => /^on/i.test(name))).toEqual([]);
  });

  it("el texto alternativo se conserva tal cual al pintarlo (ida y vuelta)", () => {
    const html = render(imageMarkdown(IMAGE_URL, "Un [gato] dormido \\ al sol"), ORIGIN);
    expect(html).toContain('alt="Un [gato] dormido \\ al sol"');
  });
});

describe("projectImageNames: qué archivos del bucket menciona un contenido", () => {
  it("devuelve los nombres generados de las imágenes del proyecto, sin repetir y en orden", () => {
    const text = `![a](${BASE}${NAME_A})\n\ntexto\n\n![b](${BASE}${NAME_B})\n\n![otra vez](${BASE}${NAME_A})`;
    expect(projectImageNames(text, ORIGIN)).toEqual([NAME_A, NAME_B]);
  });

  it("también las encuentra fuera de la sintaxis de imagen (referencias, enlaces y texto): borrar solo cuando no aparece en ninguna parte", () => {
    const text = `[ref]: ${BASE}${NAME_A}\n\n[enlace](${BASE}${NAME_B})\n\nmira ${BASE}${NAME_C} aquí`;
    expect(projectImageNames(text, ORIGIN).sort()).toEqual([NAME_A, NAME_B, NAME_C].sort());
  });

  it.each([
    ["otro host", `https://evil.test/storage/v1/object/public/post-images/${NAME_A}`],
    ["http en el host del proyecto", `http://${HOST}/storage/v1/object/public/post-images/${NAME_A}`],
    ["un subdominio engañoso", `https://${HOST}.evil.test/storage/v1/object/public/post-images/${NAME_A}`],
    ["otro bucket", `${ORIGIN}/storage/v1/object/public/otro-bucket/${NAME_A}`],
    ["la ruta privada", `${ORIGIN}/storage/v1/object/authenticated/post-images/${NAME_A}`],
    ["un salto de directorio", `${BASE}../${NAME_A}`],
    ["un salto de directorio codificado", `${BASE}%2e%2e/${NAME_A}`],
    ["un nombre que no es el generado", `${BASE}portada.png`],
    ["un nombre generado con otra extensión", `${BASE}11111111-2222-3333-4444-555555555555.svg`],
    ["un nombre dentro de una subcarpeta", `${BASE}carpeta/${NAME_A}`],
    ["una ruta relativa", `/storage/v1/object/public/post-images/${NAME_A}`],
    ["data:", "data:image/png;base64,iVBORw0KGgo="],
  ])("ignora %s", (_caso, url) => {
    expect(projectImageNames(`![x](${url})`, ORIGIN)).toEqual([]);
  });

  it.each([undefined, null, "", "no es una url", `http://${HOST}`, `https://usuario@${HOST}`])("sin un origen https limpio (%j) no devuelve nada", (origin) => {
    expect(projectImageNames(`![x](${BASE}${NAME_A})`, origin)).toEqual([]);
  });

  it("un contenido vacío o sin imágenes no devuelve nada", () => {
    expect(projectImageNames("", ORIGIN)).toEqual([]);
    expect(projectImageNames("Solo texto con **negrita**.", ORIGIN)).toEqual([]);
  });

  it("solo devuelve nombres sueltos, nunca una ruta ni la URL entera", () => {
    for (const name of projectImageNames(`![a](${BASE}${NAME_A})`, ORIGIN)) expect(name).not.toMatch(/[/:]/);
  });
});

describe("insertSnippet: dónde y cómo se escribe la línea en el texto", () => {
  const IMG = "![x](https://h/a.png)";

  it("en un texto vacío es solo la línea, con el cursor al final", () => {
    expect(insertSnippet("", 0, 0, IMG)).toEqual({ text: IMG, cursor: IMG.length });
  });

  it("en medio de un párrafo la separa con una línea en blanco antes y otra después", () => {
    const result = insertSnippet("Hola mundo", 4, 4, IMG);
    expect(result.text).toBe(`Hola\n\n${IMG}\n\n mundo`);
    expect(result.cursor).toBe(`Hola\n\n${IMG}\n\n`.length);
  });

  it("al final del texto añade una línea en blanco antes y ninguna después", () => {
    const result = insertSnippet("Hola", 4, 4, IMG);
    expect(result.text).toBe(`Hola\n\n${IMG}`);
    expect(result.cursor).toBe(result.text.length);
  });

  it("al principio del texto añade una línea en blanco después", () => {
    expect(insertSnippet("Hola", 0, 0, IMG).text).toBe(`${IMG}\n\nHola`);
  });

  it("no duplica las líneas en blanco que ya existen", () => {
    const text = "Uno\n\nDos";
    expect(insertSnippet(text, 5, 5, IMG).text).toBe(`Uno\n\n${IMG}\n\nDos`);
  });

  it("completa una sola línea en blanco hasta dos saltos de línea", () => {
    expect(insertSnippet("Uno\nDos", 4, 4, IMG).text).toBe(`Uno\n\n${IMG}\n\nDos`);
  });

  it("sustituye la selección", () => {
    expect(insertSnippet("Hola querido mundo", 5, 12, IMG).text).toBe(`Hola \n\n${IMG}\n\n mundo`);
  });

  it("una selección invertida o fuera de rango se ajusta al texto", () => {
    expect(insertSnippet("Hola", 99, 120, IMG).text).toBe(`Hola\n\n${IMG}`);
    expect(insertSnippet("Hola", -5, -1, IMG).text).toBe(`${IMG}\n\nHola`);
    expect(insertSnippet("Hola mundo", 8, 4, IMG).text).toBe(`Hola\n\n${IMG}\n\ndo`);
  });

  it("nunca pierde texto que no estaba seleccionado", () => {
    const result = insertSnippet("Antes y después", 5, 5, IMG);
    expect(result.text.replace(IMG, "").replace(/\s+/g, " ").trim()).toBe("Antes y después");
  });
});
