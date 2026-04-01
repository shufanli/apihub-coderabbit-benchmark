"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "./api";

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await apiFetch("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || "/apihubcoderabbit"}/pricing`;
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
