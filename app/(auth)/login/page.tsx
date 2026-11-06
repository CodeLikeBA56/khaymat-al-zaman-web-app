"use client";

import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getCurrentRoleFromProfile } from "@/lib/employment";
import {
  getEffectivePermissions,
  getFirstAccessiblePath,
} from "@/config/access-control";
import { fetchUserDocumentById } from "@/store/employee/employee.service";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) return;

    const permissions = getEffectivePermissions(profile);
    const fallbackPath = getFirstAccessiblePath(permissions);

    if (fallbackPath) {
      router.replace(fallbackPath);
    }
  }, [loading, profile, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const userProfile = await fetchUserDocumentById(credential.user.uid);

      if (!userProfile) {
        await auth.signOut();
        throw new Error("User with this email does not exist in the database.");
      }

      const role = getCurrentRoleFromProfile(userProfile);

      if (!role) {
        await auth.signOut();
        throw new Error("No active role is assigned to this account.");
      }

      const permissions = getEffectivePermissions(userProfile);
      const fallbackPath = getFirstAccessiblePath(permissions);

      if (!fallbackPath) {
        await auth.signOut();
        throw new Error("No route access is configured for this account.");
      }

      router.replace(fallbackPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Khaymat-Al-Zaman ERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Staff login</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
