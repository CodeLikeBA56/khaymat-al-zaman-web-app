"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canAccessPath,
  getEffectivePermissions,
  getFirstAccessiblePath,
} from "@/config/access-control";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    if (!user) return;

    const permissions = getEffectivePermissions(profile);
    const canAccessCurrentPath = canAccessPath(pathname, permissions);

    if (canAccessCurrentPath) return;

    const fallbackPath = getFirstAccessiblePath(permissions);

    if (fallbackPath) {
      router.replace(fallbackPath);
      return;
    }

    router.replace("/login");
  }, [loading, pathname, profile, router, user]);

  if (loading || (!user && pathname !== "/login")) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
