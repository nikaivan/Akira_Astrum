import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateCompatibility } from "@/lib/compatibility/calculate";
import { createCompatibilityLimiter } from "@/lib/compatibility/limiter";
import { GENERIC_ERROR } from "@/lib/compatibility/messages";
import { dates, TODAY } from "./support";

const SECRET_DATE = "1990-05-17";

vi.mock("@/lib/astrology/sun-sign", () => ({ getSunSign: vi.fn() }));
const { getSunSign } = await import("@/lib/astrology/sun-sign");

const GENERIC_STATE = { ok: false, message: GENERIC_ERROR, errors: {} };

beforeEach(() => {
  vi.mocked(getSunSign).mockImplementation(() => {
    throw new Error(`fallo interno con ${SECRET_DATE} en /srv/app/secreto.ts`);
  });
});
afterEach(() => vi.restoreAllMocks());

describe("fallar cerrado (A10)", () => {
  it("si el dominio lanza una excepción, la respuesta es genérica y no filtra nada", async () => {
    const state = await calculateCompatibility({
      formData: dates(SECRET_DATE, "2000-03-21"),
      today: TODAY,
      limiter: createCompatibilityLimiter(),
      ip: "203.0.113.5",
    });
    expect(state).toStrictEqual(GENERIC_STATE);
    expect(JSON.stringify(state)).not.toMatch(/fallo interno|secreto|1990|\/srv/);
  });

  it("si el limitador falla, la respuesta es genérica y no se calcula", async () => {
    const broken = {
      isBlocked: () => {
        throw new Error("memoria agotada");
      },
      recordFailure: () => {},
      reset: () => {},
      size: () => 0,
    };
    const state = await calculateCompatibility({
      formData: dates(SECRET_DATE, "2000-03-21"),
      today: TODAY,
      limiter: broken,
      ip: "203.0.113.5",
    });
    expect(state).toStrictEqual(GENERIC_STATE);
    expect(getSunSign).not.toHaveBeenCalled();
  });

  it("si cuenta el intento y falla, también se responde genérico", async () => {
    const broken = {
      isBlocked: () => false,
      recordFailure: () => {
        throw new Error("no se puede contar");
      },
      reset: () => {},
      size: () => 0,
    };
    const state = await calculateCompatibility({
      formData: dates(SECRET_DATE, "2000-03-21"),
      today: TODAY,
      limiter: broken,
      ip: "203.0.113.5",
    });
    expect(state).toStrictEqual(GENERIC_STATE);
  });
});
