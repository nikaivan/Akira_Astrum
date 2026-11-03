import type { ReactNode } from "react";

/** Cabecera de cada pantalla del panel: el único h1, con un filo dorado decorativo (docs/design.md §2). */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/40 pb-4">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}
