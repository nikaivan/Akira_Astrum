"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-base font-medium">
          Correo electrónico
        </label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-base font-medium">
          Contraseña
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state ? (
        <p role="alert" className="text-base font-medium text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 text-base transition-none">
        Iniciar sesión
      </Button>
    </form>
  );
}
