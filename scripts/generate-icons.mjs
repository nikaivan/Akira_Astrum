// Genera los iconos de la PWA (Fase 3, D): un pentagrama dorado sobre el azul noche de la identidad visual (ADR 0018).
// Es reproducible y no añade dependencias: dibuja un SVG y lo captura con el Chromium de Playwright.
//   PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";

const NIGHT = "#0B1026";
const GOLD = "#D9B877";

const point = (cx, cy, radius, step) => {
  const angle = ((-90 + 72 * step) * Math.PI) / 180;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
};

/** Estrella de cuatro puntas, como la de la cabecera. */
const sparkle = (cx, cy, size) => {
  const k = size / 21;
  const p = (x, y) => `${(cx + (x - 12) * k).toFixed(1)} ${(cy + (y - 12) * k).toFixed(1)}`;
  return `<path d="M${p(12, 1.5)} L${p(14.5, 9.5)} L${p(22.5, 12)} L${p(14.5, 14.5)} L${p(12, 22.5)} L${p(9.5, 14.5)} L${p(1.5, 12)} L${p(9.5, 9.5)} Z" fill="${GOLD}"/>`;
};

/**
 * `reach` es el radio del pentagrama sobre un lienzo de 512. En el icono enmascarable todo queda dentro del 80 % central
 * (la zona segura): el sistema puede recortarlo como círculo, cuadrado redondeado o gota.
 */
function svg({ reach, stroke, small }) {
  const cy = 262;
  const star = [0, 2, 4, 1, 3].map((step) => point(256, cy, reach, step).map((n) => n.toFixed(1)).join(" "));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${NIGHT}"/>
<polygon points="${star.join(" ")}" fill="none" stroke="${GOLD}" stroke-width="${stroke}" stroke-linejoin="round"/>
${small.map(([x, y, size]) => sparkle(x, y, size)).join("\n")}
</svg>`;
}

const ANY = svg({ reach: 196, stroke: 16, small: [[96, 104, 38], [420, 404, 28]] });
const MASKABLE = svg({ reach: 150, stroke: 15, small: [[146, 150, 30], [372, 372, 22]] });
// A tamaños diminutos (16 y 32 px) el trazo y el pentagrama necesitan más cuerpo para no desaparecer.
const TINY = svg({ reach: 214, stroke: 34, small: [] });

const OUTPUTS = [
  { file: "public/icon-192.png", size: 192, art: ANY },
  { file: "public/icon-512.png", size: 512, art: ANY },
  { file: "public/icon-maskable-512.png", size: 512, art: MASKABLE },
  { file: "app/apple-icon.png", size: 180, art: ANY },
];
const FAVICON_SIZES = [16, 32, 48];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
async function render(art, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><body style="margin:0">${art.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return png;
}

/** PNG con canal alfa (RGBA), que es lo que Next exige dentro de un .ico: se dibuja en un canvas y se codifica aquí. */
async function renderRgba(art, size) {
  const page = await browser.newPage();
  const markup = art.replace('width="512" height="512"', `width="${size}" height="${size}"`);
  const pixels = await page.evaluate(
    async ({ markup, size }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
      await image.decode();
      const canvas = new OffscreenCanvas(size, size);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, size, size);
      return Array.from(context.getImageData(0, 0, size, size).data);
    },
    { markup, size },
  );
  await page.close();

  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, sin entrelazado
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) Buffer.from(pixels.slice(y * size * 4, (y + 1) * size * 4)).copy(rows, y * (size * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

/** Contenedor .ico con una imagen PNG por tamaño. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

await mkdir("public", { recursive: true });
for (const { file, size, art } of OUTPUTS) await writeFile(file, await render(art, size));
const favicons = [];
for (const size of FAVICON_SIZES) favicons.push({ size, png: await renderRgba(size >= 48 ? ANY : TINY, size) });
await writeFile("app/favicon.ico", ico(favicons));
await browser.close();
console.log(`Iconos generados: ${OUTPUTS.map(({ file }) => file).join(", ")}, app/favicon.ico`);
