import { describe, expect, it } from "vitest";
import { safeAdminPath } from "@/lib/auth/redirect";

const DEFAULT_PATH = "/admin";

describe("safeAdminPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/posts/new", "/admin/posts/new"],
    ["/admin/posts?page=2", "/admin/posts?page=2"],
    ["/admin/posts/mi%20entrada", "/admin/posts/mi%20entrada"],
    ["/admin/posts#seccion", "/admin/posts"],
    ["/admin?x=1#h", "/admin?x=1"],
  ])("acepta %j", (entrada, esperado) => {
    expect(safeAdminPath(entrada)).toBe(esperado);
  });

  it.each([
    ["una cadena vacía", ""],
    ["null", null],
    ["undefined", undefined],
    ["un número", 123],
    ["una lista", ["/admin/x"]],
    ["un objeto", {}],
    ["sin barra inicial", "admin/x"],
    ["la raíz", "/"],
    ["la página de login", "/login"],
    ["una ruta relativa al protocolo", "//evil.com"],
    ["una barra invertida inicial", "/\\evil.com"],
    ["dos barras invertidas", "\\\\evil.com"],
    ["una URL absoluta https", "https://evil.com"],
    ["una URL absoluta sin barras", "http:evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,x"],
    ["un usuario que parece un host", "/admin@evil.com"],
    ["un prefijo parecido", "/administrator"],
    ["un prefijo con una letra codificada", "/adm%69n"],
    ["un salto de directorio", "/admin/../login"],
    ["un salto de directorio codificado", "/admin/%2e%2e/login"],
    ["una barra codificada", "/admin/..%2flogin"],
    ["una barra codificada tras el prefijo", "/admin%2f..%2flogin"],
    ["una barra invertida codificada", "/admin/%5cevil"],
    ["dos barras seguidas dentro de la ruta", "/admin//evil.com"],
    ["dos barras antes de admin", "//admin/x"],
    ["una barra invertida dentro de la ruta", "/admin\\x"],
    ["un salto de línea", "/admin\r\nSet-Cookie: x=1"],
    ["un byte nulo", "/admin\u0000"],
    ["un tabulador", "/admin\tx"],
    ["una ruta de más de 2000 caracteres", `/admin/${"a".repeat(3000)}`],
  ])("rechaza %s y vuelve a /admin", (_caso, entrada) => {
    expect(safeAdminPath(entrada)).toBe(DEFAULT_PATH);
  });

  it("es idempotente", () => {
    for (const entrada of ["/admin/posts?page=2", "//evil.com", "/admin#x"]) {
      const una = safeAdminPath(entrada);
      expect(safeAdminPath(una)).toBe(una);
    }
  });
});
