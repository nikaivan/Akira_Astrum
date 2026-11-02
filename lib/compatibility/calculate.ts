import { getCompatibility } from "@/lib/astrology/compatibility";
import { DISCLAIMER, LEVELS, type LevelCode, type TextKind } from "@/lib/astrology/compatibility-data";
import { SIGNS } from "@/lib/astrology/signs";
import { getSunSign } from "@/lib/astrology/sun-sign";
import type { RateLimiter } from "@/lib/auth/rate-limit";
import { GENERIC_ERROR, INVALID_FORM_SUMMARY, RATE_LIMIT_ERROR } from "./messages";
import { parseCompatibilityInput, type FieldErrors } from "./schema";

export type PersonResult = { sign: string; symbol: string; element: string };

export type CompatibilityResultData = {
  people: [PersonResult, PersonResult];
  level: LevelCode;
  levelName: string;
  levelDescription: string;
  textKind: TextKind;
  text: string;
  disclaimer: string;
};

export type CompatibilityState =
  | { ok: true; result: CompatibilityResultData }
  | { ok: false; message: string; errors: FieldErrors };

type Params = { formData: FormData; today: string; limiter: RateLimiter; ip: string };

const failure = (message: string, errors: FieldErrors = {}): CompatibilityState => ({ ok: false, message, errors });

function personOf(name: string): PersonResult {
  const sign = SIGNS.find((item) => item.name === name);
  if (!sign) throw new Error("Signo no válido");
  return { sign: sign.name, symbol: sign.symbol, element: sign.element };
}

/**
 * Lógica de la calculadora, sin dependencias de Next. No guarda, registra ni envía
 * nada. Cualquier fallo inesperado devuelve el mismo mensaje genérico (A10).
 */
export async function calculateCompatibility({ formData, today, limiter, ip }: Params): Promise<CompatibilityState> {
  try {
    if (limiter.isBlocked(ip)) return failure(RATE_LIMIT_ERROR);
    limiter.recordFailure(ip); // cuenta todas las consultas, válidas o no

    const parsed = parseCompatibilityInput(
      { birthA: formData.get("birthA") ?? undefined, birthB: formData.get("birthB") ?? undefined },
      today,
    );
    if (!parsed.success) return failure(INVALID_FORM_SUMMARY, parsed.errors);

    const signA = getSunSign(parsed.data.birthA);
    const signB = getSunSign(parsed.data.birthB);
    const compatibility = getCompatibility(signA, signB);
    const level = LEVELS.find(({ code }) => code === compatibility.level);
    if (!level) throw new Error("Nivel no válido");

    return {
      ok: true,
      result: {
        people: [personOf(signA), personOf(signB)],
        level: compatibility.level,
        levelName: compatibility.levelName,
        levelDescription: level.description,
        textKind: compatibility.textKind,
        text: compatibility.text,
        disclaimer: DISCLAIMER,
      },
    };
  } catch {
    return failure(GENERIC_ERROR);
  }
}
