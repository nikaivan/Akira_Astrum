import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = {
  title: "Panel · Akira Astrum",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await requireAdmin();

  return <h1 className="text-2xl font-semibold">Panel de administración</h1>;
}
