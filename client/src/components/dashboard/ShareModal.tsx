import { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check, X, Lock, Clock, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";

interface ShareModalProps {
  runId: string;
  runData: unknown;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: "Never", value: "" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
];

function addDuration(duration: string): string {
  const now = new Date();
  if (duration === "24h") now.setHours(now.getHours() + 24);
  else if (duration === "7d") now.setDate(now.getDate() + 7);
  else if (duration === "30d") now.setDate(now.getDate() + 30);
  return now.toISOString();
}

export function ShareModal({ runId, runData, onClose }: ShareModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(false);

  const linkInputRef = useRef<HTMLInputElement>(null);

  const shareUrl = token ? `${window.location.origin}/share/${token}` : "";

  useEffect(() => {
    if (shareUrl && linkInputRef.current) {
      linkInputRef.current.select();
    }
  }, [shareUrl]);

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = { runId, runData };
      if (password) body.password = password;
      if (expiry) body.expiresAt = addDuration(expiry);

      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create share link");
      }

      const data = await res.json();
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!token) return;
    setRevoking(true);
    try {
      await fetch(`/api/share/${token}`, {
        method: "DELETE",
        credentials: "include",
      });
      setToken(null);
      setPassword("");
      setExpiry("");
    } catch {
      // ignore
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (linkInputRef.current) {
        linkInputRef.current.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
              <Share2 className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Share Analysis</h2>
              <p className="text-xs text-text-muted">Create a shareable link for this run</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {!token ? (
            <>
              {/* Password option */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                  <Lock className="w-3.5 h-3.5" />
                  Password protection
                  <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank for no password"
                    className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2
                      text-sm text-text-primary placeholder-text-muted pr-10
                      outline-none transition-all duration-200
                      focus:border-accent focus:ring-1 focus:ring-accent/30"
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
              </div>

              {/* Expiry option */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
                  <Clock className="w-3.5 h-3.5" />
                  Link expiration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiry(opt.value)}
                      className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all duration-200
                        ${expiry === opt.value
                          ? "bg-accent/10 border-accent/40 text-accent"
                          : "border-border text-text-muted hover:text-text-secondary hover:bg-surface-overlay"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-bearish bg-bearish/5 border border-bearish/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleCreate}
                disabled={creating}
                icon={creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              >
                {creating ? "Generating link..." : "Generate share link"}
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-bullish/30 bg-bullish/5 px-3 py-2.5">
                <p className="text-xs text-bullish font-medium">Link created successfully</p>
                {expiry && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Expires: {new Date(addDuration(expiry)).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                )}
                {password && (
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Password protected
                  </p>
                )}
              </div>

              {/* Link display + copy */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">Share link</label>
                <div className="flex gap-2">
                  <input
                    ref={linkInputRef}
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-lg border border-border bg-surface-overlay px-3 py-2
                      text-xs text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  />
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-200
                      ${copied
                        ? "bg-bullish/10 border-bullish/30 text-bullish"
                        : "border-border text-text-muted hover:text-text-secondary hover:bg-surface-overlay"
                      }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Revoke */}
              <div className="pt-1">
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="flex items-center gap-1.5 text-xs text-bearish/70 hover:text-bearish transition-colors disabled:opacity-50"
                >
                  {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Revoke this link
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
