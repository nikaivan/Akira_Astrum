"use client";

import { CircleAlert } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { panelClass } from "@/components/ui/surface-styles";
import { compatibilityAction } from "@/lib/compatibility/actions";
import { cn } from "@/lib/utils";
import { CompatibilityResult } from "./compatibility-result";

type FieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

/** Error con icono y texto, nunca solo color. */
function ErrorText({ children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      {...props}
      className="flex items-start gap-2 text-base font-medium text-destructive"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function DateField({
  id,
  name,
  label,
  defaultValue,
  error,
  inputRef,
}: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium">
        {label}
      </label>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        min="1900-01-01"
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </div>
  );
}

export function CompatibilityForm({ disclaimer }: { disclaimer: string }) {
  const [state, formAction, pending] = useActionState(
    compatibilityAction,
    null,
  );
  // Los campos no son controlados (lo escrito antes de hidratar no se pierde). Al enviar se
  // recuerdan en el navegador como valor por defecto, para que el reinicio del formulario
  // que hace React tras la acción no los borre. No salen del navegador ni se guardan.
  const [last, setLast] = useState({ birthA: "", birthB: "" });
  const refA = useRef<HTMLInputElement>(null);
  const refB = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state || state.ok) return;
    (state.errors.birthA ? refA : refB).current?.focus();
  }, [state]);

  const errors = state && !state.ok ? state.errors : {};

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        setLast({
          birthA: String(data.get("birthA") ?? ""),
          birthB: String(data.get("birthB") ?? ""),
        });
      }}
      className="flex flex-col gap-6"
    >
      <div className={cn(panelClass, "flex flex-col gap-5")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <DateField
            id="birth-a"
            name="birthA"
            label="Fecha de nacimiento de la primera persona"
            defaultValue={last.birthA}
            error={errors.birthA}
            inputRef={refA}
          />
          <DateField
            id="birth-b"
            name="birthB"
            label="Fecha de nacimiento de la segunda persona"
            defaultValue={last.birthB}
            error={errors.birthB}
            inputRef={refB}
          />
        </div>
        {state && !state.ok ? (
          <ErrorText role="alert">{state.message}</ErrorText>
        ) : null}
        <Button
          id="calculate"
          type="submit"
          disabled={pending}
          className="h-11 text-base shadow-sm transition-none"
        >
          Calcular
        </Button>
      </div>
      <div aria-live="polite">
        {state?.ok ? (
          <CompatibilityResult result={state.result} />
        ) : (
          <p
            data-testid="disclaimer"
            className="border-l-4 border-gold pl-3 text-base leading-relaxed text-muted-foreground"
          >
            {disclaimer}
          </p>
        )}
      </div>
    </form>
  );
}
