"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppToaster } from "@/components/ui/sonner";
import { ReduxProvider } from "@/store/redux-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AuthProvider>
          {children}
          <AppToaster />
        </AuthProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}
