/**
 * Convierte el `FormData` de un formulario en un objeto para validarlo con Zod en modo estricto.
 * - Ignora solo las claves internas `$ACTION_*` que añade React.
 * - Una clave repetida queda como array, para que el esquema la rechace si el campo es escalar.
 * - Los archivos se conservan como archivos, para que el esquema los rechace.
 * - `Object.fromEntries` crea claves propias: `__proto__` no altera el prototipo y el esquema lo rechaza.
 */
export function formDataToObject(formData: FormData, options: { arrays?: readonly string[] } = {}): Record<string, unknown> {
  const arrays = new Set(options.arrays ?? ["categoryIds"]);
  const grouped = new Map<string, FormDataEntryValue[]>();

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION_")) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  for (const name of arrays) if (!grouped.has(name)) grouped.set(name, []);

  return Object.fromEntries([...grouped].map(([key, values]) => [key, arrays.has(key) || values.length > 1 ? values : values[0]]));
}
