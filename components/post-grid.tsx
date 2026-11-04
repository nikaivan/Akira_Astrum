import { PostCard } from "@/components/post-card";
import type { PostCardData } from "@/lib/blog/queries";

/** Cuadrícula de tarjetas: una columna en móvil, dos desde sm y tres desde lg (mobile first). */
export function PostGrid({
  posts,
  headingLevel = 2,
}: {
  posts: PostCardData[];
  headingLevel?: 2 | 3;
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id} className="flex min-w-0">
          <PostCard post={post} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
