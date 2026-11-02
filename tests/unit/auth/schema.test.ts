import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/auth/schema";

describe("loginSchema", () => {
  it("acepta un correo y una contraseña válidos", () => {
    const result = loginSchema.safeParse({ email: "admin@example.com", password: "una-clave" });
    expect(result.success).toBe(true);
  });

  it("recorta el correo y lo pasa a minúsculas, pero no toca la contraseña", () => {
    const result = loginSchema.safeParse({ email: "  Admin@Example.COM \n", password: " clave con espacios " });
    expect(result.data).toEqual({ email: "admin@example.com", password: " clave con espacios " });
  });

  it("acepta una contraseña de 72 caracteres", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x".repeat(72) }).success).toBe(true);
  });

  it.each([
    ["un correo vacío", { email: "", password: "x" }],
    ["un correo sin arroba", { email: "admin.example.com", password: "x" }],
    ["un correo sin dominio", { email: "admin@", password: "x" }],
    ["un correo de más de 254 caracteres", { email: `${"a".repeat(250)}@example.com`, password: "x" }],
    ["una contraseña vacía", { email: "a@example.com", password: "" }],
    ["una contraseña de 73 caracteres", { email: "a@example.com", password: "x".repeat(73) }],
    ["un correo que no es texto", { email: 123, password: "x" }],
    ["una contraseña que no es texto", { email: "a@example.com", password: 123 }],
    ["un objeto como correo", { email: { $ne: "" }, password: "x" }],
    ["falta la contraseña", { email: "a@example.com" }],
    ["falta el correo", { password: "x" }],
    ["un objeto vacío", {}],
    ["null", null],
    ["un texto", "admin@example.com"],
  ])("rechaza %s", (_caso, entrada) => {
    expect(loginSchema.safeParse(entrada).success).toBe(false);
  });

  it("ignora los campos que no conoce", () => {
    const result = loginSchema.safeParse({ email: "a@example.com", password: "x", role: "admin" });
    expect(result.data).toEqual({ email: "a@example.com", password: "x" });
  });
});
