export type HeaderRule = { key: string; value: string };

const PERMISSIONS_POLICY = [
  "accelerometer", "autoplay", "bluetooth", "camera", "display-capture", "geolocation", "gyroscope",
  "hid", "interest-cohort", "magnetometer", "microphone", "midi", "payment", "serial", "usb",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

/** Cabeceras que no dependen de la petición (la CSP lleva un nonce y la pone el proxy). */
export function staticSecurityHeaders(isProd: boolean): HeaderRule[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    // Solo en producción: en local se sirve por http. Sin `preload` hasta decidir el dominio definitivo.
    ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}
