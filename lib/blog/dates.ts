const FORMAT = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" });

/** Fecha larga en español, siempre en UTC (igual en el servidor y en el navegador). Inválida → "". */
export function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : FORMAT.format(date);
}
