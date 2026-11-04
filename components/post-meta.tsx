import type { PostCardData } from "@/lib/blog/queries";

/** Fecha de publicación y tiempo de lectura. */
export function PostMeta({ post }: { post: Pick<PostCardData, "publishedAt" | "dateLabel" | "readingMinutes"> }) {
  return (
    <p className="text-base tracking-wide text-muted-foreground">
      <time dateTime={post.publishedAt}>{post.dateLabel}</time> · {post.readingMinutes} min de lectura
    </p>
  );
}
