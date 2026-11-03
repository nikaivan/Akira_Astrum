import { describe, expect, it } from "vitest";
import { anchors, render } from "./support";

describe("enlaces: solo http, https y mailto, siempre con rel seguro", () => {
  it.each(["http://ejemplo.test/a", "https://ejemplo.test/a?b=1&c=2#d", "HTTPS://EJEMPLO.TEST/"])("un enlace %s se abre en otra pestaña con rel noopener noreferrer", (url) => {
    const [link] = anchors(render(`[texto](${url})`));
    expect(link.href?.toLowerCase()).toContain("ejemplo.test");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
    expect(link.text).toBe("texto");
  });

  it("un autoenlace http también lleva rel seguro", () => {
    const [link] = anchors(render("<https://ejemplo.test/auto>"));
    expect(link.href).toBe("https://ejemplo.test/auto");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("mailto está permitido y lleva rel seguro", () => {
    const [link] = anchors(render("[escríbeme](mailto:hola@ejemplo.test)"));
    expect(link.href).toBe("mailto:hola@ejemplo.test");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,x"],
    ["vbscript:msgbox(1)"],
    ["file:///etc/passwd"],
    ["ftp://ejemplo.test/x"],
    ["tel:+34600000000"],
    ["sms:+34600000000"],
    ["/ruta/relativa"],
    ["ruta/relativa"],
    ["#ancla"],
    ["//evil.test/x"],
    ["\\\\evil.test\\x"],
    ["?consulta=1"],
  ])("el enlace a %s se pinta como texto, sin enlace", (url) => {
    const html = render(`Ver [el texto](${url}) ahora`);
    expect(anchors(html)).toEqual([]);
    expect(html).toContain("el texto");
    expect(html).not.toMatch(/href=/i);
  });

  it("el texto del enlace se conserva escapado", () => {
    const html = render("[<b>x</b> & y](https://ejemplo.test)");
    expect(anchors(html)[0].text).not.toContain("<b>");
  });

  it("todos los enlaces de un texto con varios cumplen la regla", () => {
    const html = render("[a](https://uno.test) [b](javascript:alert(1)) [c](mailto:x@y.test) [d](data:x) [e](http://dos.test)");
    const links = anchors(html);
    expect(links).toHaveLength(3);
    for (const link of links) expect(link.rel).toBe("noopener noreferrer");
  });
});
