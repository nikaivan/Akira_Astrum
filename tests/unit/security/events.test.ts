import { describe, expect, it } from "vitest";
import { securityEvent } from "@/lib/security/events";

const NOW = () => new Date("2026-11-04T12:00:00.000Z");
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALLOWED = ["ts", "level", "event", "reason", "scope", "layer", "route", "user", "client"];

const build = (input: unknown) => securityEvent(input, NOW);

describe("securityEvent: eventos válidos", () => {
  it("login_succeeded lleva el usuario (UUID) y es informativo", () => {
    expect(build({ event: "login_succeeded", user: USER })).toEqual({ ts: "2026-11-04T12:00:00.000Z", level: "info", event: "login_succeeded", user: USER });
  });

  it.each(["invalid_input", "credentials", "not_admin", "service_error"])("login_failed admite el motivo %s y es un aviso", (reason) => {
    expect(build({ event: "login_failed", reason })).toMatchObject({ event: "login_failed", level: "warn", reason });
  });

  it.each([["forbidden", "proxy"], ["service_error", "page"]])("access_denied (%s, capa %s)", (reason, layer) => {
    expect(build({ event: "access_denied", reason, layer, route: "/admin/posts" })).toMatchObject({ event: "access_denied", level: "warn", reason, layer, route: "/admin/posts" });
  });

  it.each(["rate_limited", "too_large", "invalid_content"])("upload_rejected admite el motivo %s", (reason) => {
    expect(build({ event: "upload_rejected", reason, user: USER })).toMatchObject({ event: "upload_rejected", reason, user: USER });
  });

  it.each(["login", "calculator"])("rate_limited admite el ámbito %s", (scope) => {
    expect(build({ event: "rate_limited", scope })).toMatchObject({ event: "rate_limited", level: "warn", scope });
  });
});

describe("securityEvent: vocabulario cerrado", () => {
  it.each([
    ["un evento desconocido", { event: "admin_deleted_everything" }],
    ["sin evento", { reason: "credentials" }],
    ["un motivo fuera del vocabulario", { event: "login_failed", reason: "wrong password for admin@example.com" }],
    ["login_failed sin motivo", { event: "login_failed" }],
    ["access_denied sin capa", { event: "access_denied", reason: "forbidden" }],
    ["un ámbito desconocido", { event: "rate_limited", scope: "otra-cosa" }],
    ["rate_limited sin ámbito", { event: "rate_limited" }],
    ["nada", undefined],
    ["una cadena", "login_failed"],
  ])("%s no genera evento (devuelve null y no lanza)", (_caso, input) => {
    expect(build(input)).toBeNull();
  });
});

describe("securityEvent: nunca deja pasar datos personales", () => {
  const SECRETS = ["admin@example.com", "S3cr3t-P@ss", "1953-11-27", "1961-08-14", "secreto-nombre.png", "Failed to fetch https://x.supabase.co", "at Object.<anonymous>"];
  const hostile = {
    event: "login_failed",
    reason: "credentials",
    email: "admin@example.com",
    password: "S3cr3t-P@ss",
    birthDate: "1953-11-27",
    dates: ["1953-11-27", "1961-08-14"],
    fileName: "secreto-nombre.png",
    message: "Failed to fetch https://x.supabase.co",
    stack: "at Object.<anonymous>",
    extra: { nested: "secreto-nombre.png" },
  };

  it("solo salen los campos de la lista blanca", () => {
    const event = build(hostile);
    expect(event).not.toBeNull();
    for (const key of Object.keys(event ?? {})) expect(ALLOWED).toContain(key);
  });

  it("ningún dato sensible aparece en la salida serializada", () => {
    const text = JSON.stringify(build(hostile));
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });

  it("el __proto__ y las claves raras no se cuelan", () => {
    const text = JSON.stringify(build(JSON.parse('{"event":"login_failed","reason":"credentials","__proto__":{"polluted":"x"},"constructor":"y"}')));
    expect(text).not.toMatch(/polluted|constructor/);
  });
});

describe("securityEvent: la ruta", () => {
  it.each([
    ["/admin/posts?token=secreto", "/admin/posts"],
    ["/admin/posts#ancla", "/admin/posts"],
    ["/admin/posts/new?next=/x#y", "/admin/posts/new"],
  ])("%s se guarda como %s (sin consulta ni hash)", (route, expected) => {
    const event = build({ event: "access_denied", reason: "forbidden", layer: "proxy", route });
    expect(event?.route).toBe(expected);
    expect(JSON.stringify(event)).not.toMatch(/secreto|ancla/);
  });

  it("se corta a 100 caracteres", () => {
    const event = build({ event: "access_denied", reason: "forbidden", layer: "proxy", route: `/admin/${"a".repeat(500)}` });
    expect((event?.route ?? "").length).toBeLessThanOrEqual(100);
  });

  it.each(["https://evil.example/admin", "admin/posts", "/admin\n/posts", "/admin/\u0000", 42])("una ruta no válida (%j) se omite", (route) => {
    const event = build({ event: "access_denied", reason: "forbidden", layer: "proxy", route });
    expect(event).not.toBeNull();
    expect(event).not.toHaveProperty("route");
  });
});

describe("securityEvent: el usuario", () => {
  it.each(["admin@example.com", "no-es-un-uuid", "", "1234", { id: USER }])("un usuario que no es un UUID (%j) se omite", (user) => {
    const event = build({ event: "login_succeeded", user });
    expect(event).not.toHaveProperty("user");
    expect(JSON.stringify(event)).not.toContain("admin@example.com");
  });
});

describe("securityEvent: el cliente", () => {
  it("la IP se convierte en un identificador de 12 caracteres hexadecimales y no aparece", () => {
    const event = build({ event: "login_failed", reason: "credentials", ip: "203.0.113.5" });
    expect(event?.client).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(event)).not.toContain("203.0.113.5");
    expect(event).not.toHaveProperty("ip");
  });

  it("sin IP no hay cliente", () => {
    expect(build({ event: "login_failed", reason: "credentials" })).not.toHaveProperty("client");
  });
});
