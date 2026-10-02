"use client";

import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && profile?.role === "admin") router.replace("/employee");
  }, [loading, user, profile, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snapshot = await getDoc(doc(db, "users", credential.user.uid));

      if (!snapshot.exists() || snapshot.data().role !== "admin") {
        await auth.signOut();
        throw new Error("Only an admin account can access this system right now.");
      }

      router.replace("/employee");
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
          <h1 className="text-2xl font-semibold">Restaurant ERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
