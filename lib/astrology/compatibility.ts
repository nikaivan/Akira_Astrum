/* eslint-disable security/detect-object-injection -- claves ya validadas como nombres de signo */
import {
  COMPATIBILITY,
  ELEMENT_RELATION,
  LEVELS,
  OPPOSITES,
  TEXTS,
  type LevelCode,
  type TextKind,
} from "./compatibility-data";
import { SIGNS, type Sign, type SignName } from "./signs";

export type Compatibility = {
  level: LevelCode;
  levelName: string;
  textKind: TextKind;
  text: string;
};

const SIGN_BY_NAME: ReadonlyMap<string, Sign> = new Map(SIGNS.map((sign) => [sign.name, sign]));
const LEVEL_NAME = Object.fromEntries(LEVELS.map(({ code, name }) => [code, name])) as Record<LevelCode, string>;

const isOpposite = (a: Sign, b: Sign) =>
  OPPOSITES.some(([x, y]) => (x === a.name && y === b.name) || (x === b.name && y === a.name));

// Precedencia de docs/astrologia-reglas.md §4.4: mismo signo, signos opuestos, relación de elementos.
function textKindOf(a: Sign, b: Sign): TextKind {
  if (a.name === b.name) return "mismo-signo";
  if (isOpposite(a, b)) return "opuestos";
  if (a.element === b.element) return "mismo-elemento";

  const kind = ELEMENT_RELATION.get([a.element, b.element].sort().join("|"));
  if (!kind) throw new Error("Signo no válido");
  return kind;
}

function render(template: string, a: Sign, b: Sign): string {
  return template
    .replaceAll("{signoA}", a.name)
    .replaceAll("{signoB}", b.name)
    .replaceAll("{elementoA}", a.element)
    .replaceAll("{elementoB}", b.element);
}

export function getCompatibility(nameA: SignName, nameB: SignName): Compatibility {
  const a = SIGN_BY_NAME.get(nameA);
  const b = SIGN_BY_NAME.get(nameB);
  if (!a || !b) throw new Error("Signo no válido");

  const level = COMPATIBILITY[nameA][nameB];
  const textKind = textKindOf(a, b);

  return { level, levelName: LEVEL_NAME[level], textKind, text: render(TEXTS[textKind], a, b) };
}
