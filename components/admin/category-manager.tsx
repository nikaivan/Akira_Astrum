"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory, renameCategory } from "@/lib/admin/categories/actions";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "./confirm-delete";
import { cardClass, errorClass, helpClass, labelClass } from "./styles";

type CategoryItem = { id: string; name: string; slug: string; postCount: number };

const countLabel = (count: number) => (count === 0 ? "Sin entradas" : count === 1 ? "1 entrada" : `${count} entradas`);

function RenameForm({ category }: { category: CategoryItem }) {
  const [state, formAction, pending] = useActionState(renameCategory, null);
  const errorId = `rename-error-${category.id}`;
  const failed = state && !state.ok;

  return (
    <form action={formAction} className="grid gap-1">
      <input type="hidden" name="id" value={category.id} />
      <div className="flex flex-wrap gap-2">
        <Input
          name="name"
          defaultValue={category.name}
          aria-label={`Nuevo nombre de «${category.name}»`}
          aria-invalid={failed ? true : undefined}
          aria-describedby={failed ? errorId : undefined}
          className="max-w-xs"
          autoComplete="off"
        />
        <Button type="submit" variant="outline" size="touch" disabled={pending}>
          Guardar nombre
        </Button>
      </div>
      {failed ? (
        <p id={errorId} role="alert" className={errorClass}>
          {state.fieldErrors?.name ?? state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  const [state, formAction, pending] = useActionState(createCategory, null);
  const failed = state && !state.ok;

  return (
    <div className="grid gap-6">
      <form action={formAction} noValidate className={cn(cardClass, "grid gap-2")}>
        <label htmlFor="category-name" className={labelClass}>
          Nombre de la nueva categoría
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="category-name"
            name="name"
            aria-required="true"
            aria-invalid={failed ? true : undefined}
            aria-describedby={failed ? "category-name-error" : undefined}
            className="max-w-xs"
            autoComplete="off"
          />
          <Button type="submit" size="touch" disabled={pending}>
            Crear categoría
          </Button>
        </div>
        {failed ? (
          <p id="category-name-error" role="alert" className={errorClass}>
            {state.fieldErrors?.name ?? state.message}
          </p>
        ) : null}
      </form>

      {categories.length === 0 ? (
        <p className={helpClass}>Todavía no hay categorías.</p>
      ) : (
        <ul className="grid gap-3">
          {categories.map((category) => (
            <li key={category.id} className={cn(cardClass, "grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-start")}>
              <div className="min-w-0">
                <p className="text-xl font-semibold [overflow-wrap:anywhere]">{category.name}</p>
                <p className={helpClass}>{countLabel(category.postCount)}</p>
              </div>
              <RenameForm category={category} />
              <ConfirmDelete
                action={deleteCategory}
                fields={{ id: category.id }}
                triggerAriaLabel={`Eliminar la categoría «${category.name}»`}
                title="Eliminar categoría"
                description={
                  <p>
                    {category.postCount === 0
                      ? `Se eliminará «${category.name}». No tiene entradas asignadas.`
                      : `«${category.name}» se usa en ${countLabel(category.postCount)}. Se eliminará la categoría; las entradas se conservan, pero dejarán de tenerla.`}
                  </p>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
