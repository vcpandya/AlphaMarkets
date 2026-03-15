import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error || "Login failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">AlphaMarkets</h1>
          <p className="text-sm text-text-muted mt-1">Market Intelligence Platform</p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-border bg-surface-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary mb-4">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2
                  text-sm text-text-primary outline-none placeholder:text-text-muted/50
                  focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2
                  text-sm text-text-primary outline-none placeholder:text-text-muted/50
                  focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
            </div>

            {error && (
              <p className="text-sm text-bearish bg-bearish/5 border border-bearish/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white
                hover:bg-accent/90 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-[11px] text-text-muted mt-4 text-center">
            Contact your administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
