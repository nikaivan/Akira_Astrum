import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { performLogin } from "@/lib/auth/login";
import { GENERIC_LOGIN_ERROR, RATE_LIMIT_ERROR } from "@/lib/auth/messages";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { setSecuritySink } from "@/lib/security/log";

const USER = { id: "11111111-2222-4333-8444-555555555555" };
const EMAIL = "admin@example.com";
const PASSWORD = "S3cr3t-P@ss-de-prueba";
const ANON_KEY = "clave-anonima-de-prueba";
const IP = "203.0.113.7";
const MINUTE = 60_000;

type Options = { signIn?: { user?: { id: string } | null; error?: unknown } | "throws"; role?: string | null };

function fakeClient(options: Options = {}) {
  const signIn = options.signIn ?? { user: USER };
  return {
    auth: {
      signInWithPassword: async () => {
        if (signIn === "throws") throw new Error(`Failed to fetch https://x.supabase.co ${PASSWORD}`);
        return { data: { user: signIn.user ?? null, session: signIn.user ? {} : null }, error: signIn.error ?? null };
      },
      getUser: async () => ({ data: { user: signIn !== "throws" && signIn.user ? signIn.user : null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.role === undefined ? { role: "admin" } : { role: options.role }, error: null }) }) }) }),
  } as unknown as SupabaseClient;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};
const credentials = () => form({ email: EMAIL, password: PASSWORD });

let lines: string[] = [];
const events = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

function attempt(options: Options = {}, limiter = createRateLimiter(), formData = credentials(), ip = IP) {
  return performLogin({ supabase: fakeClient(options), limiter, ip, formData });
}

afterEach(() => {
  setSecuritySink(null);
  vi.restoreAllMocks();
});
const capture = () => {
  lines = [];
  setSecuritySink((line) => lines.push(line));
};

describe("login: eventos de seguridad", () => {
  it("un login correcto registra login_succeeded con el usuario (UUID) y sin correo", async () => {
    capture();
    await attempt();
    expect(events()).toEqual([expect.objectContaining({ event: "login_succeeded", level: "info", user: USER.id, client: expect.stringMatching(/^[0-9a-f]{12}$/) })]);
  });

  it.each<[string, Options, string]>([
    ["credenciales incorrectas", { signIn: { user: null, error: { status: 400, message: `bad ${PASSWORD}` } } }, "credentials"],
    ["una caída de Supabase", { signIn: "throws" }, "service_error"],
    ["un usuario que no es admin", { role: "user" }, "not_admin"],
  ])("%s registra login_failed con el motivo %s", async (_caso, options, reason) => {
    capture();
    await attempt(options);
    expect(events()).toEqual([expect.objectContaining({ event: "login_failed", level: "warn", reason })]);
  });

  it("una entrada inválida registra login_failed/invalid_input", async () => {
    capture();
    await attempt({}, createRateLimiter(), form({ email: "no-es-un-correo", password: "" }));
    expect(events()).toEqual([expect.objectContaining({ event: "login_failed", reason: "invalid_input" })]);
  });

  it("el intento bloqueado registra rate_limited/login y no llama a Supabase", async () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 5; i++) limiter.recordFailure(IP);
    capture();
    const result = await attempt({}, limiter);
    expect(result).toEqual({ ok: false, message: RATE_LIMIT_ERROR });
    expect(events()).toEqual([expect.objectContaining({ event: "rate_limited", scope: "login" })]);
  });

  it("nunca aparecen el correo, la contraseña, la clave ni la IP, en ningún escenario", async () => {
    capture();
    await attempt();
    await attempt({ role: "user" });
    await attempt({ signIn: { user: null, error: { status: 400, message: `bad ${PASSWORD} ${ANON_KEY}` } } });
    await attempt({ signIn: "throws" });
    await attempt({}, createRateLimiter(), form({ email: EMAIL, password: "" }));
    expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const secret of [EMAIL, PASSWORD, ANON_KEY, IP, "supabase.co", "Failed to fetch"]) expect(lines.join("\n")).not.toContain(secret);
  });

  it("el mismo cliente produce siempre el mismo identificador y otro cliente, uno distinto", async () => {
    capture();
    await attempt({ role: "user" });
    await attempt({ role: "user" });
    await attempt({ role: "user" }, createRateLimiter(), credentials(), "198.51.100.9");
    const [a, b, c] = events().map((event) => event.client);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe("login: el registro no cambia la respuesta (A10)", () => {
  const scenarios: [string, Options][] = [
    ["éxito", {}],
    ["credenciales", { signIn: { user: null, error: { status: 400, message: "x" } } }],
    ["no admin", { role: "user" }],
    ["caída", { signIn: "throws" }],
  ];

  it.each(scenarios)("%s: mismo resultado con un sumidero que lanza una excepción", async (_caso, options) => {
    setSecuritySink(() => undefined);
    const normal = await attempt(options);
    setSecuritySink(() => {
      throw new Error("el registro ha fallado");
    });
    expect(await attempt(options)).toEqual(normal);
  });

  it("el mensaje de los fallos sigue siendo el genérico", async () => {
    capture();
    expect(await attempt({ role: "user" })).toEqual({ ok: false, message: GENERIC_LOGIN_ERROR });
  });
});

describe("login: bloqueo y recuperación (A07)", () => {
  function clocked() {
    const clock = { now: 1_000_000 };
    return { clock, limiter: createRateLimiter({ now: () => clock.now }) };
  }
  const bad: Options = { signIn: { user: null, error: { status: 400, message: "x" } } };

  it("tras 5 fallos se bloquea, también con la clave correcta, y al pasar la ventana vuelve a admitir intentos", async () => {
    const { clock, limiter } = clocked();
    for (let i = 0; i < 5; i++) await attempt(bad, limiter);
    expect(await attempt({}, limiter)).toEqual({ ok: false, message: RATE_LIMIT_ERROR });

    clock.now += 15 * MINUTE - 1;
    expect(await attempt({}, limiter)).toEqual({ ok: false, message: RATE_LIMIT_ERROR });

    clock.now += 2;
    expect(await attempt({}, limiter)).toMatchObject({ ok: true });
  });

  it("tras recuperarse, el contador empieza de cero (hacen falta otros 5 fallos para bloquear)", async () => {
    const { clock, limiter } = clocked();
    for (let i = 0; i < 5; i++) await attempt(bad, limiter);
    clock.now += 15 * MINUTE + 1;
    for (let i = 0; i < 4; i++) await attempt(bad, limiter);
    expect(limiter.isBlocked(IP)).toBe(false);
    await attempt(bad, limiter);
    expect(limiter.isBlocked(IP)).toBe(true);
  });
});
