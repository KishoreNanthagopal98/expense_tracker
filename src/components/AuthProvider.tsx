"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import AuthModal from "@/components/AuthModal";
import type { SessionUser } from "@/lib/auth-client";

type AuthContextValue = {
  user: SessionUser | null;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  if (checking) {
    return (
      <AuthContext.Provider value={{ user: null, logout }}>
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">Loading…</div>
      </AuthContext.Provider>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={{ user: null, logout }}>
        <AuthModal onAuthenticated={setUser} />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
