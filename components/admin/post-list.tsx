import { CircleCheck, FileText } from "lucide-react";
import Link from "next/link";
import { deletePost, publishPost, unpublishPost } from "@/lib/admin/posts/actions";
import type { AdminPostRow } from "@/lib/admin/queries";
import { formatPublishedDate } from "@/lib/blog/dates";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "./confirm-delete";
import { RowAction } from "./row-action";
import { cardClass, helpClass, outlineButton } from "./styles";

/** Estado con icono y texto: nunca se transmite solo con el color (docs/design.md §2). */
function StatusBadge({ published }: { published: boolean }) {
  const Icon = published ? CircleCheck : FileText;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-sm font-medium", published ? "border-primary text-primary" : "text-foreground")}>
      <Icon aria-hidden className="size-4" />
      {published ? "Publicada" : "Borrador"}
    </span>
  );
}

/**
 * Listado de entradas. Una sola lista: tarjetas apiladas en móvil y filas en cuadrícula en pantallas mayores.
 * Nunca una tabla, para que en móvil no haya desplazamiento lateral (docs/design.md §6).
 */
export function PostList({ posts }: { posts: AdminPostRow[] }) {
  if (posts.length === 0) return <p className={cn(cardClass, helpClass)}>No hay entradas que coincidan con el filtro.</p>;

  return (
    <ul className="grid gap-3">
      {posts.map((post) => {
        const published = post.status === "published";
        return (
          <li key={post.id} className={cn(cardClass, "grid gap-4 md:grid-cols-[1fr_auto] md:items-center")}>
            <div className="grid min-w-0 gap-2">
              <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">{post.title}</h2>
              <p className={cn(helpClass, "flex flex-wrap items-center gap-x-3 gap-y-1")}>
                <StatusBadge published={published} />
                <span>{published && post.publishedAt ? `Publicada el ${formatPublishedDate(post.publishedAt)}` : `Actualizada el ${formatPublishedDate(post.updatedAt)}`}</span>
                {post.categories.length > 0 ? <span>{post.categories.map((category) => category.name).join(", ")}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Link href={`/admin/posts/${post.id}/edit`} aria-label={`Editar «${post.title}»`} className={outlineButton}>
                Editar
              </Link>
              {published ? (
                <>
                  <Link href={`/blog/${post.slug}`} aria-label={`Ver en el blog: «${post.title}»`} className={outlineButton}>
                    Ver en el blog
                  </Link>
                  <RowAction action={unpublishPost} id={post.id} label="Despublicar" ariaLabel={`Despublicar «${post.title}»`} />
                </>
              ) : (
                <RowAction action={publishPost} id={post.id} label="Publicar" ariaLabel={`Publicar «${post.title}»`} />
              )}
              <ConfirmDelete
                action={deletePost}
                fields={{ id: post.id }}
                triggerAriaLabel={`Eliminar «${post.title}»`}
                title="Eliminar entrada"
                description={
                  <p>
                    Se eliminará «{post.title}» de forma permanente{published ? " y dejará de verse en el blog" : ""}. Esta acción no se puede deshacer.
                  </p>
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
