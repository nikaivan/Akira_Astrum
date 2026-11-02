import { describe, expect, it } from "vitest";
import { INVALID_DATE_ERROR, MISSING_DATE_ERRORS } from "@/lib/compatibility/messages";
import { parseCompatibilityInput } from "@/lib/compatibility/schema";
import { TODAY } from "./support";

const VALID = { birthA: "1990-05-17", birthB: "2000-03-21" };

describe("parseCompatibilityInput", () => {
  it("acepta dos fechas válidas y las devuelve como números", () => {
    const result = parseCompatibilityInput(VALID, TODAY);
    expect(result).toStrictEqual({
      success: true,
      data: { birthA: { year: 1990, month: 5, day: 17 }, birthB: { year: 2000, month: 3, day: 21 } },
    });
  });

  it.each([
    ["el primer día admitido", "1900-01-01"],
    ["un 29 de febrero bisiesto", "2000-02-29"],
    ["hoy", TODAY],
    ["ayer", "2025-06-14"],
  ])("acepta %s", (_caso, date) => {
    expect(parseCompatibilityInput({ birthA: date, birthB: date }, TODAY).success).toBe(true);
  });

  it.each([
    ["texto que no es fecha", "abc"],
    ["un 30 de febrero", "2023-02-30"],
    ["un 31 de abril", "2023-04-31"],
    ["un 29 de febrero no bisiesto", "2023-02-29"],
    ["una fecha anterior a 1900", "1899-12-31"],
    ["mañana", "2025-06-16"],
    ["una fecha muy futura", "2999-01-01"],
    ["un mes 13", "2000-13-01"],
    ["el formato día/mes/año", "31/12/2000"],
    ["una fecha con hora", "2000-01-01T00:00:00Z"],
    ["un script", "<script>alert(1)</script>"],
  ])("rechaza %s con el mensaje de fecha inválida, campo por campo", (_caso, bad) => {
    const first = parseCompatibilityInput({ birthA: bad, birthB: VALID.birthB }, TODAY);
    expect(first).toStrictEqual({ success: false, errors: { birthA: INVALID_DATE_ERROR } });

    const second = parseCompatibilityInput({ birthA: VALID.birthA, birthB: bad }, TODAY);
    expect(second).toStrictEqual({ success: false, errors: { birthB: INVALID_DATE_ERROR } });
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
  ])("un campo %s pide la fecha de esa persona", (_caso, empty) => {
    const result = parseCompatibilityInput({ birthA: empty, birthB: empty }, TODAY);
    expect(result).toStrictEqual({
      success: false,
      errors: { birthA: MISSING_DATE_ERRORS.birthA, birthB: MISSING_DATE_ERRORS.birthB },
    });
  });

  it.each([
    ["falta el primer campo", { birthB: VALID.birthB }, { birthA: MISSING_DATE_ERRORS.birthA }],
    ["falta el segundo campo", { birthA: VALID.birthA }, { birthB: MISSING_DATE_ERRORS.birthB }],
  ])("%s", (_caso, input, errors) => {
    expect(parseCompatibilityInput(input, TODAY)).toStrictEqual({ success: false, errors });
  });

  it.each([
    ["null", null],
    ["un texto", "1990-05-17"],
    ["una lista", ["1990-05-17", "2000-03-21"]],
    ["números", { birthA: 19900517, birthB: 20000321 }],
    ["objetos", { birthA: { $ne: "" }, birthB: {} }],
    ["null en los campos", { birthA: null, birthB: null }],
  ])("rechaza una entrada con forma inesperada (%s)", (_caso, input) => {
    expect(parseCompatibilityInput(input, TODAY).success).toBe(false);
  });

  it("el mensaje de campo vacío y el de fecha inválida son distintos", () => {
    expect(MISSING_DATE_ERRORS.birthA).not.toBe(INVALID_DATE_ERROR);
    expect(MISSING_DATE_ERRORS.birthB).not.toBe(INVALID_DATE_ERROR);
    expect(MISSING_DATE_ERRORS.birthA).not.toBe(MISSING_DATE_ERRORS.birthB);
  });

  it("los mensajes no repiten nunca la entrada", () => {
    const hostile = "2023-02-30 <script>alert(1)</script>";
    const serialized = JSON.stringify(parseCompatibilityInput({ birthA: hostile, birthB: "abc" }, TODAY));
    expect(serialized).not.toMatch(/2023-02-30|script|abc/);
  });

  it("ignora los campos que no conoce", () => {
    const result = parseCompatibilityInput({ ...VALID, role: "admin" }, TODAY);
    expect(result.success && Object.keys(result.data)).toEqual(["birthA", "birthB"]);
  });
});
