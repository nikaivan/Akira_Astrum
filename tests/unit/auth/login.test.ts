import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { performLogin } from "@/lib/auth/login";
import { GENERIC_LOGIN_ERROR, RATE_LIMIT_ERROR } from "@/lib/auth/messages";
import { createRateLimiter } from "@/lib/auth/rate-limit";

const USER = { id: "11111111-2222-3333-4444-555555555555" };
const EMAIL = "admin@example.com";
const PASSWORD = "S3cr3t-P@ss-de-prueba";
const ANON_KEY = "clave-anonima-de-prueba";
const IP = "203.0.113.7";

type Options = {
  signIn?: { user?: { id: string } | null; error?: unknown } | "throws";
  role?: string | null;
  profileError?: unknown;
  getUserThrows?: boolean;
  signOutThrows?: boolean;
};

function fakeClient(options: Options = {}) {
  const calls = { signIn: [] as unknown[], signOut: 0, getUser: 0 };
  const signIn = options.signIn ?? { user: USER };
  const client = {
    auth: {
      signInWithPassword: async (credentials: unknown) => {
        calls.signIn.push(credentials);
        if (signIn === "throws") throw new Error("Failed to fetch https://x.supabase.co");
        return { data: { user: signIn.user ?? null, session: signIn.user ? {} : null }, error: signIn.error ?? null };
      },
      getUser: async () => {
        calls.getUser += 1;
        if (options.getUserThrows) throw new Error("caído");
        return { data: { user: signIn !== "throws" && signIn.user ? signIn.user : null }, error: null };
      },
      signOut: async () => {
        calls.signOut += 1;
        if (options.signOutThrows) throw new Error("no se pudo cerrar la sesión");
        return { error: null };
      },
      getSession: () => {
        throw new Error("getSession no debe usarse");
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.role === undefined ? { role: "admin" } : options.role === null ? null : { role: options.role },
            error: options.profileError ?? null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

const credentials = (extra: Record<string, string> = {}) => form({ email: EMAIL, password: PASSWORD, ...extra });

const GENERIC = { ok: false, message: GENERIC_LOGIN_ERROR };

function setup(options: Options = {}) {
  const clock = { now: 1_000_000 };
  const limiter = createRateLimiter({ now: () => clock.now });
  return { ...fakeClient(options), limiter, clock };
}

const run = (s: ReturnType<typeof setup>, formData = credentials(), ip = IP) =>
  performLogin({ supabase: s.client, limiter: s.limiter, ip, formData });

afterEach(() => vi.restoreAllMocks());

describe("performLogin: caso correcto", () => {
  it("un admin entra y va a /admin por defecto", async () => {
    const s = setup();
    expect(await run(s)).toStrictEqual({ ok: true, redirectTo: "/admin" });
    expect(s.calls.signIn).toEqual([{ email: EMAIL, password: PASSWORD }]);
  });

  it("respeta un destino válido dentro de /admin", async () => {
    const s = setup();
    const result = await run(s, credentials({ next: "/admin/posts?page=2" }));
    expect(result).toStrictEqual({ ok: true, redirectTo: "/admin/posts?page=2" });
  });

  it.each(["//evil.com", "https://evil.com", "/login", "/admin/../login", "javascript:alert(1)"])(
    "un destino malicioso (%s) se sustituye por /admin",
    async (next) => {
      const s = setup();
      expect(await run(s, credentials({ next }))).toStrictEqual({ ok: true, redirectTo: "/admin" });
    },
  );

  it("normaliza el correo antes de enviarlo a Supabase", async () => {
    const s = setup();
    await run(s, form({ email: "  Admin@Example.COM ", password: PASSWORD }));
    expect(s.calls.signIn).toEqual([{ email: EMAIL, password: PASSWORD }]);
  });
});

describe("performLogin: todos los fallos devuelven exactamente el mismo resultado", () => {
  it.each<[string, Options]>([
    ["correo inexistente o contraseña incorrecta", { signIn: { user: null, error: { status: 400, code: "invalid_credentials", message: "Invalid login credentials" } } }],
    ["correo sin confirmar", { signIn: { user: null, error: { status: 400, code: "email_not_confirmed", message: "Email not confirmed" } } }],
    ["usuario bloqueado", { signIn: { user: null, error: { status: 400, code: "user_banned", message: "User is banned" } } }],
    ["límite de Supabase", { signIn: { user: null, error: { status: 429, code: "over_request_rate_limit", message: "rate" } } }],
    ["error 500 de Supabase", { signIn: { user: null, error: { status: 500, message: "Internal error" } } }],
    ["error desconocido", { signIn: { user: null, error: { message: "algo raro" } } }],
    ["fallo de red (excepción)", { signIn: "throws" }],
    ["inicio de sesión sin usuario ni error", { signIn: { user: null } }],
    ["sin perfil", { role: null }],
    ["perfil user (no admin)", { role: "user" }],
    ["rol desconocido", { role: "superuser" }],
    ["fallo al consultar el perfil", { profileError: { code: "XX000", message: "fallo" } }],
    ["fallo al comprobar la sesión", { getUserThrows: true }],
  ])("%s", async (_caso, options) => {
    const s = setup(options);
    expect(await run(s)).toStrictEqual(GENERIC);
  });

  it("un no admin con credenciales correctas: cierra esa sesión y devuelve el mismo error", async () => {
    const s = setup({ role: "user" });
    expect(await run(s)).toStrictEqual(GENERIC);
    expect(s.calls.signOut).toBe(1);
  });

  it("si cerrar la sesión falla, el resultado sigue siendo el mismo error genérico", async () => {
    const s = setup({ role: "user", signOutThrows: true });
    expect(await run(s)).toStrictEqual(GENERIC);
  });

  it("un admin que entra no cierra su sesión", async () => {
    const s = setup();
    await run(s);
    expect(s.calls.signOut).toBe(0);
  });

  it("el mensaje nunca contiene el de Supabase", async () => {
    const s = setup({ signIn: { user: null, error: { status: 400, message: "Invalid login credentials" } } });
    const result = await run(s);
    expect(JSON.stringify(result)).not.toMatch(/invalid|supabase|token|status/i);
  });
});

describe("performLogin: validación y límite de intentos", () => {
  it.each([
    ["un correo con formato inválido", form({ email: "no-es-un-correo", password: PASSWORD })],
    ["un correo vacío", form({ email: "", password: PASSWORD })],
    ["una contraseña vacía", form({ email: EMAIL, password: "" })],
    ["una contraseña demasiado larga", form({ email: EMAIL, password: "x".repeat(73) })],
    ["campos ausentes", form({})],
  ])("%s: mismo error y sin llamar a Supabase", async (_caso, formData) => {
    const s = setup();
    expect(await run(s, formData)).toStrictEqual(GENERIC);
    expect(s.calls.signIn).toEqual([]);
  });

  it("al llegar al límite no se llama a Supabase y se devuelve el mensaje de límite", async () => {
    const s = setup({ signIn: { user: null, error: { status: 400, message: "x" } } });
    for (let i = 0; i < 5; i++) expect(await run(s)).toStrictEqual(GENERIC);
    expect(s.calls.signIn).toHaveLength(5);

    expect(await run(s)).toStrictEqual({ ok: false, message: RATE_LIMIT_ERROR });
    expect(s.calls.signIn).toHaveLength(5);
  });

  it("el límite también bloquea las credenciales correctas", async () => {
    const wrong = setup({ signIn: { user: null, error: { status: 400, message: "x" } } });
    for (let i = 0; i < 5; i++) await run(wrong);
    const blocked = await performLogin({
      supabase: fakeClient().client,
      limiter: wrong.limiter,
      ip: IP,
      formData: credentials(),
    });
    expect(blocked).toStrictEqual({ ok: false, message: RATE_LIMIT_ERROR });
  });

  it("los intentos de otra IP no se ven afectados", async () => {
    const s = setup({ signIn: { user: null, error: { status: 400, message: "x" } } });
    for (let i = 0; i < 5; i++) await run(s);
    const other = await performLogin({ supabase: fakeClient().client, limiter: s.limiter, ip: "198.51.100.1", formData: credentials() });
    expect(other).toStrictEqual({ ok: true, redirectTo: "/admin" });
  });

  it("las entradas inválidas y los no admin también cuentan como fallo", async () => {
    const s = setup({ role: "user" });
    for (let i = 0; i < 3; i++) await run(s, form({ email: "mal", password: "x" }));
    for (let i = 0; i < 2; i++) await run(s);
    expect(s.limiter.isBlocked(IP)).toBe(true);
  });

  it("un éxito reinicia el contador de la IP", async () => {
    const s = setup();
    const failing = fakeClient({ signIn: { user: null, error: { status: 400, message: "x" } } });
    for (let i = 0; i < 4; i++) await performLogin({ supabase: failing.client, limiter: s.limiter, ip: IP, formData: credentials() });
    expect(await run(s)).toStrictEqual({ ok: true, redirectTo: "/admin" });
    for (let i = 0; i < 4; i++) await performLogin({ supabase: failing.client, limiter: s.limiter, ip: IP, formData: credentials() });
    expect(s.limiter.isBlocked(IP)).toBe(false);
  });
});

describe("performLogin: sin secretos en logs", () => {
  it("no escribe en la consola ni la contraseña, ni el correo, ni las claves", async () => {
    const spies = (["log", "info", "warn", "error", "debug", "trace"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const scenarios: Options[] = [
      {},
      { role: "user" },
      { signIn: { user: null, error: { status: 400, message: `bad ${PASSWORD} ${ANON_KEY}` } } },
      { signIn: "throws" },
    ];
    for (const options of scenarios) await run(setup(options));

    const written = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    for (const secret of [PASSWORD, EMAIL, ANON_KEY]) expect(written).not.toContain(secret);
  });
});
