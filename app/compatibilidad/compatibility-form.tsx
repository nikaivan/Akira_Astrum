"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compatibilityAction } from "@/lib/compatibility/actions";
import { CompatibilityResult } from "./compatibility-result";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

type FieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

function DateField({ id, name, label, defaultValue, error, inputRef }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        min="1900-01-01"
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
      />
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CompatibilityForm({ disclaimer }: { disclaimer: string }) {
  const [state, formAction, pending] = useActionState(compatibilityAction, null);
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
        setLast({ birthA: String(data.get("birthA") ?? ""), birthB: String(data.get("birthB") ?? "") });
      }}
      className="flex flex-col gap-4"
    >
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
      {state && !state.ok ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button id="calculate" type="submit" disabled={pending} className="h-11 text-base transition-none">
        Calcular
      </Button>
      <div aria-live="polite">
        {state?.ok ? (
          <CompatibilityResult result={state.result} />
        ) : (
          <p data-testid="disclaimer" className="text-sm">
            {disclaimer}
          </p>
        )}
      </div>
    </form>
  );
}
