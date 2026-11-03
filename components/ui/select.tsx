import * as React from "react";
import { cn } from "@/lib/utils";

/** Lista desplegable nativa (teclado y lectores de pantalla sin esfuerzo), con objetivo táctil de 44 px. */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
