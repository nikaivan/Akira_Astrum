import Image from "next/image";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import type { PostDetail } from "@/lib/blog/queries";

const chipClass =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-base text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = { post: PostDetail; imageOrigin?: string | null };

/** Entrada completa: el título es el único h1; el contenido se pinta con el Markdown sanitizado. */
export function PostArticle({ post, imageOrigin }: Props) {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold [overflow-wrap:anywhere]">{post.title}</h1>
        {post.categories.length > 0 ? (
          <ul className="flex flex-wrap gap-x-2">
            {post.categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/categorias/${category.slug}`} className={chipClass}>
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-base text-muted-foreground">
          <time dateTime={post.publishedAt}>{post.dateLabel}</time> · {post.readingMinutes} min de lectura
        </p>
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
        <Link href="/compatibilidad" className={chipClass}>
          Calcula la compatibilidad entre dos signos
        </Link>
      </p>
    </article>
  );
}
