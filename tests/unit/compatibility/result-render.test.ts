import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompatibilityResult } from "@/app/compatibilidad/compatibility-result";
import { calculateCompatibility, type CompatibilityResultData } from "@/lib/compatibility/calculate";
import { createCompatibilityLimiter } from "@/lib/compatibility/limiter";
import { dates, TODAY } from "./support";

async function realResult(a: string, b: string): Promise<CompatibilityResultData> {
  const state = await calculateCompatibility({
    formData: dates(a, b),
    today: TODAY,
    limiter: createCompatibilityLimiter(),
    ip: "203.0.113.5",
  });
  if (!state.ok) throw new Error("Se esperaba un resultado");
  return state.result;
}

const render = (result: CompatibilityResultData) => renderToStaticMarkup(createElement(CompatibilityResult, { result }));

describe("CompatibilityResult", () => {
  it("muestra signos, elementos, nivel, descripción, explicación y aviso con los datos recibidos", async () => {
    const result = await realResult("2001-03-21", "2001-06-21");
    const html = render(result);
    for (const text of [
      result.people[0].sign,
      result.people[0].element,
      result.people[1].sign,
      result.people[1].element,
      result.levelName,
      result.levelDescription,
      result.disclaimer,
    ]) {
      expect(html).toContain(text);
    }
    // El texto contiene tildes y comas: se comprueba sin depender del escape de comillas.
    expect(html.replaceAll("&#x27;", "'")).toContain(result.text);
  });

  it("el nivel lleva un icono y texto: nunca solo color", async () => {
    const html = render(await realResult("2001-03-21", "2001-06-21"));
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain("Baja");
  });

  it("el símbolo del signo está oculto a los lectores de pantalla y el nombre va como texto", async () => {
    const result = await realResult("2001-03-21", "2001-06-21");
    const html = render(result);
    const hiddenTexts = [...html.matchAll(/<[^>]*aria-hidden="true"[^>]*>([^<]*)</g)].map((match) => match[1]);
    expect(hiddenTexts).toContain(result.people[0].symbol);
    expect(hiddenTexts).toContain(result.people[1].symbol);
    expect(html).toContain(result.people[0].sign);
  });

  it("el aviso se muestra una sola vez, dentro del resultado", async () => {
    const result = await realResult("2001-03-21", "2001-06-21");
    const html = render(result);
    expect(html.split(result.disclaimer)).toHaveLength(2);
    expect(html).toContain('data-testid="disclaimer"');
  });

  it("tiene una región con nombre «Resultado»", async () => {
    const html = render(await realResult("2001-03-21", "2001-06-21"));
    expect(html).toMatch(/<section[^>]*aria-labelledby="([^"]+)"/);
    expect(html).toMatch(/<h2[^>]*>Resultado<\/h2>/);
  });

  describe("los textos se pintan como texto (A05)", () => {
    const payloads = [
      "<script>alert(1)</script>",
      '<img src=x onerror="alert(1)">',
      '"><svg onload=alert(1)>',
      "javascript:alert(1)",
    ];

    it.each(payloads)("el payload %j sale escapado en todos los campos", async (payload) => {
      const base = await realResult("2001-03-21", "2001-06-21");
      const hostile: CompatibilityResultData = {
        ...base,
        people: [
          { sign: payload, symbol: payload, element: payload },
          { sign: payload, symbol: payload, element: payload },
        ],
        levelName: payload,
        levelDescription: payload,
        text: payload,
        disclaimer: payload,
      };
      const html = render(hostile);

      expect(html).not.toMatch(/<script|<img|<svg[^>]*onload|onerror=["']?alert/i);
      expect(html).not.toContain("dangerouslySetInnerHTML");
      if (payload.startsWith("<")) expect(html).toContain("&lt;");
    });
  });
});
