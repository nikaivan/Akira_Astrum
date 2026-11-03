"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type EditorTab = "edit" | "preview";
const TABS: { id: EditorTab; label: string }[] = [
  { id: "edit", label: "Editar" },
  { id: "preview", label: "Vista previa" },
];

/**
 * Pestañas Editar / Vista previa, solo en móvil (en escritorio ambos paneles se ven a la vez, ver `md:hidden`).
 * Patrón ARIA de pestañas: flechas izquierda y derecha cambian de pestaña y mueven el foco.
 */
export function EditorTabs({ tab, onChange }: { tab: EditorTab; onChange: (tab: EditorTab) => void }) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label="Editor y vista previa" className="flex gap-2 md:hidden">
      {TABS.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`tab-${item.id}`}
          aria-selected={tab === item.id}
          aria-controls={`panel-${item.id}`}
          tabIndex={tab === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={cn(
            "min-h-11 rounded-lg border px-4 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            tab === item.id ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
