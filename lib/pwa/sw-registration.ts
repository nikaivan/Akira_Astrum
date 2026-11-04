type ServiceWorkerHost = {
  serviceWorker?: { register(scriptUrl: string, options: { scope: string; updateViaCache: "none" }): Promise<unknown> };
};

/**
 * Registra el service worker de la PWA (ADR 0022). El archivo se revalida siempre (`updateViaCache: "none"`) y su alcance es
 * toda la web; él mismo decide que /admin y el acceso no pasan por su lógica. Si el navegador no lo admite o el registro
 * falla, la web funciona igual: el error no sale.
 */
export async function registerServiceWorker(host: ServiceWorkerHost | undefined = typeof navigator === "undefined" ? undefined : navigator): Promise<void> {
  try {
    await host?.serviceWorker?.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    // Sin service worker no hay modo sin conexión, nada más.
  }
}
