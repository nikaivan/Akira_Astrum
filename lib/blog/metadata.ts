import type { Metadata } from "next";
import type { PostDetail } from "./queries";

export const pageTitle = (title: string): string => `${title} | Akira Astrum`;

export function postMetadata(post: PostDetail): Metadata {
  return { title: pageTitle(post.title), description: post.description };
}
