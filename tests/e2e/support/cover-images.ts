import { makePngOfSize } from "../../unit/storage/images";

/**
 * Imágenes de prueba para los e2e de la portada. Las tres son REALES (64×64, generadas con un codificador de verdad):
 * un navegador y `next/image` pueden decodificarlas, así que `naturalWidth > 0` demuestra que se sirven bien.
 */
const fromBase64 = (value: string) => Buffer.from(value, "base64");

export const REAL_PNG = fromBase64("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYUlEQVR4nO3PwQnAMADEsCtk/2fm7RgmIOEF/G33bC939jQDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDtR9H/wOMR24CLwAAAABJRU5ErkJggg==");
export const REAL_JPEG = fromBase64("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABAAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5hgtOnFaEFp7VegtPatCC06cV+wVcUefgMZsUILTpxV+C06cVfgtPar8Fp7V51XFH2mAxmxRgtPar8Fp7VfgtPar8Fp7V5tXFH2eAxmxQgtPatCC06cVegtPatCC09q86rij7PAYzY8xgtPatCC09qvwWnTir8Fp7V6VXFH8d4DGbFCC06cVfgtPar8Fp7VoQWntXnVcUfZ4DGbFCC09qvwWntV+C09qvwWntXnVcUfZ4DGbFCC06cVoQWntV6C09q0ILTpxXm1cUfZ4DGbHmUFp7VfgtPar8Fp7VfgtPavSq4o/jvAYzYoQWntWhBae1XoLT2rQgtPavOq4o+zwGM2KEFp7VfgtOnFX4LT2q/Bae1edVxR9ngMZsUILT2rQgtPar8Fp04q/Bae1ebVxR9ngMZseZQWntV+C09qvwWntV+C09q9Krij+O8BjNihBae1aEFp7VegtPatCC09q86rij7PAYzYoQWnTir8Fp7VfgtPar8Fp04rzquKPs8BjNijBae1X4LTpxV+C09qvwWntXm1cUfZ4DGbH/2Q==");
export const REAL_WEBP = fromBase64("UklGRkQBAABXRUJQVlA4IDgBAABQCQCdASpAAEAAPlEmkEUjojEhKBQKAiAKCWRAB6IpwbHijUE0PufKhCYeigGFT4niilPdyztnUCv5ist6f//7flQuqXrh5///4Fh+/w1sf//sAAD+/nFjj/Io0HyWowpv//2BhPqun/EbnlEP+3vFuqB85E0N9Y76U3T12D8ZPEXb2hp7HSh9bd/LAvkKXCR6JZbgRy4a0y5gqklcVX08JDnmRr9dhv93QH/+mf58bXi2DDERQDUQrYQcz/sHkTsWZAey7OwHrjgDHkErYfP8J/+By5cuvDhvfcg1e/jzMb01BW2V+oZOCnioKsQEH+aweodmM1lFXElNLl6kN5QWPqB+tLz0/hDMS7kF1WuQDhvo32Ovezym0rZWVlSGd35rYJlK416fOQKAYbm9Id4ZhTmN31tRAAA=");

export const MIB = 1024 * 1024;

/** SVG con un script, rellenado con un comentario hasta tener exactamente `size` bytes (para reconocerlo en el bucket). */
export function svgOfSize(size: number): Buffer {
  const head = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg><!--';
  const tail = "-->";
  return Buffer.from(head + "a".repeat(size - head.length - tail.length) + tail);
}

/** PNG válido de exactamente `size` bytes: más de 2 MiB para probar el límite sin cambiar de formato. */
export const pngOfSize = (size: number): Buffer => Buffer.from(makePngOfSize(size));

/** Un archivo a medio camino entre «imagen» y «basura»: firma de PNG y nada más. */
export const brokenPng = (): Buffer => Buffer.concat([REAL_PNG.subarray(0, 8), Buffer.from("garbage-garbage-garbage")]);
