const DEFAULT_PATH = "/admin";
const MAX_LENGTH = 2000;
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

function isSafeSegment(segment: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return decoded !== "." && decoded !== ".." && !CONTROL_OR_BACKSLASH.test(decoded) && !decoded.includes("/");
}

/**
 * Devuelve un destino interno seguro tras el login (A01, redirección abierta):
 * solo `/admin` o `/admin/...`, con su query y sin hash. Cualquier otra cosa → `/admin`.
 */
export function safeAdminPath(input: unknown): string {
  if (typeof input !== "string" || input.length > MAX_LENGTH || CONTROL_OR_BACKSLASH.test(input)) {
    return DEFAULT_PATH;
  }

  const withoutHash = input.split("#")[0];
  const queryStart = withoutHash.indexOf("?");
  const pathname = queryStart === -1 ? withoutHash : withoutHash.slice(0, queryStart);

  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return DEFAULT_PATH;

  const segments = pathname.slice(1).split("/");
  const lastIndex = segments.length - 1;
  const valid = segments.every((segment, index) =>
    segment === "" ? index === lastIndex && index > 0 : isSafeSegment(segment),
  );

  return valid ? withoutHash : DEFAULT_PATH;
}
