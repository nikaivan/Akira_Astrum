import { errorClass, helpClass, labelClass } from "./styles";

type Props = {
  categories: { id: string; name: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string;
};

/** Casillas de categorías: un `fieldset` con leyenda, cada casilla con su etiqueta y objetivo táctil de 44 px. */
export function CategoryPicker({ categories, selected, onChange, error }: Props) {
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? "categoryIds-error" : undefined} aria-invalid={error ? true : undefined}>
      <legend className={labelClass}>Categorías</legend>
      {categories.length === 0 ? (
        <p className={helpClass}>Todavía no hay categorías. Puedes crearlas en la sección Categorías.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label key={category.id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 text-base">
              <input
                type="checkbox"
                name="categoryIds"
                value={category.id}
                checked={selected.includes(category.id)}
                onChange={(event) => onChange(event.target.checked ? [...selected, category.id] : selected.filter((id) => id !== category.id))}
                className="size-5"
              />
              {category.name}
            </label>
          ))}
        </div>
      )}
      {error ? (
        <p id="categoryIds-error" className={errorClass}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
