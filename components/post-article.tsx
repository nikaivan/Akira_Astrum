import Image from "next/image";
import Link from "next/link";
import { CategoryLinks } from "@/components/category-links";
import { Markdown } from "@/components/markdown";
import { PostMeta } from "@/components/post-meta";
import { textLinkClass } from "@/components/ui/link-styles";
import type { PostDetail } from "@/lib/blog/queries";

type Props = { post: PostDetail; imageOrigin?: string | null };

/** Entrada completa: el título es el único h1; el contenido se pinta con el Markdown sanitizado. */
export function PostArticle({ post, imageOrigin }: Props) {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold [overflow-wrap:anywhere]">{post.title}</h1>
        <CategoryLinks categories={post.categories} />
        <PostMeta post={post} />
      </header>
      {post.coverUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image src={post.coverUrl} alt="" fill priority sizes="(min-width: 768px) 700px, 100vw" className="object-cover" />
        </div>
      ) : null}
      <div className="flex max-w-[70ch] flex-col gap-4 text-lg leading-relaxed [overflow-wrap:anywhere] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-base">
        <Markdown source={post.content} imageOrigin={imageOrigin} />
      </div>
      <p>
        <Link href="/compatibilidad" className={textLinkClass}>
          Calcula la compatibilidad entre dos signos
        </Link>
      </p>
    </article>
  );
}
