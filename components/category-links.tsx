import Link from "next/link";
import { textLinkClass } from "@/components/ui/link-styles";
import type { CategoryRef } from "@/lib/blog/queries";

/** Categorías de una entrada como enlaces a su página; sin categorías, no pinta nada. */
export function CategoryLinks({ categories }: { categories: CategoryRef[] }) {
  if (categories.length === 0) return null;
  return (
    <ul className="-ml-2 flex flex-wrap gap-x-1">
      {categories.map((category) => (
        <li key={category.slug}>
          <Link href={`/categorias/${category.slug}`} className={`${textLinkClass} tracking-wide`}>
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
