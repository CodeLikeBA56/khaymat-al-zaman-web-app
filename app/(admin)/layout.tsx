import { AppShell } from "@/components/layout/app-shell";
import { RouteGuard } from "@/components/auth/route-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
