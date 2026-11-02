/* eslint-disable security/detect-object-injection -- claves de un conjunto cerrado y constante */
import { SIGNS, type SignName } from "./signs";

export type LevelCode = "alta" | "media" | "baja";

export type TextKind =
  | "mismo-signo"
  | "opuestos"
  | "mismo-elemento"
  | "complementarios"
  | "tension"
  | "ritmos-distintos";

// Niveles de compatibilidad (docs/astrologia-reglas.md, sección 3).
export const LEVELS: readonly { code: LevelCode; name: string; description: string }[] = [
  { code: "alta", name: "Alta", description: "Afinidad natural: los signos suelen entenderse con facilidad." },
  { code: "media", name: "Media", description: "Mezcla de afinidades y diferencias: hay base común y aspectos que trabajar." },
  { code: "baja", name: "Baja / Desafiante", description: "Estilos muy distintos: requiere más diálogo y paciencia." },
];

// Tabla de parejas (sección 4.1), una fila por signo con las columnas en el orden de SIGNS.
// A = alta, M = media, B = baja.
const ROWS: Record<SignName, string> = {
  "Aries": "MMABABMBABAM",
  "Tauro": "MMMABAMMBABA",
  "Géminis": "AMMMABABMBAB",
  "Cáncer": "BAMMMABABMBA",
  "Leo": "ABAMMMABABMM",
  "Virgo": "BABAMMMABAMM",
  "Libra": "MMABAMMMABAM",
  "Escorpio": "BMBABAMMMABA",
  "Sagitario": "ABMBABAMMMAB",
  "Capricornio": "BABMBABAMMMA",
  "Acuario": "ABABMMABAMMB",
  "Piscis": "MABAMMMABABM",
};

const LEVEL_OF_LETTER: Record<string, LevelCode> = { A: "alta", M: "media", B: "baja" };

export const COMPATIBILITY = Object.fromEntries(
  SIGNS.map(({ name }) => [
    name,
    Object.fromEntries(SIGNS.map((other, i) => [other.name, LEVEL_OF_LETTER[ROWS[name].charAt(i)]])),
  ]),
) as Record<SignName, Record<SignName, LevelCode>>;

// Signos opuestos (sección 4.1, observaciones).
export const OPPOSITES: readonly (readonly [SignName, SignName])[] = [
  ["Aries", "Libra"],
  ["Tauro", "Escorpio"],
  ["Géminis", "Sagitario"],
  ["Cáncer", "Capricornio"],
  ["Leo", "Acuario"],
  ["Virgo", "Piscis"],
];

// Relación entre los elementos de dos signos distintos y no opuestos (sección 4.2).
// La clave son los dos elementos en orden alfabético.
export const ELEMENT_RELATION: ReadonlyMap<string, TextKind> = new Map([
  ["Aire|Fuego", "complementarios"],
  ["Agua|Tierra", "complementarios"],
  ["Agua|Fuego", "tension"],
  ["Aire|Tierra", "tension"],
  ["Fuego|Tierra", "ritmos-distintos"],
  ["Agua|Aire", "ritmos-distintos"],
]);

// Textos explicativos con marcadores (sección 5).
export const TEXTS: Record<TextKind, string> = {
  "mismo-elemento": "{signoA} y {signoB} comparten el elemento {elementoA}, así que suelen compartir ritmo, intereses y una forma parecida de vivir las emociones y las decisiones. Esa sintonía facilita el entendimiento, y cada uno puede aportar su propio matiz.",
  "complementarios": "{elementoA} y {elementoB} se estimulan y se equilibran entre sí: lo que uno aporta suele alimentar al otro. Entre {signoA} y {signoB} puede haber mucha chispa y complicidad si se cuida la comunicación.",
  "tension": "{signoA} ({elementoA}) y {signoB} ({elementoB}) tienen maneras bastante distintas de sentir y de actuar. Esa diferencia puede ser enriquecedora si hay curiosidad y paciencia por ambas partes.",
  "ritmos-distintos": "{elementoA} y {elementoB} no se oponen, pero tampoco avanzan al mismo paso. {signoA} y {signoB} pueden complementarse si respetan los tiempos y las prioridades del otro.",
  "mismo-signo": "Dos personas de {signoA} se reconocen muy bien: comparten virtudes y también los mismos puntos ciegos. Pueden entenderse sin palabras, aunque a veces les convenga mirar las cosas desde otra perspectiva.",
  "opuestos": "{signoA} y {signoB} están en lados contrarios del zodiaco y se atraen precisamente por lo que al otro le falta. Pueden aprender mucho entre sí si convierten las diferencias en equilibrio y no en pulso.",
};

// Aviso de uso (sección 6).
export const DISCLAIMER = "Esta herramienta se basa en convenciones de la tradición astrológica. No tiene base científica y se ofrece con fines informativos y de entretenimiento. No se guarda ningún dato personal.";
