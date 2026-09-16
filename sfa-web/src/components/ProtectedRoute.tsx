import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-ink-soft text-sm">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
