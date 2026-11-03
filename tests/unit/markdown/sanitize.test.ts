import { describe, expect, it } from "vitest";
import { problemsIn, render, tagsOf } from "./support";

const attributeNames = (html: string) => tagsOf(html).flatMap((tag) => [...tag.attributes.keys()]);

// Payloads reales de XSS, como Markdown y como HTML crudo, con mayúsculas, entidades y codificaciones.
const PAYLOADS: [string, string][] = [
  ["script", "<script>alert(1)</script>"],
  ["script en mayúsculas mixtas", "<ScRiPt>alert(1)</sCrIpT>"],
  ["script con src", '<SCRIPT SRC="//evil.test/x.js"></SCRIPT>'],
  ["script sin cerrar", "<script>alert(1)"],
  ["img onerror", "<img src=x onerror=alert(1)>"],
  ["img ONERROR en mayúsculas", '<IMG SRC="x" ONERROR="alert(1)">'],
  ["img con comillas rotas", "<img src='x'onerror='alert(1)'>"],
  ["iframe", '<iframe src="//evil.test"></iframe>'],
  ["iframe srcdoc", '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
  ["object", '<object data="javascript:alert(1)"></object>'],
  ["embed", '<embed src="javascript:alert(1)">'],
  ["svg onload", "<svg onload=alert(1)>"],
  ["svg con script", "<svg><script>alert(1)</script></svg>"],
  ["math", '<math><mi xlink:href="javascript:alert(1)">x</mi></math>'],
  ["form", '<form action="javascript:alert(1)"><input type="submit"></form>'],
  ["input autofocus", "<input autofocus onfocus=alert(1)>"],
  ["style", "<style>@import 'javascript:alert(1)';</style>"],
  ["base", '<base href="javascript:alert(1)//">'],
  ["meta refresh", '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'],
  ["link", '<link rel="stylesheet" href="//evil.test/x.css">'],
  ["details ontoggle", "<details open ontoggle=alert(1)>x</details>"],
  ["body onload", "<body onload=alert(1)>"],
  ["comentario", "<!-- <script>alert(1)</script> -->"],
  ["CDATA", "<![CDATA[<script>alert(1)</script>]]>"],
  ["a con javascript", '<a href="javascript:alert(1)">x</a>'],
  ["a con onclick", '<a href="https://ok.test" onclick="alert(1)">x</a>'],
  ["a con JaVaScRiPt", '<a href="JaVaScRiPt:alert(1)">x</a>'],
  ["a con tabulador", '<a href="java\tscript:alert(1)">x</a>'],
  ["a con entidades", '<a href="&#106;avascript:alert(1)">x</a>'],
  ["a con data", '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
  ["estilo en línea", '<p style="background:url(javascript:alert(1))">x</p>'],
  ["estilo con expression", '<div style="width:expression(alert(1))">x</div>'],
  ["atributo on* suelto", "<p onmouseover=alert(1)>x</p>"],
  ["id y name (DOM clobbering)", '<a id="x" name="y">x</a><img name="documentElement">'],
  ["texto codificado", "&lt;script&gt;alert(1)&lt;/script&gt;"],
  ["entidad numérica", "&#60;script&#62;alert(1)&#60;/script&#62;"],
  ["enlace javascript", "[x](javascript:alert(1))"],
  ["enlace JaVaScRiPt", "[x](JaVaScRiPt:alert(1))"],
  ["enlace con entidades", "[x](&#106;avascript:alert(1))"],
  ["enlace con tabulador", "[x](java\tscript:alert(1))"],
  ["enlace con salto", "[x](java\nscript:alert(1))"],
  ["enlace vbscript", "[x](vbscript:msgbox(1))"],
  ["enlace file", "[x](file:///etc/passwd)"],
  ["enlace data html", "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
  ["enlace con comillas", '[x](https://ok.test" onclick="alert(1))'],
  ["enlace por referencia", "[x][1]\n\n[1]: javascript:alert(1)"],
  ["autoenlace javascript", "<javascript:alert(1)>"],
  ["autoenlace data", "<data:text/html,x>"],
  ["imagen javascript", "![x](javascript:alert(1))"],
  ["imagen data svg", '![x](data:image/svg+xml,<svg onload=alert(1)>)'],
  ["imagen con onerror en el alt", '![" onerror="alert(1)](https://evil.test/x.png)'],
  ["imagen externa", "![x](https://evil.test/x.png)"],
  ["imagen por referencia", "![x][1]\n\n[1]: javascript:alert(1)"],
  ["HTML en un título", "# <img src=x onerror=alert(1)> Título"],
  ["HTML en código en línea", "`<script>alert(1)</script>`"],
  ["HTML en bloque de código", "```html\n<script>alert(1)</script>\n```"],
  ["lenguaje del bloque malicioso", '```"><script>alert(1)</script>\ncódigo\n```'],
  ["lenguaje con espacios", "```js onclick=alert(1)\ncódigo\n```"],
  ["pre con tabindex y evento", '<pre tabindex="-1" onfocus=alert(1)>x</pre>'],
  ["pre con tabindex distinto de 0", '<pre tabindex="5"><code>x</code></pre>'],
  ["tabindex en un enlace", '<a href="https://ok.test" tabindex="1" accesskey="x">x</a>'],
];

const WRAPPERS: [string, (payload: string) => string][] = [
  ["suelto", (p) => p],
  ["en un párrafo", (p) => `Antes ${p} después`],
  ["en negrita", (p) => `**${p}**`],
  ["en una lista", (p) => `- ${p}\n- otro`],
  ["en una cita", (p) => `> ${p}`],
  ["dentro de un enlace", (p) => `[${p}](https://ok.test/a)`],
  ["en un título", (p) => `## ${p}`],
];

describe("sanitizado: la salida solo contiene etiquetas y atributos de la lista blanca (A05)", () => {
  describe.each(WRAPPERS)("%s", (_nombre, wrap) => {
    it.each(PAYLOADS)("%s", (_caso, payload) => {
      const html = render(wrap(payload));
      expect(problemsIn(html)).toEqual([]);
      expect(html).not.toMatch(/<script|<iframe|<object|<embed|<svg|<style|<form|<meta|<base|<link|<input|<body|<math/i);
      // Solo importan los atributos de etiquetas reales: el texto escapado (p. ej. «onclick=») es inofensivo.
      expect(attributeNames(html).filter((name) => /^on/i.test(name) || ["style", "id", "name"].includes(name.toLowerCase()))).toEqual([]);
    });
  });

  it("el HTML crudo no se conserva ni se interpreta: no se vuelve a convertir en etiquetas", () => {
    const html = render("<script>alert(1)</script><b>hola</b> <i onclick=x>texto</i>");
    expect(tagsOf(html).map((tag) => tag.name)).not.toContain("script");
    expect(tagsOf(html).map((tag) => tag.name)).not.toContain("b");
    expect(tagsOf(html).map((tag) => tag.name)).not.toContain("i");
  });

  it("el texto codificado sigue siendo texto: no se decodifica a etiquetas", () => {
    const html = render("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(tagsOf(html).filter((tag) => tag.name === "script")).toEqual([]);
  });

  it("no conserva ningún atributo de estilo, id, name ni manejador de eventos", () => {
    const html = render('<p style="color:red" id="a" name="b" onclick="alert(1)" class="x">texto</p>\n\n[x](https://ok.test){#id .clase}');
    expect(html).not.toMatch(/\s(style|id|name|onclick|class)=/i);
  });
});

describe("el Markdown legítimo sigue funcionando", () => {
  it("párrafos, énfasis y negrita", () => {
    const html = render("Un *énfasis*, una **negrita** y un _énfasis_ más.");
    expect(html).toMatch(/<p>Un <em>énfasis<\/em>, una <strong>negrita<\/strong> y un <em>énfasis<\/em> más\.<\/p>/);
  });

  it("los títulos bajan un nivel: el contenido nunca genera un h1 (el único h1 es el de la página)", () => {
    const html = render("# Uno\n\n## Dos\n\n### Tres\n\n#### Cuatro\n\n##### Cinco\n\n###### Seis");
    expect(html).toMatch(/<h2>Uno<\/h2>/);
    expect(html).toMatch(/<h3>Dos<\/h3>/);
    expect(html).toMatch(/<h4>Tres<\/h4>/);
    expect(html).toMatch(/<h5>Cuatro<\/h5>/);
    expect(html).toMatch(/<h6>Cinco<\/h6>/);
    expect(html).toMatch(/<h6>Seis<\/h6>/);
    expect(tagsOf(html).map((tag) => tag.name)).not.toContain("h1");
  });

  it("listas ordenadas y sin ordenar, también anidadas", () => {
    const html = render("- a\n- b\n  - b1\n\n1. uno\n2. dos");
    expect(html).toMatch(/<ul>\s*<li>a<\/li>\s*<li>b\s*<ul>\s*<li>b1<\/li>/);
    expect(html).toMatch(/<ol>\s*<li>uno<\/li>\s*<li>dos<\/li>/);
  });

  it("enlaces, citas y líneas horizontales", () => {
    const html = render("> una cita\n\n---\n\n[web](https://ejemplo.test/a)");
    expect(html).toMatch(/<blockquote>\s*<p>una cita<\/p>\s*<\/blockquote>/);
    expect(html).toMatch(/<hr\/?>/);
    expect(html).toContain('href="https://ejemplo.test/a"');
  });

  it("código en línea y bloques de código con lenguaje; su contenido sale como texto", () => {
    const html = render("Usa `<b>x</b>` aquí.\n\n```js\nconst a = '<script>';\n```");
    expect(html).toMatch(/<code>&lt;b&gt;x&lt;\/b&gt;<\/code>/);
    expect(html).toMatch(/<pre tabindex="0"><code class="language-js">const a = &#x27;&lt;script&gt;&#x27;;\s*<\/code><\/pre>/);
    expect(problemsIn(html)).toEqual([]);
  });

  it("saltos de línea duros", () => {
    expect(render("uno  \ndos")).toMatch(/uno<br\/?>\s*dos/);
  });

  it("un texto vacío da una salida vacía", () => {
    expect(render("")).toBe("");
  });
});
