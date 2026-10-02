"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppToaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        <AppToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
