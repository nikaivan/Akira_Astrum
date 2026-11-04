import Image from "next/image";
import Link from "next/link";
import { CategoryLinks } from "@/components/category-links";
import { CoverPlaceholder } from "@/components/cover-placeholder";
import { PostMeta } from "@/components/post-meta";
import type { PostCardData } from "@/lib/blog/queries";
import { cn } from "@/lib/utils";

type Props = {
  post: PostCardData;
  headingLevel?: 2 | 3;
  variant?: "default" | "featured";
};

/** Tarjeta de una entrada: portada con su texto alternativo (o un marcador neutro), título, categorías, fecha y tiempo de lectura. */
export function PostCard({
  post,
  headingLevel = 2,
  variant = "default",
}: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const featured = variant === "featured";
  return (
    <article
      className={cn(
        "group/card flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft motion-safe:transition-all motion-safe:duration-300 hover:shadow-soft-lg motion-safe:hover:-translate-y-0.5",
        featured && "lg:flex-row",
      )}
    >
      {post.coverUrl ? (
        <div
          className={cn(
            "relative aspect-video w-full shrink-0 bg-muted",
            featured && "lg:aspect-auto lg:min-h-72 lg:w-1/2",
          )}
        >
          <Image
            src={post.coverUrl}
            alt={post.coverAlt ?? ""}
            fill
            sizes={
              featured
                ? "(min-width: 1024px) 480px, 100vw"
                : "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
            }
            className="object-cover motion-safe:transition-transform motion-safe:duration-700 group-hover/card:scale-[1.03]"
          />
        </div>
      ) : (
        <CoverPlaceholder className={cn("aspect-video w-full shrink-0", featured && "lg:aspect-auto lg:min-h-72 lg:w-1/2")} />
      )}
      <div
        className={cn(
          "flex flex-1 flex-col gap-3 p-5 sm:p-6",
          featured && "lg:justify-center lg:gap-4 lg:p-10",
        )}
      >
        <Heading
          className={cn(
            "font-heading text-3xl leading-tight font-medium [overflow-wrap:anywhere]",
            featured && "text-4xl lg:text-5xl",
          )}
        >
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex min-h-11 items-center rounded-lg outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {post.title}
          </Link>
        </Heading>
        <CategoryLinks categories={post.categories} />
        <div className="mt-auto">
          <PostMeta post={post} />
        </div>
      </div>
    </article>
  );
}
