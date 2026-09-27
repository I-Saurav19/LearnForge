"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Credentials {
  email: string;
  password: string;
}

interface Registration extends Credentials {
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  register: (details: Registration) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => { void refreshUser(); }, 0);
    return () => window.clearTimeout(task);
  }, [refreshUser]);

  const login = useCallback(async (credentials: Credentials) => {
    const data = await apiRequest<{ user: AuthUser }>("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
    setUser(data.user);
  }, []);

  const register = useCallback(async (details: Registration) => {
    const data = await apiRequest<{ user: AuthUser }>("/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading, login, register, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
