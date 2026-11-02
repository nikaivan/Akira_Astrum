export type PostStatus = "draft" | "published";

export type PostState = {
  readonly status: PostStatus;
  readonly publishedAt: Date | null;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

function assertConsistent(state: PostState): void {
  const consistent =
    (state.status === "draft" && state.publishedAt === null) ||
    (state.status === "published" && isValidDate(state.publishedAt));

  if (!consistent) throw new Error("Estado no válido");
}

export function publish(state: PostState, now: Date): PostState {
  assertConsistent(state);
  if (state.status !== "draft") throw new Error("Transición no válida");
  if (!isValidDate(now)) throw new Error("Fecha no válida");

  return { status: "published", publishedAt: now };
}

export function unpublish(state: PostState): PostState {
  assertConsistent(state);
  if (state.status !== "published") throw new Error("Transición no válida");

  return { status: "draft", publishedAt: null };
}
