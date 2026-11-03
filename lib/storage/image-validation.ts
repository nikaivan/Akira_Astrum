/* eslint-disable security/detect-object-injection -- los índices son números sobre un Uint8Array y claves de conjuntos cerrados */
/**
 * Validación de imágenes por su CONTENIDO (A05, PLAN.md §5): solo JPEG, PNG y WebP bien formados.
 * No se mira el nombre ni el Content-Type que declara el cliente, y no se usan librerías de terceros (A03).
 *
 * Se comprueba la firma, la estructura de cada formato y las dimensiones declaradas. Es estricto a propósito:
 * cualquier dato tras el final de la imagen se rechaza, lo que cierra los archivos políglotas (imagen + HTML).
 * No decodifica píxeles ni recodifica: los metadatos (EXIF, bloques de texto) se conservan.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8000;
/** Una imagen minúscula puede declarar dimensiones enormes (decompression bomb): se acota el total de píxeles. */
export const MAX_IMAGE_PIXELS = 25_000_000;

export type ImageKind = "jpeg" | "png" | "webp";
export type ValidImage = { ok: true; kind: ImageKind; extension: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number };
export type ImageFailure = "empty" | "too-large" | "unsupported" | "corrupt" | "dimensions";
export type ImageCheck = ValidImage | { ok: false; reason: ImageFailure };

type Dimensions = { width: number; height: number };
type Bytes = Uint8Array;

const FORMATS: Record<ImageKind, Pick<ValidImage, "extension" | "contentType">> = {
  jpeg: { extension: "jpg", contentType: "image/jpeg" },
  png: { extension: "png", contentType: "image/png" },
  webp: { extension: "webp", contentType: "image/webp" },
};

const u16be = (bytes: Bytes, at: number) => (bytes[at] << 8) | bytes[at + 1];
const u16le = (bytes: Bytes, at: number) => bytes[at] | (bytes[at + 1] << 8);
const u24le = (bytes: Bytes, at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
const u32be = (bytes: Bytes, at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
const u32le = (bytes: Bytes, at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
const text = (bytes: Bytes, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
const startsWith = (bytes: Bytes, prefix: readonly number[]) => prefix.every((value, index) => bytes[index] === value);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Bytes): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** PNG: firma, IHDR de 13 bytes primero, todos los bloques con su CRC, IEND al final y nada después. */
function parsePng(bytes: Bytes): Dimensions | null {
  let offset: number = PNG_SIGNATURE.length;
  let dimensions: Dimensions | null = null;

  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    const type = text(bytes, offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== u32be(bytes, offset + 8 + length)) return null;

    if (dimensions === null) {
      if (type !== "IHDR" || length !== 13) return null;
      dimensions = { width: u32be(bytes, offset + 8), height: u32be(bytes, offset + 12) };
      if (dimensions.width < 1 || dimensions.height < 1) return null;
    } else if (type === "IEND") {
      return length === 0 && end === bytes.length ? dimensions : null;
    }
    offset = end;
  }
  return null;
}

const isStartOfFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/** JPEG: recorrido de segmentos hasta un SOF (dimensiones) y un EOI que sea lo último del archivo. */
function parseJpeg(bytes: Bytes): Dimensions | null {
  let offset = 2;
  let dimensions: Dimensions | null = null;

  while (offset + 2 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1; // byte de relleno
      continue;
    }
    if (marker === 0xd9) return dimensions && offset + 2 === bytes.length ? dimensions : null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2; // marcadores sin longitud
      continue;
    }

    if (offset + 4 > bytes.length) return null;
    const length = u16be(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;

    if (isStartOfFrame(marker)) {
      if (length < 8) return null;
      const height = u16be(bytes, offset + 5);
      const width = u16be(bytes, offset + 7);
      if (width < 1 || height < 1) return null;
      dimensions = { width, height };
    }
    offset += 2 + length;

    if (marker === 0xda) {
      // Datos de la imagen: se avanza hasta el siguiente marcador real (FF 00 y los reinicios RSTn no lo son).
      while (offset < bytes.length && !(bytes[offset] === 0xff && bytes[offset + 1] !== 0x00 && !(bytes[offset + 1] >= 0xd0 && bytes[offset + 1] <= 0xd7))) offset += bytes[offset] === 0xff ? 2 : 1;
      if (offset >= bytes.length) return null;
    }
  }
  return null;
}

/** WebP: contenedor RIFF con tamaño exacto y bloques que encajan hasta el final; dimensiones de VP8, VP8L o VP8X. */
function parseWebp(bytes: Bytes): Dimensions | null {
  if (bytes.length < 20 || u32le(bytes, 4) + 8 !== bytes.length) return null;

  const first = text(bytes, 12, 16);
  let dimensions: Dimensions | null = null;
  const size = u32le(bytes, 16);
  if (first === "VP8 ") {
    if (size < 10 || (bytes[20] & 1) !== 0 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    dimensions = { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  } else if (first === "VP8L") {
    if (size < 5 || bytes[20] !== 0x2f) return null;
    const bits = u32le(bytes, 21);
    dimensions = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  } else if (first === "VP8X") {
    if (size < 10) return null;
    dimensions = { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  } else return null;

  // Todos los bloques deben encajar exactamente hasta el final (cada uno con relleno a un número par) y haber datos de imagen.
  let offset = 12;
  let hasImageData = false;
  while (offset + 8 <= bytes.length) {
    const type = text(bytes, offset, offset + 4);
    const length = u32le(bytes, offset + 4);
    const next = offset + 8 + length + (length % 2);
    if (offset + 8 + length > bytes.length) return null;
    if (type === "VP8 " || type === "VP8L") hasImageData = true;
    offset = next;
  }
  if (offset !== bytes.length && offset !== bytes.length + 1) return null;
  return hasImageData && dimensions.width > 0 && dimensions.height > 0 ? dimensions : null;
}

function detect(bytes: Bytes): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (bytes.length >= 12 && text(bytes, 0, 4) === "RIFF" && text(bytes, 8, 12) === "WEBP") return "webp";
  return null;
}

const PARSERS: Record<ImageKind, (bytes: Bytes) => Dimensions | null> = { jpeg: parseJpeg, png: parsePng, webp: parseWebp };

export function validateImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };

  const kind = detect(bytes);
  if (!kind) return { ok: false, reason: "unsupported" };

  const dimensions = PARSERS[kind](bytes);
  if (!dimensions) return { ok: false, reason: "corrupt" };
  if (dimensions.width > MAX_IMAGE_SIDE || dimensions.height > MAX_IMAGE_SIDE || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    return { ok: false, reason: "dimensions" };
  }
  return { ok: true, kind, ...FORMATS[kind], ...dimensions };
}
