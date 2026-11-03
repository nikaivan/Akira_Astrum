"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/admin/state";

type Props = {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  label: string;
  /** Nombre accesible que incluye el título de la entrada, para distinguir las filas. */
  ariaLabel: string;
};

/** Botón de una fila del listado (publicar o despublicar) con el aviso de error junto a él. */
export function RowAction({ action, id, label, ariaLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" className="h-11 px-4" aria-label={ariaLabel} disabled={pending}>
        {label}
      </Button>
      {state && !state.ok ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
