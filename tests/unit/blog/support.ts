import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostCardData, PostDetail } from "@/lib/blog/queries";

export const ORIGIN = "https://abcdefghijklmnopqrst.supabase.co";
export const COVER_NAME = "11111111-2222-3333-4444-555555555555.png";
export const COVER_URL = `${ORIGIN}/storage/v1/object/public/post-images/${COVER_NAME}`;

export type Op = { method: string; args: unknown[] };
export type Call = { table: string; ops: Op[] };
type Outcome = { data?: unknown; error?: unknown } | "throws";

/**
 * Cliente de Supabase falso: registra cada consulta (tabla y métodos encadenados) y responde
 * con lo configurado. Una lista de respuestas se consume en orden, una por consulta.
 */
export function fakeClient(responses: Record<string, Outcome | Outcome[]>) {
  const calls: Call[] = [];
  const used = new Map<string, number>();

  const next = (table: string): Outcome => {
    const configured = Reflect.get(responses, table) as Outcome | Outcome[] | undefined;
    if (configured === undefined) return { data: null, error: { message: "sin respuesta configurada" } };
    if (!Array.isArray(configured)) return configured;
    const index = used.get(table) ?? 0;
    used.set(table, index + 1);
    return configured[Math.min(index, configured.length - 1)];
  };

  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const outcome = next(table);
    const settle = () =>
      outcome === "throws"
        ? Promise.reject(new Error("consulta caída: contraseña=secreto"))
        : Promise.resolve({ data: outcome.data ?? null, error: outcome.error ?? null });

    const handler: ProxyHandler<object> = {
      get(_target, property) {
        if (property === "then") return (resolve: never, reject: never) => settle().then(resolve, reject);
        return (...args: unknown[]) => {
          call.ops.push({ method: String(property), args });
          return property === "maybeSingle" || property === "single" ? settle() : proxy;
        };
      },
    };
    const proxy: object = new Proxy({}, handler);
    return proxy;
  };

  return { client: { from } as unknown as SupabaseClient, calls };
}

export const ops = (call: Call | undefined, method: string) => (call?.ops ?? []).filter((op) => op.method === method);

export const words = (count: number) => Array.from({ length: count }, (_, i) => `palabra${i}`).join(" ");

export function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Mi entrada",
    slug: "mi-entrada",
    content_md: words(400),
    cover_image_path: COVER_NAME,
    published_at: "2026-11-02T10:00:00+00:00",
    post_categories: [{ categories: { name: "Astrología", slug: "astrologia" } }],
    ...overrides,
  };
}

export function cardFixture(overrides: Partial<PostCardData> = {}): PostCardData {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "mi-entrada",
    title: "Mi entrada",
    coverUrl: COVER_URL,
    categories: [{ name: "Astrología", slug: "astrologia" }],
    publishedAt: "2026-11-02T10:00:00Z",
    dateLabel: "2 de noviembre de 2026",
    readingMinutes: 3,
    ...overrides,
  };
}

export function detailFixture(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    ...cardFixture(),
    content: "## Subtítulo\n\nTexto con **negrita**.",
    description: "Subtítulo Texto con negrita.",
    ...overrides,
  };
}
