"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useActionState, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { ActionState } from "@/lib/admin/state";
import { cn } from "@/lib/utils";

type Props = {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  /** Campos ocultos del formulario (por ejemplo, el id). La confirmación literal se añade aquí. */
  fields: Record<string, string>;
  triggerAriaLabel: string;
  title: string;
  description: ReactNode;
};

/** Eliminar con confirmación en la interfaz (foco atrapado, Esc cierra y el foco vuelve al botón). El servidor exige además `confirm`. */
export function ConfirmDelete({ action, fields, triggerAriaLabel, title, description }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next?.ok) setOpen(false);
    return next;
  }, null);

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger aria-label={triggerAriaLabel} className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
        Eliminar
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-foreground/40" />
        <AlertDialog.Viewport className="fixed inset-0 grid place-items-center overflow-y-auto p-4">
          <AlertDialog.Popup className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none">
            <AlertDialog.Title className="text-xl font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description render={<div />} className="mt-2 text-base text-muted-foreground">
              {description}
            </AlertDialog.Description>
            {state && !state.ok ? (
              <p role="alert" className="mt-3 text-base font-medium text-destructive">
                {state.message}
              </p>
            ) : null}
            <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
              {Object.entries(fields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <input type="hidden" name="confirm" value="eliminar" />
              <AlertDialog.Close className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>Cancelar</AlertDialog.Close>
              <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: "default" }), "h-11 bg-destructive px-4 text-white hover:bg-destructive/90")}>
                Eliminar definitivamente
              </button>
            </form>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
