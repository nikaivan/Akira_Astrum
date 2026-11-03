import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estilos compartidos del panel (docs/design.md §2, §6 y §7): objetivos de 44 px, foco visible y estados con texto. */
export const labelClass = "text-base font-medium";
export const helpClass = "text-base text-muted-foreground";
export const errorClass = "text-base font-medium text-destructive";
export const cardClass = "rounded-xl border bg-card p-4 sm:p-5";

/** Clases de un enlace o disparador con aspecto de botón. `cn` resuelve los conflictos de Tailwind (por ejemplo text-sm y text-base). */
export const outlineButton = cn(buttonVariants({ variant: "outline", size: "touch" }));
export const primaryButton = cn(buttonVariants({ size: "touch" }));
export const destructiveButton = cn(buttonVariants({ size: "touch" }), "bg-destructive text-white hover:bg-destructive/90");
