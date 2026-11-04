import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <PageBanner title="Acceso a la intranet" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-12">
          <div className="rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
            <LoginForm next={destination} />
          </div>
        </div>
      </main>
      <SiteFooter intranetLink={false} />
    </>
  );
}
