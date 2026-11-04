import Image from "next/image";
import Link from "next/link";
import { CategoryLinks } from "@/components/category-links";
import { Markdown } from "@/components/markdown";
import { PostMeta } from "@/components/post-meta";
import { textLinkClass } from "@/components/ui/link-styles";
import type { PostDetail } from "@/lib/blog/queries";
import { cn } from "@/lib/utils";

type Props = { post: PostDetail; imageOrigin?: string | null };

/** Entrada completa: el título es el único h1; el contenido se pinta con el Markdown sanitizado. */
export function PostArticle({ post, imageOrigin }: Props) {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <h1 className="font-heading text-5xl leading-[1.05] font-light [overflow-wrap:anywhere] sm:text-7xl">
          {post.title}
        </h1>
        <CategoryLinks categories={post.categories} />
        <PostMeta post={post} />
      </header>
      {post.coverUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-muted shadow-soft">
          <Image
            src={post.coverUrl}
            alt={post.coverAlt ?? ""}
            fill
            priority
            sizes="(min-width: 768px) 700px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="article-body mx-auto w-full max-w-[70ch] [overflow-wrap:anywhere]">
        <Markdown source={post.content} imageOrigin={imageOrigin} />
      </div>
      <aside data-surface="night" className="relative mx-auto flex w-full max-w-[70ch] flex-col items-start gap-1 overflow-hidden rounded-2xl border p-6 shadow-soft">
        <p className="font-heading text-2xl leading-snug">
          ¿Te pica la curiosidad por tu compatibilidad con otro signo?
        </p>
        <Link href="/compatibilidad" className={cn(textLinkClass, "-ml-2")}>
          Calcula la compatibilidad entre dos signos
        </Link>
      </aside>
    </article>
  );
}
