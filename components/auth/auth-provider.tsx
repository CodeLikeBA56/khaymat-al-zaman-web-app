"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { UserDocument } from "@/types/user";

type AuthContextValue = {
  user: User | null;
  profile: UserDocument | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        if (pathname !== "/login") router.replace("/login");
        return;
      }

      const snapshot = await getDoc(doc(db, "users", nextUser.uid));
      const nextProfile = snapshot.exists() ? (snapshot.data() as UserDocument) : null;
      setProfile(nextProfile);
      setLoading(false);

      if (pathname === "/login") {
        router.replace(nextProfile?.role === "admin" ? "/employee" : "/login");
      } else if (nextProfile?.role !== "admin") {
        router.replace("/login");
      }
    });
  }, [pathname, router]);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
