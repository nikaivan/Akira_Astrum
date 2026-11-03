import Image from "next/image";
import Link from "next/link";
import type { PostCardData } from "@/lib/blog/queries";

const chipClass =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-base text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = { post: PostCardData; headingLevel?: 2 | 3 };

/** Tarjeta de una entrada: portada decorativa, título, categorías, fecha y tiempo de lectura. */
export function PostCard({ post, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="flex flex-col gap-2">
      {post.coverUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image src={post.coverUrl} alt="" fill sizes="(min-width: 768px) 360px, 100vw" className="object-cover" />
        </div>
      ) : null}
      <Heading className="text-2xl font-semibold">
        <Link
          href={`/blog/${post.slug}`}
          className="inline-flex min-h-11 items-center rounded-lg outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {post.title}
        </Link>
      </Heading>
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
    </article>
  );
}
