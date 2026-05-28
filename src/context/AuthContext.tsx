"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getWhitelistEntry, isAdminEntry } from "@/lib/whitelist";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser?.email) {
          const entry = await getWhitelistEntry(firebaseUser.email);
          const admin = entry ? isAdminEntry(entry) : false;
          const role = admin ? "admin" : "user";
          await Promise.all([
            fetch("/api/auth/session", { method: "POST" }),
            fetch("/api/auth/role", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role }),
            }),
          ]);
          setIsAdmin(admin);
        } else {
          await Promise.all([
            fetch("/api/auth/session", { method: "DELETE" }),
            fetch("/api/auth/role", { method: "DELETE" }),
          ]);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("[AuthContext] onAuthStateChanged error:", err);
        setUser(firebaseUser);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    await Promise.all([
      fetch("/api/auth/session", { method: "DELETE" }),
      fetch("/api/auth/role", { method: "DELETE" }),
    ]);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
