// Se renderiza en cada petición para que la cabecera Cache-Control sea la nuestra y no la de una ruta estática.
export const dynamic = "force-dynamic";

const HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0B1026">
<title>Sin conexión · Akira Astrum</title>
<link rel="stylesheet" href="/offline.css">
</head>
<body>
<main>
<p class="brand">Akira Astrum</p>
<h1>Sin conexión</h1>
<span class="rule" aria-hidden="true"></span>
<p>No podemos cargar esta página porque tu dispositivo no está conectado a internet. Vuelve a intentarlo cuando recuperes la conexión.</p>
<a class="link" href="/">Volver a la portada</a>
</main>
</body>
</html>
`;

/**
 * Página sin conexión de la PWA (ADR 0022). Sin JavaScript, sin estilos en línea y sin recursos externos, de modo que
 * funciona con la CSP estricta y el service worker la guarda junto a su CSS. No enlaza ni nombra la intranet.
 */
export function GET(): Response {
  return new Response(HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
