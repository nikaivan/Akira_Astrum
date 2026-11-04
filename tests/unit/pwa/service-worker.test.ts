import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Se ejecuta el public/sw.js real en un entorno simulado: sin red, sin navegador y sin dependencias.
const SOURCE = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "http://localhost:3100";
const EXPECTED_PRECACHE = ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/offline", "/offline.css"];

type Handler = (event: Record<string, unknown>) => void;
type FakeRequest = { url: string; method: string; mode: string; destination: string; headers: Headers };

type Overrides = { method?: string; mode?: string; destination?: string; headers?: Record<string, string> };
const request = (path: string, overrides: Overrides = {}): FakeRequest => ({
  url: path.startsWith("http") ? path : `${ORIGIN}${path}`,
  method: overrides.method ?? "GET",
  mode: overrides.mode ?? "navigate",
  destination: overrides.destination ?? "document",
  headers: new Headers(overrides.headers ?? {}),
});

const pathnameOf = (input: unknown) => new URL(typeof input === "string" ? input : (input as { url: string }).url, ORIGIN).pathname;

function harness(network: (url: string) => Promise<Response> = async () => new Response("red", { status: 200 })) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const writes: string[] = [];
  const fetchSpy = vi.fn(async (input: unknown) => network(typeof input === "string" ? input : (input as { url: string }).url));

  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name) as Map<string, Response>;
    return {
      async addAll(urls: string[]) {
        for (const url of urls) {
          const response = await fetchSpy(url);
          writes.push(url);
          store.set(pathnameOf(url), response);
        }
      },
      async add(url: string) {
        return this.addAll([url]);
      },
      async put(input: unknown, response: Response) {
        writes.push(pathnameOf(input));
        store.set(pathnameOf(input), response);
      },
      async match(input: unknown) {
        return store.get(pathnameOf(input));
      },
      async keys() {
        return [...store.keys()].map((path) => ({ url: `${ORIGIN}${path}` }));
      },
    };
  };

  const caches = {
    open: async (name: string) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (input: unknown) => {
      for (const store of stores.values()) {
        const found = store.get(pathnameOf(input));
        if (found) return found;
      }
      return undefined;
    },
  };

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler;
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  const sandbox = { self, caches, fetch: fetchSpy, URL, Response, Headers, Promise, console, setTimeout };
  vm.runInNewContext(SOURCE, sandbox, { filename: "sw.js" });

  async function lifecycle(type: "install" | "activate") {
    const waits: Promise<unknown>[] = [];
    handlers[type]?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
  }

  /** Lanza un evento fetch: devuelve la respuesta si el service worker la gestiona, o null si deja pasar la petición. */
  function dispatch(req: FakeRequest): Promise<Response> | null {
    let handled: Promise<Response> | null = null;
    handlers.fetch?.({ request: req, respondWith: (promise: Promise<Response>) => (handled = promise), waitUntil: () => undefined });
    return handled;
  }

  const cached = () => Object.fromEntries([...stores.entries()].map(([name, store]) => [name, [...store.keys()].sort()]));
  return { handlers, self, caches, stores, writes, fetchSpy, lifecycle, dispatch, cached };
}

describe("public/sw.js: ciclo de vida", () => {
  it("registra los tres eventos y nada más", () => {
    const { handlers } = harness();
    expect(Object.keys(handlers).sort()).toEqual(["activate", "fetch", "install"]);
  });

  it("al instalar precachea exactamente la página sin conexión, su CSS y los iconos, y se activa de inmediato", async () => {
    const sw = harness();
    await sw.lifecycle("install");
    const names = [...sw.stores.keys()];
    expect(names).toHaveLength(1);
    expect(sw.cached()[names[0] as string]).toEqual(EXPECTED_PRECACHE);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it("ninguna ruta precacheada es de la intranet ni del acceso", async () => {
    const sw = harness();
    await sw.lifecycle("install");
    for (const url of sw.writes) expect(pathnameOf(url)).not.toMatch(/^\/(admin|login)/i);
  });

  it("la caché lleva versión (-vN), de modo que una nueva sustituye a la anterior", () => {
    expect(SOURCE).toMatch(/akira-astrum-offline-v\d+/);
  });

  it("al activarse borra las versiones antiguas, conserva la actual y toma el control", async () => {
    const sw = harness();
    await sw.lifecycle("install");
    const current = [...sw.stores.keys()][0] as string;
    sw.stores.set("akira-astrum-offline-v0", new Map([["/vieja", new Response("x")]]));
    sw.stores.set("akira-astrum-otra-cosa", new Map());
    await sw.lifecycle("activate");

    expect([...sw.stores.keys()]).not.toContain("akira-astrum-offline-v0");
    expect([...sw.stores.keys()]).not.toContain("akira-astrum-otra-cosa");
    expect([...sw.stores.keys()]).toContain(current);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("no toca cachés de otros orígenes o aplicaciones (sin prefijo akira-astrum-)", async () => {
    const sw = harness();
    sw.stores.set("otra-app-v1", new Map());
    await sw.lifecycle("activate");
    expect([...sw.stores.keys()]).toContain("otra-app-v1");
  });
});

describe("public/sw.js: lo que NO gestiona (la petición sigue su camino normal)", () => {
  const untouched: [string, FakeRequest][] = [
    ["la intranet", request("/admin")],
    ["una subruta de la intranet", request("/admin/posts/abc/edit")],
    ["la intranet con consulta", request("/admin?x=1")],
    ["la intranet con barra final", request("/admin/")],
    ["la intranet con mayúsculas", request("/ADMIN/posts")],
    ["la intranet con letras codificadas", request("/%61dmin/posts")],
    ["la intranet con barras duplicadas", request("//admin/posts")],
    ["el acceso", request("/login")],
    ["el acceso con destino", request("/login?next=/admin")],
    ["el acceso con letras codificadas", request("/%6Cogin")],
    ["un POST (Server Action)", request("/blog", { method: "POST" })],
    ["una acción de servidor por cabecera", request("/", { headers: { "Next-Action": "abc123" } })],
    ["una petición RSC", request("/blog", { headers: { RSC: "1" } })],
    ["una petición RSC por consulta", request("/blog?_rsc=abc")],
    ["una precarga del enrutador", request("/blog", { headers: { "Next-Router-Prefetch": "1" } })],
    ["una petición autenticada", request("/blog", { headers: { Authorization: "Bearer x" } })],
    ["otro origen", request("https://evil.example/blog")],
    ["la API", request("/api/x")],
    ["un estático de Next", request("/_next/static/chunks/a.js", { mode: "no-cors", destination: "script" })],
    ["una imagen de Next", request("/_next/image?url=%2Fa.png&w=64&q=75", { mode: "no-cors", destination: "image" })],
    ["una petición que no es una navegación", request("/blog", { mode: "cors", destination: "" })],
    ["una petición HEAD", request("/blog", { method: "HEAD" })],
    ["una URL de otro protocolo", request("ftp://localhost:3100/blog")],
  ];

  it.each(untouched)("%s: no hace respondWith ni toca la red ni la caché", async (_caso, req) => {
    const sw = harness();
    await sw.lifecycle("install");
    const before = sw.fetchSpy.mock.calls.length;
    const writesBefore = sw.writes.length;

    expect(sw.dispatch(req)).toBeNull();
    expect(sw.fetchSpy.mock.calls.length).toBe(before);
    expect(sw.writes.length).toBe(writesBefore);
  });
});

describe("public/sw.js: navegaciones públicas", () => {
  it.each(["/", "/blog", "/blog/una-entrada", "/categorias/luna", "/compatibilidad", "/offline"])("%s con red: devuelve la respuesta de la red y no guarda nada", async (path) => {
    const network = new Response("<html>público</html>", { status: 200 });
    const sw = harness(async (url) => (url.endsWith(path) && !path.startsWith("/offline") ? network : new Response("ok")));
    await sw.lifecycle("install");
    const cachedBefore = JSON.stringify(sw.cached());
    const writesBefore = sw.writes.length;

    const response = (await sw.dispatch(request(path))) as Response;
    expect(response).toBeInstanceOf(Response);
    expect(sw.writes.length).toBe(writesBefore);
    expect(JSON.stringify(sw.cached())).toBe(cachedBefore);
  });

  it.each([404, 403, 500, 503])("un error %i del servidor pasa tal cual y no se sustituye por la página sin conexión", async (status) => {
    const failing = new Response("error del servidor", { status });
    const sw = harness(async (url) => (url.includes("/blog") ? failing : new Response("ok")));
    await sw.lifecycle("install");
    const response = (await sw.dispatch(request("/blog"))) as Response;
    expect(response).toBe(failing);
  });

  it("sin conexión sirve /offline desde la caché", async () => {
    let online = true;
    const sw = harness(async (url) => {
      if (!online && !url.includes("/offline")) throw new TypeError("Failed to fetch");
      return new Response(`contenido de ${url}`, { status: 200 });
    });
    await sw.lifecycle("install");
    online = false;

    const response = (await sw.dispatch(request("/blog"))) as Response;
    expect(await response.text()).toContain("/offline");
    expect(response.status).toBe(200);
  });

  it("sin conexión y sin /offline en caché: error de red, nunca contenido ajeno", async () => {
    const sw = harness(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(sw.dispatch(request("/blog")) as Promise<Response>).rejects.toThrow();
  });

  it("sin conexión no sirve páginas guardadas de ninguna ruta pública distinta de /offline", async () => {
    const sw = harness(async () => {
      throw new TypeError("Failed to fetch");
    });
    sw.stores.set("akira-astrum-offline-v1", new Map([["/blog", new Response("contenido antiguo")]]));
    await expect(sw.dispatch(request("/blog")) as Promise<Response>).rejects.toThrow();
  });
});

describe("public/sw.js: código", () => {
  it.each([
    ["importScripts", /importScripts/],
    ["eval", /\beval\s*\(/],
    ["new Function", /new Function/],
    ["localStorage", /localStorage|sessionStorage|indexedDB/],
    ["XMLHttpRequest", /XMLHttpRequest/],
    ["una URL absoluta externa", /https?:\/\//],
    ["registro por consola de datos", /console\.(log|info|warn|error)/],
  ])("no usa %s", (_nombre, pattern) => {
    expect(SOURCE).not.toMatch(pattern);
  });

  it("solo guarda en la caché con addAll al instalar (nunca cache.put de una respuesta de red)", () => {
    expect(SOURCE).not.toMatch(/\.put\s*\(/);
  });

  it("menciona la intranet solo en su lista de exclusión", () => {
    const mentions = SOURCE.split("\n").filter((line) => /admin|login/i.test(line));
    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions.length).toBeLessThanOrEqual(4);
  });
});
