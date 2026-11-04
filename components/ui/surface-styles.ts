/** Estilos de superficie compartidos por las páginas públicas (ADR 0018). Clases completas, para que Tailwind las encuentre. */

/** Panel marfil de un formulario o un resultado: esquinas amplias y sombra suave. */
export const panelClass = "rounded-2xl border bg-card p-6 shadow-soft sm:p-8";

/** Contenedor centrado con el margen lateral de la página; cada ancho tiene su uso. */
export const container = {
  /** Cuadrículas y listados. */
  wide: "mx-auto w-full max-w-5xl safe-x",
  /** Entradas, errores y 404: ancho de lectura. */
  reading: "mx-auto w-full max-w-3xl safe-x",
  /** Formularios largos (la calculadora). */
  form: "mx-auto w-full max-w-2xl safe-x",
  /** Formularios cortos (el acceso). */
  narrow: "mx-auto w-full max-w-sm safe-x",
} as const;
