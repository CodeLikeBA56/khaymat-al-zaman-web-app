"use client";

import { auth } from "@/lib/firebase";
import { useAppDispatch } from "@/store/hooks";
import type { UserDocument } from "@/types/user";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentRoleFromProfile } from "@/lib/employment";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { fetchUserDocumentById } from "@/store/employee/employee.service";
import { clearAuthSession, setAuthSession } from "@/store/auth/auth.reducer";

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  profile: UserDocument | null;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDocument | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        dispatch(clearAuthSession());
        if (pathname !== "/login") router.replace("/login");
        return;
      }

      try {
        const nextProfile = await fetchUserDocumentById(nextUser.uid);
        const currentRole = getCurrentRoleFromProfile(nextProfile);

        setProfile(nextProfile);
        setLoading(false);

        if (nextProfile && currentRole) {
          dispatch(
            setAuthSession({
              uid: nextProfile.uid,
              role: currentRole,
            }),
          );
        } else {
          dispatch(clearAuthSession());
        }

        if (pathname === "/login") {
          router.replace(currentRole === "admin" ? "/dashboard" : "/login");
        } else if (currentRole !== "admin") {
          await auth.signOut();
          router.replace("/login");
        }
      } catch {
        setProfile(null);
        setLoading(false);
        dispatch(clearAuthSession());
        if (pathname !== "/login") router.replace("/login");
      }
    });
  }, [dispatch, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
