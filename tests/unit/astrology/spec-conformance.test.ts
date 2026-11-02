/* eslint-disable security/detect-object-injection -- claves de datos de prueba controlados */
import { describe, expect, it } from "vitest";
import { COMPATIBILITY, DISCLAIMER, LEVELS, TEXTS } from "@/lib/astrology/compatibility-data";
import { SIGNS } from "@/lib/astrology/signs";
import { SPEC } from "./spec";

const KIND_OF_LABEL = {
  "Mismo elemento": "mismo-elemento",
  "Elementos complementarios": "complementarios",
  "Elementos en tensión": "tension",
  "Ritmos distintos": "ritmos-distintos",
  "Mismo signo": "mismo-signo",
  "Signos opuestos": "opuestos",
} as const;

describe("los datos del código son los de docs/astrologia-reglas.md", () => {
  it("signos: nombre, símbolo, desde, hasta, elemento y modalidad (sección 2)", () => {
    expect(SIGNS).toEqual(SPEC.signs);
  });

  it("niveles: código, nombre mostrado y descripción (sección 3)", () => {
    expect(LEVELS).toEqual(SPEC.levels);
  });

  it.each(SPEC.signs.map((s) => s.name))("matriz 12×12: la fila de %s (sección 4.1)", (name) => {
    expect(COMPATIBILITY[name as keyof typeof COMPATIBILITY]).toEqual(SPEC.matrix[name]);
  });

  it("matriz 12×12: tiene exactamente las 12 filas del documento", () => {
    expect(Object.keys(COMPATIBILITY)).toEqual(Object.keys(SPEC.matrix));
  });

  it("textos: las seis plantillas con sus marcadores (sección 5)", () => {
    const esperado = Object.fromEntries(
      Object.entries(SPEC.texts).map(([label, text]) => [KIND_OF_LABEL[label as keyof typeof KIND_OF_LABEL], text]),
    );
    expect(Object.keys(esperado)).toHaveLength(6);
    expect(TEXTS).toEqual(esperado);
  });

  it("aviso de uso (sección 6)", () => {
    expect(DISCLAIMER).toBe(SPEC.disclaimer);
  });
});
