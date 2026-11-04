"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { insertImage, type InsertFieldErrors } from "@/lib/admin/image-insert";
import { uploadPostImage } from "@/lib/admin/posts/actions";
import { errorClass, helpClass, labelClass } from "./styles";

type Status = { kind: "idle" } | { kind: "inserted" } | { kind: "error"; message: string; fieldErrors: InsertFieldErrors };

/**
 * Sube una imagen para el contenido y avisa al editor con la línea de Markdown. Sus campos no tienen `name`: no viajan con el
 * guardado de la entrada. Si algo falla no se llama a `onInsert`, así que el texto nunca recibe una línea rota.
 */
export function ImageInserter({ onInsert }: { onInsert: (markdown: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const altInput = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await insertImage({ upload: (data) => uploadPostImage(null, data), image: input.current?.files?.[0] ?? null, alt });
    setPending(false);
    if (result.ok) {
      onInsert(result.markdown);
      if (input.current) input.current.value = "";
      setAlt("");
      setStatus({ kind: "inserted" });
      return;
    }
    const fieldErrors = result.fieldErrors ?? {};
    setStatus({ kind: "error", message: result.message, fieldErrors });
    (fieldErrors.image ? input.current : fieldErrors.alt ? altInput.current : null)?.focus(); // el foco va al primer campo a corregir
  }

  const errors = status.kind === "error" ? status.fieldErrors : {};
  const summary = status.kind === "error" ? [errors.image, errors.alt].filter((message): message is string => Boolean(message)) : [];

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className={labelClass}>Insertar imagen en el contenido</legend>

      <div className="grid gap-1">
        <label htmlFor="content-image-file" className={labelClass}>
          Imagen para insertar en el contenido
        </label>
        <input
          ref={input}
          id="content-image-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={errors.image ? true : undefined}
          aria-describedby={errors.image ? "content-image-file-error" : "content-image-help"}
          className="h-11 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-card text-base outline-none file:mr-3 file:h-full file:cursor-pointer file:border-0 file:bg-muted file:px-4 file:text-base file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
        {errors.image ? (
          <p id="content-image-file-error" className={errorClass}>
            {errors.image}
          </p>
        ) : (
          <p id="content-image-help" className={helpClass}>
            JPEG, PNG o WebP, máximo 2 MB.
          </p>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="content-image-alt" className={labelClass}>
          Texto alternativo de la imagen
        </label>
        <Input
          ref={altInput}
          id="content-image-alt"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          aria-required="true"
          aria-invalid={errors.alt ? true : undefined}
          aria-describedby={errors.alt ? "content-image-alt-error" : "content-image-alt-help"}
          autoComplete="off"
        />
        {errors.alt ? (
          <p id="content-image-alt-error" className={errorClass}>
            {errors.alt}
          </p>
        ) : (
          <p id="content-image-alt-help" className={helpClass}>
            Describe la imagen para quien no puede verla (obligatorio).
          </p>
        )}
      </div>

      {status.kind === "error" ? (
        <div role="alert" data-slot="image-error" className="rounded-lg border-2 border-destructive bg-card p-3 text-base font-medium text-destructive">
          <p>{status.message}</p>
          {summary.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {summary.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div role="status" data-slot="image-status" className={status.kind === "inserted" ? "text-base font-medium text-primary" : "sr-only"}>
        {status.kind === "inserted" ? "Imagen insertada." : null}
      </div>

      <div>
        <Button type="button" variant="outline" size="touch" onClick={submit} disabled={pending}>
          Insertar imagen
        </Button>
      </div>
    </fieldset>
  );
}
