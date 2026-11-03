import { afterEach, describe, expect, it } from "vitest";
import { formatPublishedDate } from "@/lib/blog/dates";

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("formatPublishedDate (español, siempre en UTC)", () => {
  it.each([
    ["2026-11-02T10:00:00Z", "2 de noviembre de 2026"],
    ["2026-01-01T00:00:00Z", "1 de enero de 2026"],
    ["2026-12-31T23:59:59Z", "31 de diciembre de 2026"],
    ["2026-11-02T10:00:00+00:00", "2 de noviembre de 2026"],
    ["2026-01-01T00:30:00+05:00", "31 de diciembre de 2025"],
    ["2026-03-01T23:30:00-08:00", "2 de marzo de 2026"],
  ])("%s → %s", (iso, label) => {
    expect(formatPublishedDate(iso)).toBe(label);
  });

  it("da el mismo resultado en cualquier zona horaria del servidor", () => {
    const results = ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"].map((zone) => {
      process.env.TZ = zone;
      return formatPublishedDate("2026-11-02T23:30:00Z");
    });
    expect(new Set(results)).toEqual(new Set(["2 de noviembre de 2026"]));
  });

  it.each(["", "no es una fecha", "2026-13-45T00:00:00Z", "<script>alert(1)</script>"])("una fecha inválida (%j) da una cadena vacía", (input) => {
    expect(formatPublishedDate(input)).toBe("");
  });
});
