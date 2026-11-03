import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="font-semibold">Akira Astrum · Intranet</span>
        <form action={logout}>
          <Button type="submit" variant="outline" className="h-11">
            Cerrar sesión
          </Button>
        </form>
      </header>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
