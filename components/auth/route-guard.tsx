"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && profile?.role !== "admin") router.replace("/login");
  }, [loading, user, profile, pathname, router]);

  if (loading || (!user && pathname !== "/login")) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }

  return <>{children}</>;
}
