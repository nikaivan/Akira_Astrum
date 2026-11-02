import { describe, expect, it } from "vitest";
import { getCompatibility } from "@/lib/astrology/compatibility";
import type { SignName } from "@/lib/astrology/signs";
import { SPEC } from "./spec";

type Kind = ReturnType<typeof getCompatibility>["textKind"];

const NAMES = SPEC.signs.map((s) => s.name) as SignName[];
const ELEMENT = new Map(SPEC.signs.map((s) => [s.name, s.element]));
const PAIRS = NAMES.flatMap((a) => NAMES.map((b): [SignName, SignName] => [a, b]));
const LEVELS = ["alta", "media", "baja"];
const KINDS = ["mismo-signo", "opuestos", "mismo-elemento", "complementarios", "tension", "ritmos-distintos"];
const LEVEL_OF_LETTER = { A: "alta", M: "media", B: "baja" } as const;

const OPPOSITES: [SignName, SignName][] = [
  ["Aries", "Libra"],
  ["Tauro", "Escorpio"],
  ["Géminis", "Sagitario"],
  ["Cáncer", "Capricornio"],
  ["Leo", "Acuario"],
  ["Virgo", "Piscis"],
];
const isOpposite = (a: SignName, b: SignName) =>
  OPPOSITES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// Sección 4.2: relación entre los elementos de dos signos distintos y no opuestos.
const RELATION: Record<string, Kind> = {
  "Aire|Fuego": "complementarios",
  "Agua|Tierra": "complementarios",
  "Agua|Fuego": "tension",
  "Aire|Tierra": "tension",
  "Fuego|Tierra": "ritmos-distintos",
  "Agua|Aire": "ritmos-distintos",
};

// Sección 4.4: mismo signo, luego opuestos, luego la relación de elementos.
function expectedKind(a: SignName, b: SignName): Kind {
  if (a === b) return "mismo-signo";
  if (isOpposite(a, b)) return "opuestos";
  const [x, y] = [ELEMENT.get(a), ELEMENT.get(b)];
  if (x === y) return "mismo-elemento";
  return RELATION[[x, y].sort().join("|")];
}

describe("getCompatibility", () => {
  it.each<[SignName, SignName, string]>([
    ["Aries", "Leo", "alta"],
    ["Aries", "Aries", "media"],
    ["Aries", "Libra", "media"],
    ["Aries", "Cáncer", "baja"],
    ["Tauro", "Virgo", "alta"],
    ["Tauro", "Leo", "baja"],
    ["Géminis", "Libra", "alta"],
    ["Cáncer", "Escorpio", "alta"],
    ["Libra", "Cáncer", "baja"],
    ["Libra", "Escorpio", "media"],
    ["Virgo", "Acuario", "media"],
    ["Piscis", "Capricornio", "alta"],
    ["Leo", "Escorpio", "baja"],
    ["Escorpio", "Cáncer", "alta"],
  ])("el caso de la sección 7: %s y %s es %s", (a, b, esperado) => {
    expect(getCompatibility(a, b).level).toBe(esperado);
  });

  // Filas copiadas de docs/astrologia-reglas.md (sección 4.1) para comprobarlas a ojo.
  const ORDEN: SignName[] = [
    "Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo",
    "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis",
  ];
  it.each<[SignName, string]>([
    ["Aries", "M M A B A B M B A B A M"],
    ["Tauro", "M M M A B A M M B A B A"],
    ["Capricornio", "B A B M B A B A M M M A"],
  ])("la fila de %s coincide con la tabla del documento", (a, fila) => {
    const esperado = fila.split(" ").map((letra) => LEVEL_OF_LETTER[letra as "A" | "M" | "B"]);
    expect(ORDEN.map((b) => getCompatibility(a, b).level)).toEqual(esperado);
  });

  it("las 144 combinaciones devuelven un nivel, un nombre, un tipo y un texto", () => {
    expect(PAIRS).toHaveLength(144);
    for (const [a, b] of PAIRS) {
      const r = getCompatibility(a, b);
      expect(LEVELS).toContain(r.level);
      expect(r.levelName.length).toBeGreaterThan(0);
      expect(KINDS).toContain(r.textKind);
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  it("es simétrica en el nivel y en el tipo de texto (D1)", () => {
    for (const [a, b] of PAIRS) {
      const ab = getCompatibility(a, b);
      const ba = getCompatibility(b, a);
      expect([ab.level, ab.textKind]).toEqual([ba.level, ba.textKind]);
    }
  });

  it("es determinista", () => {
    for (const [a, b] of PAIRS) {
      expect(getCompatibility(a, b)).toEqual(getCompatibility(a, b));
    }
  });

  it("el mismo signo es siempre media", () => {
    for (const a of NAMES) {
      expect(getCompatibility(a, a)).toMatchObject({ level: "media", textKind: "mismo-signo" });
    }
  });

  it("los signos opuestos son siempre media, en ambos órdenes", () => {
    for (const [a, b] of OPPOSITES) {
      expect(getCompatibility(a, b)).toMatchObject({ level: "media", textKind: "opuestos" });
      expect(getCompatibility(b, a)).toMatchObject({ level: "media", textKind: "opuestos" });
    }
  });

  it("los signos distintos del mismo elemento son siempre alta, en ambos órdenes", () => {
    const mismos = PAIRS.filter(([a, b]) => a !== b && ELEMENT.get(a) === ELEMENT.get(b));
    expect(mismos).toHaveLength(24);
    for (const [a, b] of mismos) {
      expect(getCompatibility(a, b)).toMatchObject({ level: "alta", textKind: "mismo-elemento" });
    }
  });

  it("el recuento de parejas es 24 altas, 33 medias y 21 bajas", () => {
    const cuenta = { alta: 0, media: 0, baja: 0 };
    NAMES.forEach((a, i) => {
      for (const b of NAMES.slice(i)) cuenta[getCompatibility(a, b).level as keyof typeof cuenta] += 1;
    });
    expect(cuenta).toEqual({ alta: 24, media: 33, baja: 21 });
  });

  it("cada signo tiene exactamente 4 parejas altas", () => {
    for (const a of NAMES) {
      const altas = NAMES.filter((b) => b !== a && getCompatibility(a, b).level === "alta");
      expect(altas).toHaveLength(4);
    }
  });

  it.each([
    ["Aries", "Leo", "Alta"],
    ["Aries", "Aries", "Media"],
    ["Aries", "Cáncer", "Baja / Desafiante"],
  ] as [SignName, SignName, string][])("el nombre mostrado de %s y %s es %s", (a, b, nombre) => {
    expect(getCompatibility(a, b).levelName).toBe(nombre);
  });

  it("el mismo signo gana al mismo elemento (precedencia 4.4)", () => {
    expect(getCompatibility("Aries", "Aries").textKind).toBe("mismo-signo");
  });

  it("los opuestos ganan a los elementos complementarios (precedencia 4.4)", () => {
    expect(getCompatibility("Aries", "Libra").textKind).toBe("opuestos");
  });

  it.each<[SignName, SignName, string]>([
    ["Aries", "Leo", "mismo-elemento"],
    ["Aries", "Géminis", "complementarios"],
    ["Tauro", "Cáncer", "complementarios"],
    ["Aries", "Cáncer", "tension"],
    ["Tauro", "Géminis", "tension"],
    ["Aries", "Tauro", "ritmos-distintos"],
    ["Géminis", "Cáncer", "ritmos-distintos"],
  ])("el tipo de texto de %s y %s es %s", (a, b, tipo) => {
    expect(getCompatibility(a, b).textKind).toBe(tipo);
  });

  it("el tipo de texto de las 144 combinaciones sigue la precedencia 4.4", () => {
    for (const [a, b] of PAIRS) {
      expect(getCompatibility(a, b).textKind).toBe(expectedKind(a, b));
    }
  });

  // Textos de la sección 5 con los marcadores sustituidos de forma literal (D2).
  it.each<[SignName, SignName, string]>([
    ["Aries", "Leo", "Aries y Leo comparten el elemento Fuego, así que suelen compartir ritmo, intereses y una forma parecida de vivir las emociones y las decisiones. Esa sintonía facilita el entendimiento, y cada uno puede aportar su propio matiz."],
    ["Aries", "Géminis", "Fuego y Aire se estimulan y se equilibran entre sí: lo que uno aporta suele alimentar al otro. Entre Aries y Géminis puede haber mucha chispa y complicidad si se cuida la comunicación."],
    ["Aries", "Cáncer", "Aries (Fuego) y Cáncer (Agua) tienen maneras bastante distintas de sentir y de actuar. Esa diferencia puede ser enriquecedora si hay curiosidad y paciencia por ambas partes."],
    ["Aries", "Tauro", "Fuego y Tierra no se oponen, pero tampoco avanzan al mismo paso. Aries y Tauro pueden complementarse si respetan los tiempos y las prioridades del otro."],
    ["Leo", "Leo", "Dos personas de Leo se reconocen muy bien: comparten virtudes y también los mismos puntos ciegos. Pueden entenderse sin palabras, aunque a veces les convenga mirar las cosas desde otra perspectiva."],
    ["Aries", "Libra", "Aries y Libra están en lados contrarios del zodiaco y se atraen precisamente por lo que al otro le falta. Pueden aprender mucho entre sí si convierten las diferencias en equilibrio y no en pulso."],
  ])("el texto de %s y %s es el de la sección 5", (a, b, texto) => {
    expect(getCompatibility(a, b).text).toBe(texto);
  });

  it("el texto sigue el orden de entrada (D1)", () => {
    expect(getCompatibility("Leo", "Aries").text.startsWith("Leo y Aries comparten el elemento Fuego")).toBe(true);
  });

  it("ningún texto conserva marcadores ni HTML y ninguno supera los 400 caracteres", () => {
    for (const [a, b] of PAIRS) {
      const { text } = getCompatibility(a, b);
      expect(text).not.toMatch(/[{}<>]/);
      expect(text.length).toBeLessThanOrEqual(400);
    }
  });

  it.each([["Ofiuco"], ["aries"], [""], ["<script>"], [undefined]])(
    "rechaza el signo desconocido %j",
    (desconocido) => {
      expect(() => getCompatibility(desconocido as never, "Aries")).toThrow("Signo no válido");
      expect(() => getCompatibility("Aries", desconocido as never)).toThrow("Signo no válido");
    },
  );
});
