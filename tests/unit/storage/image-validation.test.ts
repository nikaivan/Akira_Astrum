import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE, validateImage } from "@/lib/storage/image-validation";
import {
  AVIF,
  BMP,
  concat,
  crc32,
  EXE,
  GIF,
  HTML,
  makePng,
  makePngOfSize,
  PDF,
  pngChunk,
  SVG,
  SVG_WITH_PROLOG,
  TEXT,
  TIFF,
  ascii,
  withJpegDimensions,
  withWebpDimensions,
} from "./images";
import { JPEG_BASELINE, JPEG_EXIF, JPEG_PROGRESSIVE, PNG_PALETTE, PNG_RGBA, REAL_SIZE, WEBP_EXTENDED, WEBP_LOSSLESS, WEBP_LOSSLESS_ALPHA, WEBP_LOSSY } from "./real-images";

const MIB = 1024 * 1024;
const reasonOf = (bytes: Uint8Array) => {
  const result = validateImage(bytes);
  return result.ok ? "ok" : result.reason;
};

describe("límites", () => {
  it("coinciden con el plan", () => {
    expect(MAX_IMAGE_BYTES).toBe(2 * MIB);
    expect(MAX_IMAGE_SIDE).toBe(8000);
    expect(MAX_IMAGE_PIXELS).toBe(25_000_000);
  });
});

describe("imágenes reales de un codificador de verdad (se aceptan)", () => {
  it.each([
    ["JPEG baseline", JPEG_BASELINE, "jpeg", "jpg", "image/jpeg"],
    ["JPEG progresivo", JPEG_PROGRESSIVE, "jpeg", "jpg", "image/jpeg"],
    ["JPEG con EXIF", JPEG_EXIF, "jpeg", "jpg", "image/jpeg"],
    ["PNG RGBA", PNG_RGBA, "png", "png", "image/png"],
    ["PNG con paleta", PNG_PALETTE, "png", "png", "image/png"],
    ["WebP con pérdida", WEBP_LOSSY, "webp", "webp", "image/webp"],
    ["WebP sin pérdida", WEBP_LOSSLESS, "webp", "webp", "image/webp"],
    ["WebP sin pérdida con alfa", WEBP_LOSSLESS_ALPHA, "webp", "webp", "image/webp"],
    ["WebP extendido (VP8X)", WEBP_EXTENDED, "webp", "webp", "image/webp"],
  ])("%s", (_name, bytes, kind, extension, contentType) => {
    expect(validateImage(bytes)).toEqual({ ok: true, kind, extension, contentType, ...REAL_SIZE });
  });

  it("un PNG fabricado con bloques correctos también se acepta, con sus dimensiones", () => {
    expect(validateImage(makePng({ width: 1, height: 1 }))).toMatchObject({ ok: true, kind: "png", width: 1, height: 1 });
    expect(validateImage(makePng({ width: 640, height: 480 }))).toMatchObject({ ok: true, width: 640, height: 480 });
  });

  it("los metadatos de un PNG bien formado no lo invalidan (se conservan: no se recodifica)", () => {
    const withText = makePng({ extraChunks: [pngChunk("tEXt", ascii("Comment\0<script>alert(1)</script>"))] });
    expect(validateImage(withText)).toMatchObject({ ok: true, kind: "png" });
  });
});

describe("lo que no es una imagen permitida se rechaza por su contenido", () => {
  it("un archivo vacío", () => {
    expect(reasonOf(new Uint8Array(0))).toBe("empty");
  });

  it.each([
    ["SVG", SVG],
    ["SVG con prólogo XML", SVG_WITH_PROLOG],
    ["HTML", HTML],
    ["texto plano", TEXT],
    ["un ejecutable (MZ) renombrado .png", EXE],
    ["GIF", GIF],
    ["BMP", BMP],
    ["TIFF", TIFF],
    ["AVIF", AVIF],
    ["PDF", PDF],
    ["bytes aleatorios", new Uint8Array(Array.from({ length: 200 }, (_, i) => (i * 37 + 11) % 251))],
  ])("%s", (_name, bytes) => {
    expect(reasonOf(bytes)).toBe("unsupported");
  });
});

describe("firma correcta pero archivo corrupto", () => {
  it("PNG: solo la firma, cortado a la mitad, sin IEND o con basura tras la firma", () => {
    const png = makePng({ width: 32, height: 32 });
    expect(reasonOf(png.slice(0, 8))).toBe("corrupt");
    expect(reasonOf(png.slice(0, Math.floor(png.length / 2)))).toBe("corrupt");
    expect(reasonOf(png.slice(0, png.length - 12))).toBe("corrupt");
    expect(reasonOf(concat(png.slice(0, 8), new Uint8Array(40).fill(0x41)))).toBe("corrupt");
  });

  it("PNG: CRC roto en IHDR o en otro bloque", () => {
    const png = new Uint8Array(makePng());
    const ihdrCrc = 8 + 8 + 13; // firma + longitud y tipo + datos de IHDR
    const brokenIhdr = new Uint8Array(png);
    brokenIhdr[ihdrCrc] ^= 0xff;
    expect(reasonOf(brokenIhdr)).toBe("corrupt");

    const idatDataStart = 8 + 25 + 8;
    const brokenIdat = new Uint8Array(png);
    brokenIdat[idatDataStart] ^= 0xff;
    expect(reasonOf(brokenIdat)).toBe("corrupt");
  });

  it("PNG: dimensiones 0, IHDR de longitud errónea o un bloque que se sale del archivo", () => {
    expect(reasonOf(makePng({ width: 0, height: 8 }))).toBe("corrupt");
    expect(reasonOf(makePng({ width: 8, height: 0 }))).toBe("corrupt");

    const badLength = concat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), pngChunk("IHDR", new Uint8Array(12)), pngChunk("IEND"));
    expect(reasonOf(badLength)).toBe("corrupt");

    const overflowing = concat(makePng().slice(0, 33), Uint8Array.of(0x7f, 0xff, 0xff, 0xff), ascii("IDAT"), new Uint8Array(20));
    expect(reasonOf(overflowing)).toBe("corrupt");
  });

  it("PNG: el primer bloque debe ser IHDR", () => {
    const png = makePng();
    const noHeader = concat(png.slice(0, 8), pngChunk("IDAT", new Uint8Array(4)), pngChunk("IEND"));
    expect(reasonOf(noHeader)).toBe("corrupt");
  });

  it("JPEG: solo la firma, sin SOF, sin EOI o con dimensiones 0", () => {
    expect(reasonOf(Uint8Array.of(0xff, 0xd8, 0xff))).toBe("corrupt");
    expect(reasonOf(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9))).toBe("corrupt");
    expect(reasonOf(JPEG_BASELINE.slice(0, JPEG_BASELINE.length - 2))).toBe("corrupt");
    expect(reasonOf(JPEG_BASELINE.slice(0, Math.floor(JPEG_BASELINE.length / 2)))).toBe("corrupt");
    expect(reasonOf(withJpegDimensions(JPEG_BASELINE, 0, 16))).toBe("corrupt");
    expect(reasonOf(withJpegDimensions(JPEG_BASELINE, 24, 0))).toBe("corrupt");
  });

  it("WebP: solo la cabecera, tamaño RIFF erróneo, primer bloque desconocido o cortado", () => {
    expect(reasonOf(concat(ascii("RIFF"), Uint8Array.of(4, 0, 0, 0), ascii("WEBP")))).toBe("corrupt");

    for (const delta of [1, -1, 100]) {
      const wrongSize = new Uint8Array(WEBP_LOSSY);
      new DataView(wrongSize.buffer).setUint32(4, WEBP_LOSSY.length - 8 + delta, true);
      expect(reasonOf(wrongSize), `delta ${delta}`).toBe("corrupt");
    }

    const unknownChunk = new Uint8Array(WEBP_LOSSY);
    unknownChunk.set(ascii("JUNK"), 12);
    expect(reasonOf(unknownChunk)).toBe("corrupt");

    expect(reasonOf(WEBP_LOSSY.slice(0, 30))).toBe("corrupt");
    expect(reasonOf(WEBP_LOSSLESS.slice(0, WEBP_LOSSLESS.length - 5))).toBe("corrupt");
  });
});

describe("datos tras el final de la imagen (políglotas)", () => {
  const TRAILING = ascii("<script>alert(1)</script>");

  it("PNG tras IEND, JPEG tras EOI y WebP tras el bloque RIFF se rechazan", () => {
    expect(reasonOf(concat(makePng(), TRAILING))).toBe("corrupt");
    expect(reasonOf(concat(PNG_RGBA, TRAILING))).toBe("corrupt");
    expect(reasonOf(concat(JPEG_BASELINE, TRAILING))).toBe("corrupt");
    expect(reasonOf(concat(WEBP_LOSSY, TRAILING))).toBe("corrupt");
    expect(reasonOf(concat(WEBP_EXTENDED, new Uint8Array(1)))).toBe("corrupt");
  });

  it("un HTML que empieza como PNG no pasa", () => {
    expect(reasonOf(concat(makePng(), HTML))).toBe("corrupt");
  });
});

describe("tamaño máximo: 2 MiB", () => {
  it("2 MiB exactos se aceptan", () => {
    const exact = makePngOfSize(2 * MIB);
    expect(exact.length).toBe(2 * MIB);
    expect(validateImage(exact)).toMatchObject({ ok: true, kind: "png" });
  });

  it("2 MiB + 1 byte se rechazan, sea cual sea el contenido, sin llegar a analizarlo", () => {
    expect(reasonOf(makePngOfSize(2 * MIB + 1))).toBe("too-large");
    expect(reasonOf(new Uint8Array(2 * MIB + 1))).toBe("too-large");
    expect(reasonOf(new Uint8Array(5 * MIB))).toBe("too-large");
  });
});

describe("dimensiones máximas", () => {
  it("8000 px por lado se aceptan y 8001 se rechazan", () => {
    expect(reasonOf(makePng({ width: 8000, height: 1 }))).toBe("ok");
    expect(reasonOf(makePng({ width: 1, height: 8000 }))).toBe("ok");
    expect(reasonOf(makePng({ width: 8001, height: 1 }))).toBe("dimensions");
    expect(reasonOf(makePng({ width: 1, height: 8001 }))).toBe("dimensions");
  });

  it("25 megapíxeles exactos se aceptan y uno más se rechaza (imagen pequeña que declara una enorme)", () => {
    expect(reasonOf(makePng({ width: 5000, height: 5000 }))).toBe("ok");
    expect(reasonOf(makePng({ width: 5001, height: 5000 }))).toBe("dimensions");
    expect(reasonOf(makePng({ width: 8000, height: 8000 }))).toBe("dimensions");
  });

  it("también en JPEG y WebP", () => {
    expect(reasonOf(withJpegDimensions(JPEG_BASELINE, 8001, 1))).toBe("dimensions");
    expect(reasonOf(withJpegDimensions(JPEG_PROGRESSIVE, 5000, 5000))).toBe("ok");
    expect(reasonOf(withJpegDimensions(JPEG_BASELINE, 5001, 5000))).toBe("dimensions");
    expect(reasonOf(withWebpDimensions(WEBP_LOSSY, 8001, 1))).toBe("dimensions");
    expect(reasonOf(withWebpDimensions(WEBP_LOSSLESS, 8001, 1))).toBe("dimensions");
    expect(reasonOf(withWebpDimensions(WEBP_EXTENDED, 8001, 1))).toBe("dimensions");
    expect(validateImage(withWebpDimensions(WEBP_LOSSLESS, 1000, 700))).toMatchObject({ ok: true, width: 1000, height: 700 });
    expect(validateImage(withWebpDimensions(WEBP_EXTENDED, 1000, 700))).toMatchObject({ ok: true, width: 1000, height: 700 });
    expect(validateImage(withJpegDimensions(JPEG_BASELINE, 4000, 3000))).toMatchObject({ ok: true, width: 4000, height: 3000 });
  });
});

describe("el analizador solo mira los bytes", () => {
  it("la función solo recibe el contenido: ni el nombre ni el tipo declarado influyen", () => {
    expect(validateImage.length).toBe(1);
  });

  it("no modifica el archivo recibido", () => {
    const copy = new Uint8Array(PNG_RGBA);
    validateImage(copy);
    expect(copy).toEqual(PNG_RGBA);
  });

  it("el CRC que se comprueba es el estándar de PNG", () => {
    expect(crc32(ascii("123456789"))).toBe(0xcbf43926);
  });
});
