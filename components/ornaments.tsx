import { cn } from "@/lib/utils";

/** Adornos propios de la identidad «noche y marfil»: SVG y CSS sin recursos externos, siempre ocultos a los lectores de pantalla. */

/** Estrella de cuatro puntas. */
export function Star({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={cn("shrink-0", className)}>
      <path d="M12 1.5l2.5 8L22.5 12l-8 2.5L12 22.5l-2.5-8L1.5 12l8-2.5z" fill="currentColor" />
    </svg>
  );
}

/** Filete dorado con una estrella en el centro. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center gap-3 text-gold", className)}>
      <span className="h-px w-16 bg-linear-to-r from-transparent to-current opacity-70" />
      <Star className="size-3" />
      <span className="h-px w-16 bg-linear-to-l from-transparent to-current opacity-70" />
    </div>
  );
}

const POINTS: Array<[number, number, number]> = [
  [70, 70, 2.4], [150, 120, 3.2], [240, 80, 2.2], [330, 150, 3], [410, 95, 2.4],
  [560, 60, 2.6], [650, 130, 3.4], [735, 85, 2.2], [790, 160, 2.6], [500, 210, 2.2], [260, 230, 2.6], [120, 240, 2],
];
// x1, y1, x2, y2 de cada línea que une dos estrellas.
const LINES: Array<[number, number, number, number]> = [
  [70, 70, 150, 120], [150, 120, 240, 80], [240, 80, 330, 150], [330, 150, 410, 95], [560, 60, 650, 130],
  [650, 130, 735, 85], [735, 85, 790, 160], [650, 130, 500, 210], [150, 120, 120, 240], [330, 150, 260, 230],
];

/** Constelaciones tenues para el fondo de las superficies noche. */
export function Constellation({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 860 300" preserveAspectRatio="xMidYMid slice" className={cn("text-gold", className)}>
      <g stroke="currentColor" strokeWidth="0.8" opacity="0.35" fill="none">
        {LINES.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <g fill="currentColor">
        {POINTS.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} opacity="0.75" />
        ))}
      </g>
    </svg>
  );
}
