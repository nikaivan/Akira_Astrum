import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { container, panelClass } from "@/components/ui/surface-styles";
import { safeAdminPath } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";
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
        <div className={cn(container.narrow, "flex flex-1 flex-col py-12")}>
          <div className={panelClass}>
            <LoginForm next={destination} />
          </div>
        </div>
      </main>
      <SiteFooter intranetLink={false} />
    </>
  );
}
