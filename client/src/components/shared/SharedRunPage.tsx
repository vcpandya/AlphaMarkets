import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { TrendingUp, Lock, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/Button";
import { ReportTabs } from "../dashboard/ReportTabs";
import type { SavedRun } from "../../types";

export function SharedRunPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "password" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [run, setRun] = useState<SavedRun | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then((res) => {
        if (res.status === 404) throw new Error("This share link doesn't exist or has been revoked.");
        if (res.status === 410) throw new Error("This share link has expired.");
        if (!res.ok) throw new Error("Failed to load shared run.");
        return res.json();
      })
      .then((data) => {
        setExpiresAt(data.expiresAt ?? null);
        if (data.passwordRequired) {
          setStatus("password");
        } else {
          setRun(data.run as SavedRun);
          setStatus("ready");
        }
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      });
  }, [token]);

  async function handleVerify() {
    if (!token) return;
    setVerifying(true);
    setWrongPassword(false);
    try {
      const res = await fetch(`/api/share/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 401) {
        setWrongPassword(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to verify password.");
      const data = await res.json();
      setRun(data.run as SavedRun);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      {/* Top bar */}
      <div className="border-b border-border bg-surface-raised px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <span className="text-sm font-bold text-text-primary tracking-tight">AlphaMarkets</span>
              <span className="ml-2 text-xs text-text-muted">Shared Analysis</span>
            </div>
          </div>
          {expiresAt && (
            <p className="text-xs text-text-muted">
              Expires {new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-text-muted">Loading shared analysis...</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-bearish/10">
              <AlertCircle className="w-6 h-6 text-bearish" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-text-primary">Unable to load analysis</p>
              <p className="text-sm text-text-muted mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {status === "password" && (
          <div className="flex flex-col items-center gap-6 py-24">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10">
              <Lock className="w-7 h-7 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-text-primary">Password required</p>
              <p className="text-sm text-text-muted mt-1">This analysis is protected. Enter the password to view it.</p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="Enter password"
                  className={`w-full rounded-lg border bg-surface-overlay px-3 py-2.5
                    text-sm text-text-primary placeholder-text-muted pr-10
                    outline-none transition-all duration-200
                    focus:border-accent focus:ring-1 focus:ring-accent/30
                    ${wrongPassword ? "border-bearish focus:border-bearish focus:ring-bearish/30" : "border-border"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {wrongPassword && (
                <p className="text-xs text-bearish">Incorrect password. Please try again.</p>
              )}
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleVerify}
                disabled={verifying || !password}
                icon={verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              >
                {verifying ? "Verifying..." : "Unlock analysis"}
              </Button>
            </div>
          </div>
        )}

        {status === "ready" && run && (
          <div className="space-y-4">
            {/* Run metadata */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-text-muted">
                {new Date(run.timestamp).toLocaleDateString(undefined, {
                  month: "long", day: "numeric", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              {(run.tags || []).map((tag, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent/80 border border-accent/20"
                >
                  {tag}
                </span>
              ))}
              {(run.markets || []).map((m) => (
                <span key={m} className="text-xs text-text-muted border border-border rounded-full px-2 py-0.5">
                  {m}
                </span>
              ))}
            </div>

            <ReportTabs
              results={run.results}
              markets={run.markets}
              openRouterKey=""
              selectedModel=""
            />
          </div>
        )}
      </div>
    </div>
  );
}
