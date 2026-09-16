import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiRequest } from "../api/client";

export type Role = "rep" | "rsm" | "nsm" | "admin";

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  territory_id: number | null;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("sfa_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    apiRequest<CurrentUser>("/auth/me")
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("sfa_access_token");
        localStorage.removeItem("sfa_refresh_token");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: CurrentUser;
    }>("/auth/login", { method: "POST", body: { email, password } });

    localStorage.setItem("sfa_access_token", result.accessToken);
    localStorage.setItem("sfa_refresh_token", result.refreshToken);
    setUser(result.user);
  }

  function logout() {
    localStorage.removeItem("sfa_access_token");
    localStorage.removeItem("sfa_refresh_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
