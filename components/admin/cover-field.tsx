"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COVER_TOO_LARGE } from "@/lib/admin/messages";
import { MAX_IMAGE_BYTES } from "@/lib/storage/image-validation";
import { errorClass, helpClass, labelClass } from "./styles";

type Props = {
  /** Portada que ya tiene la entrada (URL pública y texto alternativo). */
  existing?: { url: string; alt: string } | null;
  /** Errores del servidor para el archivo y para el texto alternativo. */
  coverError?: string;
  altError?: string;
  /** Avisa al formulario del archivo elegido (o null): así sobrevive al reinicio que hace React tras cada envío. */
  onFileChange: (file: File | null) => void;
};

/**
 * Portada de la entrada: archivo con vista previa, texto alternativo obligatorio y botón para quitar.
 * Las comprobaciones de aquí son solo comodidad (formato y 2 MB): el servidor valida siempre el contenido.
 */
export function CoverField({ existing = null, coverError, altError, onFileChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [alt, setAlt] = useState(existing?.alt ?? "");

  // La vista previa local es una URL temporal: se libera al cambiarla y al desmontar.
  useEffect(() => () => (localUrl ? URL.revokeObjectURL(localUrl) : undefined), [localUrl]);

  const clearSelection = () => {
    if (input.current) input.current.value = "";
    setLocalUrl(null);
    onFileChange(null);
  };

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setClientError(null);
    if (file && file.size > MAX_IMAGE_BYTES) {
      setClientError(COVER_TOO_LARGE); // aviso antes de enviar nada: el servidor lo vuelve a comprobar
      clearSelection();
      return;
    }
    setRemoved(false);
    setLocalUrl(file ? URL.createObjectURL(file) : null);
    onFileChange(file);
  }

  const shownError = clientError ?? coverError;
  const preview = localUrl ? { url: localUrl, alt } : existing && !removed ? existing : null;
  const canRemove = Boolean(localUrl) || Boolean(existing && !removed);

  return (
    <fieldset className="grid gap-4">
      <legend className={labelClass}>Portada</legend>

      <div className="grid gap-1">
        <label htmlFor="post-cover" className={labelClass}>
          Imagen de portada
        </label>
        <input
          ref={input}
          id="post-cover"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? "cover-error" : "cover-help"}
          className="h-11 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-card text-base outline-none file:mr-3 file:h-full file:cursor-pointer file:border-0 file:bg-muted file:px-4 file:text-base file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
        {shownError ? (
          <p id="cover-error" className={errorClass}>
            {shownError}
          </p>
        ) : (
          <p id="cover-help" className={helpClass}>
            JPEG, PNG o WebP, máximo 2 MB.
          </p>
        )}
      </div>

      {preview ? (
        <div className="grid gap-3">
          {/* Vista previa de un archivo local (blob:) o de la portada guardada: next/image no aporta nada aquí. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={preview.alt} className="aspect-video w-full max-w-md rounded-lg border bg-muted object-cover" />
        </div>
      ) : null}

      {removed ? <input type="hidden" name="removeCover" value="on" /> : null}

      {canRemove ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() => (localUrl ? clearSelection() : setRemoved(true))}
          >
            Quitar portada
          </Button>
        </div>
      ) : null}
      {removed ? (
        <div className="grid gap-2">
          <p className={helpClass}>La portada se quitará al guardar.</p>
          <div>
            <Button type="button" variant="outline" size="touch" onClick={() => setRemoved(false)}>
              Mantener portada
            </Button>
          </div>
        </div>
      ) : null}

      {!removed ? (
        <div className="grid gap-1">
          <label htmlFor="post-cover-alt" className={labelClass}>
            Texto alternativo de la portada
          </label>
          <Input
            id="post-cover-alt"
            name="coverAlt"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            aria-required="true"
            aria-invalid={altError ? true : undefined}
            aria-describedby={altError ? "coverAlt-error" : "coverAlt-help"}
            autoComplete="off"
          />
          {altError ? (
            <p id="coverAlt-error" className={errorClass}>
              {altError}
            </p>
          ) : (
            <p id="coverAlt-help" className={helpClass}>
              Describe la imagen para quien no puede verla (obligatorio si hay portada).
            </p>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
