"use client";

import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="flex min-h-16 items-center justify-between border-b px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
