import { describe, expect, it } from "vitest";
import { publish, unpublish, type PostState } from "@/lib/posts/status";

const T1 = new Date("2026-11-02T10:00:00Z");
const T2 = new Date("2026-11-03T10:00:00Z");

const draft = (): PostState => Object.freeze({ status: "draft", publishedAt: null });
const published = (at: Date): PostState => Object.freeze({ status: "published", publishedAt: at });

describe("publish", () => {
  it("publica un borrador", () => {
    expect(publish(draft(), T1)).toEqual({ status: "published", publishedAt: T1 });
  });

  it("no muta el original y devuelve otro objeto", () => {
    const original = draft();
    const result = publish(original, T1);
    expect(original).toEqual({ status: "draft", publishedAt: null });
    expect(result).not.toBe(original);
  });

  it("no se puede publicar lo ya publicado", () => {
    expect(() => publish(published(T1), T2)).toThrow("Transición no válida");
  });

  it("rechaza una fecha inválida", () => {
    expect(() => publish(draft(), new Date("x"))).toThrow("Fecha no válida");
  });
});

describe("unpublish", () => {
  it("despublica una entrada publicada", () => {
    expect(unpublish(published(T1))).toEqual({ status: "draft", publishedAt: null });
  });

  it("no se puede despublicar un borrador", () => {
    expect(() => unpublish(draft())).toThrow("Transición no válida");
  });
});

describe("ciclo de vida", () => {
  it("al republicar se fija una fecha nueva", () => {
    const republished = publish(unpublish(publish(draft(), T1)), T2);
    expect(republished.publishedAt).toEqual(T2);
  });

  it("publishedAt no es nulo si y solo si la entrada está publicada", () => {
    const steps = [
      (s: PostState) => publish(s, T1),
      (s: PostState) => unpublish(s),
      (s: PostState) => publish(s, T2),
      (s: PostState) => unpublish(s),
    ];
    let state = draft();
    for (const step of steps) {
      state = step(state);
      expect(state.publishedAt !== null).toBe(state.status === "published");
    }
  });
});

describe("estados no válidos", () => {
  const operations = [
    ["publish", (s: PostState) => publish(s, T1)],
    ["unpublish", (s: PostState) => unpublish(s)],
  ] as const;

  describe.each(operations)("%s", (_nombre, operation) => {
    it.each([
      ["borrador con fecha", { status: "draft", publishedAt: T1 }],
      ["publicado sin fecha", { status: "published", publishedAt: null }],
      ["estado desconocido", { status: "archived", publishedAt: null }],
    ])("rechaza %s", (_caso, state) => {
      expect(() => operation(state as PostState)).toThrow("Estado no válido");
    });
  });
});
