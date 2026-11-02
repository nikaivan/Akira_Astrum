import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("smoke", () => {
  it("resuelve el alias @/ y combina clases de Tailwind", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
