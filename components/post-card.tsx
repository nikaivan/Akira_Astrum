import Image from "next/image";
import Link from "next/link";
import { CategoryLinks } from "@/components/category-links";
import { PostMeta } from "@/components/post-meta";
import type { PostCardData } from "@/lib/blog/queries";
import { cn } from "@/lib/utils";

type Props = {
  post: PostCardData;
  headingLevel?: 2 | 3;
  variant?: "default" | "featured";
};

/** Tarjeta de una entrada: portada decorativa, título, categorías, fecha y tiempo de lectura. */
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
        "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md",
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
            alt=""
            fill
            sizes={
              featured
                ? "(min-width: 1024px) 480px, 100vw"
                : "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
            }
            className="object-cover"
          />
        </div>
      ) : null}
      <div
        className={cn(
          "flex flex-1 flex-col gap-2 p-4 sm:p-5",
          featured && "lg:justify-center lg:gap-3 lg:p-8",
        )}
      >
        <Heading
          className={cn(
            "font-heading text-2xl leading-tight font-semibold",
            featured && "text-3xl lg:text-4xl",
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
