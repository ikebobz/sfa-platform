import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiClientError } from "../api/client";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-serif text-2xl text-ink">Territory Ledger</div>
          <div className="text-[13px] text-ink-soft mt-1">Sign in to your sales force account</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel border border-border rounded p-6">
          <label className="block text-xs text-ink-soft mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-ink"
            placeholder="you@example.com"
          />

          <label className="block text-xs text-ink-soft mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-1 focus:ring-ink"
            placeholder="••••••••"
          />

          {error && <p className="text-[12.5px] text-poor mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink text-white text-sm py-2.5 rounded hover:bg-ink/90 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
