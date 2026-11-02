import type { Metadata } from "next";
import { safeAdminPath } from "@/lib/auth/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Acceso · Akira Astrum",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const destination = safeAdminPath(typeof next === "string" ? next : undefined);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Acceso a la intranet</h1>
      <LoginForm next={destination} />
    </main>
  );
}
