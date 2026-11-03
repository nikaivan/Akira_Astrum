import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <span className="font-heading text-2xl font-semibold">
            Akira Astrum <span className="font-sans text-base font-normal text-muted-foreground">· Intranet</span>
          </span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="touch">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
