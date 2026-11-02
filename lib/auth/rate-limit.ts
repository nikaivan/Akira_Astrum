const MINUTE_MS = 60_000;

type Entry = { count: number; expiresAt: number };

export type RateLimiter = {
  isBlocked(key: string): boolean;
  recordFailure(key: string): void;
  reset(key: string): void;
  size(): number;
};

type Options = { limit?: number; windowMs?: number; maxKeys?: number; now?: () => number };

/**
 * Limitador de intentos en memoria. Límites conocidos (ADR 0011): cada instancia
 * serverless cuenta por separado y un arranque en frío lo reinicia; frena la
 * fuerza bruta casual, no es una garantía.
 */
export function createRateLimiter({
  limit = 5,
  windowMs = 15 * MINUTE_MS,
  maxKeys = 10_000,
  now = Date.now,
}: Options = {}): RateLimiter {
  const entries = new Map<string, Entry>();

  const purgeExpired = () => {
    const current = now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= current) entries.delete(key);
    }
  };

  return {
    isBlocked(key) {
      purgeExpired();
      return (entries.get(key)?.count ?? 0) >= limit;
    },
    recordFailure(key) {
      purgeExpired();
      const existing = entries.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      entries.set(key, { count: 1, expiresAt: now() + windowMs });
      while (entries.size > maxKeys) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    reset(key) {
      entries.delete(key);
    },
    size() {
      return entries.size;
    },
  };
}

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * IP del cliente a partir del primer valor de `x-forwarded-for`. Fiable detrás de
 * Vercel (que lo sobrescribe); falsificable en otros despliegues. Sin valor
 * válido, todas las peticiones comparten la clave "unknown".
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const looksLikeIp = IP_PATTERN.test(first) && (first.includes(".") || first.includes(":"));
  return looksLikeIp ? first : "unknown";
}
