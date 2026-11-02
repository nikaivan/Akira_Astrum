import * as React from "react";
import { cn } from "@/lib/utils";

/** Campo de texto con objetivo táctil de 44 px, foco visible y estado de error accesible. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
