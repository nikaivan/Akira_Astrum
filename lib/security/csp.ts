import { httpsOrigin } from "@/lib/blog/image-config";

type CspOptions = {
  /** Nonce de esta petición (base64). */
  nonce: string;
  /** En desarrollo React necesita eval y los estilos en línea del HMR. */
  isDev: boolean;
  /** URL u origen del proyecto de Supabase; de ahí salen las imágenes del Storage. */
  storageOrigin: string | null | undefined;
};

const NONCE_FORMAT = /^[A-Za-z0-9+/]+=*$/;

/** Nonce de 128 bits, distinto en cada petición. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Content-Security-Policy de una petición. En producción ni scripts ni estilos admiten `unsafe-inline`:
 * Next marca los suyos con el nonce. `img-src` solo admite el propio origen, `blob:` (vista previa del editor)
 * y el origen limpio del Storage del proyecto.
 */
export function buildCsp({ nonce, isDev, storageOrigin }: CspOptions): string {
  if (!NONCE_FORMAT.test(nonce)) throw new Error("Nonce no válido");
  const storage = httpsOrigin(storageOrigin);

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Excepción acotada a atributos `style` (next/image escribe `style="color:transparent"`); no permite ejecutar código.
    "style-src-attr 'unsafe-inline'",
    ["img-src 'self' blob:", storage].filter(Boolean).join(" "),
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}
