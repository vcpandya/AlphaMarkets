import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash2, Shield, User, Key, Settings2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useAuth } from "../../contexts/AuthContext";
import type { ManagedUser } from "../../types";

export function AdminPage() {
  const { user, refreshUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ username: "", password: "", displayName: "", role: "user" as "admin" | "user" });
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Server settings
  const [byok, setByok] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/server-settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setByok(data.settings?.byok === "true");
      }
    } catch { /* ignore */ }
    finally { setSettingsLoading(false); }
  }, []);

  useEffect(() => {
    loadUsers();
    loadSettings();
  }, [loadUsers, loadSettings]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteLoading(true);

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(inviteForm),
      });

      if (!res.ok) {
        const data = await res.json();
        setInviteError(data.error || "Failed to invite user");
        return;
      }

      setShowInvite(false);
      setInviteForm({ username: "", password: "", displayName: "", role: "user" });
      loadUsers();
    } catch {
      setInviteError("Server error");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (id === user?.id) return;
    try {
      await fetch(`/api/auth/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      loadUsers();
    } catch { /* ignore */ }
  }

  async function handleToggleByok() {
    const newVal = !byok;
    try {
      await fetch("/api/auth/server-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: "byok", value: String(newVal) }),
      });
      setByok(newVal);
      refreshUser();
    } catch { /* ignore */ }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (pwForm.new !== pwForm.confirm) {
      setPwError("New passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPwError(data.error || "Failed to change password");
        return;
      }

      setPwSuccess(true);
      setPwForm({ current: "", new: "", confirm: "" });
      setTimeout(() => { setPwSuccess(false); setShowPasswordChange(false); }, 2000);
    } catch {
      setPwError("Server error");
    }
  }

  if (user?.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <p className="text-sm text-text-muted">Admin access required.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Server Configuration */}
      <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Settings2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Server Configuration</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Control how users interact with the platform.
            </p>
          </div>
        </div>

        {settingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted"><Spinner size="sm" /> Loading...</div>
        ) : (
          <div className="space-y-3">
            {/* Server Keys toggle — OFF by default, admin opts in */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-overlay px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Share Server API Keys</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {byok
                    ? "Off — users must provide their own API keys (default)."
                    : "On — all users share the server's API keys (from environment variables). Users won't see key fields in Settings."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleByok}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  !byok ? "bg-accent" : "bg-text-muted/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    !byok ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* User Management */}
      <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text-primary">User Management</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Invite users and manage access. Only admins can add new users.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted"><Spinner size="sm" /> Loading users...</div>
        ) : (
          <div className="space-y-2 mb-4">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-overlay px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    u.role === "admin" ? "bg-accent/10" : "bg-surface"
                  }`}>
                    {u.role === "admin" ? (
                      <Shield className="w-4 h-4 text-accent" />
                    ) : (
                      <User className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{u.displayName || u.username}</span>
                      <span className="text-[10px] font-mono text-text-muted">@{u.username}</span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        u.role === "admin" ? "bg-accent/10 text-accent" : "bg-surface text-text-muted"
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      {u.lastLogin
                        ? `Last login: ${new Date(u.lastLogin).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : "Never logged in"}
                    </p>
                  </div>
                </div>

                {u.id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(u.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-bearish hover:bg-bearish/10 transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Invite form */}
        {showInvite ? (
          <form onSubmit={handleInvite} className="space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Username"
                placeholder="johndoe"
                value={inviteForm.username}
                onChange={(e) => setInviteForm((p) => ({ ...p, username: e.target.value }))}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Min 6 characters"
                value={inviteForm.password}
                onChange={(e) => setInviteForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Display Name"
                placeholder="John Doe (optional)"
                value={inviteForm.displayName}
                onChange={(e) => setInviteForm((p) => ({ ...p, displayName: e.target.value }))}
              />
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as "admin" | "user" }))}
                  className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {inviteError && (
              <p className="text-sm text-bearish">{inviteError}</p>
            )}

            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={inviteLoading || !inviteForm.username || !inviteForm.password}>
                {inviteLoading ? "Creating..." : "Create User"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setShowInvite(true)}
          >
            Invite User
          </Button>
        )}
      </Card>

      {/* Change Password */}
      <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Key className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Change Password</h3>
            <p className="text-xs text-text-muted mt-0.5">Update your admin password.</p>
          </div>
        </div>

        {showPasswordChange ? (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <Input
              label="Current Password"
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="New Password"
                type="password"
                value={pwForm.new}
                onChange={(e) => setPwForm((p) => ({ ...p, new: e.target.value }))}
              />
              <Input
                label="Confirm"
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            {pwError && <p className="text-sm text-bearish">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-bullish">Password changed successfully</p>}
            <div className="flex gap-2">
              <Button size="sm" type="submit">Update Password</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowPasswordChange(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setShowPasswordChange(true)}>
            Change Password
          </Button>
        )}
      </Card>
    </div>
  );
}
