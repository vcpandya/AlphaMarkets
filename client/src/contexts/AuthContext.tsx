import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { AppUser } from "../types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  authRequired: boolean;
  byok: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  authRequired: false,
  byok: false,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [byok, setByok] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      // First check if auth is required
      const statusRes = await fetch("/api/auth/status", { credentials: "include" });
      if (statusRes.ok) {
        const status = await statusRes.json();
        setAuthRequired(status.authRequired);

        if (!status.authRequired) {
          // Browser-only mode: no auth needed
          setLoading(false);
          return;
        }
      }

      // Try to get current user from cookie
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setByok(data.settings?.byok ?? false);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      // Server might not be available
      setAuthRequired(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { ok: false, error: data.error || "Login failed" };
      }

      const data = await res.json();
      setUser(data.user);
      // Refresh to get settings
      await refreshUser();
      return { ok: true };
    } catch {
      return { ok: false, error: "Server unavailable" };
    }
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch { /* ignore */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authRequired, byok, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
