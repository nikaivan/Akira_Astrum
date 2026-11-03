import { deflateSync } from "node:zlib";
import { WEBP_EXTENDED, WEBP_LOSSLESS, WEBP_LOSSY } from "./real-images";

/** Ayudantes para fabricar imágenes de prueba (válidas y rotas a propósito). El analizador no decodifica píxeles. */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export const concat = (...parts: Uint8Array[]): Uint8Array => new Uint8Array(Buffer.concat(parts));
export const ascii = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "latin1"));
const u32be = (value: number) => Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);

export const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

export function pngChunk(type: string, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  const body = concat(ascii(type), data);
  return concat(u32be(data.length), body, u32be(crc32(body)));
}

type PngOptions = { width?: number; height?: number; extraChunks?: Uint8Array[] };

/** PNG RGBA bien formado (firma, IHDR, IDAT, bloques extra opcionales e IEND). Los datos de píxeles son mínimos. */
export function makePng({ width = 8, height = 8, extraChunks = [] }: PngOptions = {}): Uint8Array {
  const ihdr = concat(u32be(width), u32be(height), Uint8Array.of(8, 6, 0, 0, 0));
  const idat = new Uint8Array(deflateSync(Buffer.alloc(33)));
  return concat(PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), ...extraChunks, pngChunk("IEND"));
}

/** PNG válido cuyo tamaño total es exactamente `total` bytes (con un bloque de texto de relleno). */
export function makePngOfSize(total: number): Uint8Array {
  const withoutPadding = makePng({ extraChunks: [pngChunk("tEXt", ascii("Comment\0"))] }).length;
  const filler = total - withoutPadding;
  if (filler < 0) throw new Error("tamaño demasiado pequeño");
  const png = makePng({ extraChunks: [pngChunk("tEXt", concat(ascii("Comment\0"), new Uint8Array(filler).fill(0x61)))] });
  if (png.length !== total) throw new Error("no se pudo ajustar el tamaño");
  return png;
}

/** Cambia las dimensiones declaradas en el segmento SOF de un JPEG (baseline o progresivo). */
export function withJpegDimensions(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(jpeg);
  let offset = 2;
  while (offset + 4 < out.length) {
    if (out[offset] !== 0xff) throw new Error("JPEG de prueba mal formado");
    const marker = out[offset + 1];
    const length = (out[offset + 2] << 8) | out[offset + 3];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      out[offset + 5] = (height >> 8) & 0xff;
      out[offset + 6] = height & 0xff;
      out[offset + 7] = (width >> 8) & 0xff;
      out[offset + 8] = width & 0xff;
      return out;
    }
    offset += 2 + length;
  }
  throw new Error("el JPEG de prueba no tiene SOF");
}

/** Cambia las dimensiones declaradas en un WebP real (lossy `VP8 `, lossless `VP8L` o extendido `VP8X`). */
export function withWebpDimensions(webp: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(webp);
  const kind = String.fromCharCode(...out.slice(12, 16));
  if (kind === "VP8 ") {
    out[26] = width & 0xff;
    out[27] = (width >> 8) & 0x3f;
    out[28] = height & 0xff;
    out[29] = (height >> 8) & 0x3f;
  } else if (kind === "VP8L") {
    const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | (out[24] & 0xf0) << 24;
    out[21] = bits & 0xff;
    out[22] = (bits >>> 8) & 0xff;
    out[23] = (bits >>> 16) & 0xff;
    out[24] = (bits >>> 24) & 0xff;
  } else if (kind === "VP8X") {
    out[24] = (width - 1) & 0xff;
    out[25] = ((width - 1) >> 8) & 0xff;
    out[26] = ((width - 1) >> 16) & 0xff;
    out[27] = (height - 1) & 0xff;
    out[28] = ((height - 1) >> 8) & 0xff;
    out[29] = ((height - 1) >> 16) & 0xff;
  } else throw new Error("WebP de prueba desconocido");
  return out;
}

export { WEBP_EXTENDED, WEBP_LOSSLESS, WEBP_LOSSY };

/** Contenidos que NO son imágenes permitidas, con la cabecera real de cada formato. */
export const SVG = ascii('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
export const SVG_WITH_PROLOG = ascii('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');
export const HTML = ascii("<!doctype html><html><body><script>alert(1)</script></body></html>");
export const TEXT = ascii("esto no es una imagen\n");
export const EXE = concat(ascii("MZ"), new Uint8Array(126).fill(0x90), ascii("This program cannot be run in DOS mode."));
export const GIF = concat(ascii("GIF89a"), Uint8Array.of(1, 0, 1, 0, 0, 0, 0, 0x3b));
export const BMP = concat(ascii("BM"), new Uint8Array(60));
export const TIFF = concat(Uint8Array.of(0x49, 0x49, 0x2a, 0x00), new Uint8Array(60));
export const AVIF = concat(Uint8Array.of(0, 0, 0, 0x1c), ascii("ftypavif"), new Uint8Array(40));
export const PDF = ascii("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
