import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <AppHeader />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
