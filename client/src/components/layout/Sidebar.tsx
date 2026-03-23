import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Settings, TrendingUp, X, Trash2, History, Shield, LogOut, BarChart2, ChevronRight } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useSavedRuns } from "../../hooks/useSavedRuns";
import { useAuth } from "../../contexts/AuthContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const BASE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Today · ${timeStr}`;
  if (diffDays === 1) return `Yesterday · ${timeStr}`;
  if (diffDays < 7) return `${diffDays}d ago · ${timeStr}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` · ${timeStr}`;
}

const MARKET_COLORS: Record<string, string> = {
  Global: "text-blue-400 bg-blue-400/10",
  US: "text-emerald-400 bg-emerald-400/10",
  EU: "text-violet-400 bg-violet-400/10",
  Asia: "text-amber-400 bg-amber-400/10",
  MENA: "text-orange-400 bg-orange-400/10",
};

function MarketBadge({ market }: { market: string }) {
  const cls = MARKET_COLORS[market] || "text-text-muted bg-surface-overlay";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide border border-current/20 ${cls}`}>
      {market}
    </span>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { jinaKey, openRouterKey, alphaVantageKey } = useSettings();
  const { runs, deleteRun } = useSavedRuns();
  const { user, authRequired, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = user?.role === "admin"
    ? [...BASE_NAV, { to: "/admin", label: "Admin", icon: Shield }]
    : BASE_NAV;

  const jinaOk = Boolean(jinaKey);
  const orOk = Boolean(openRouterKey);
  const avOk = Boolean(alphaVantageKey);

  const displayedRuns = runs.slice(0, 6);
  const hasMore = runs.length > 6;

  function handleLoadRun(id: string) {
    navigate(`/?run=${id}`);
    onClose();
  }

  function handleDeleteRun(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteRun(id);
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[280px] flex-shrink-0
          bg-surface-raised border-r border-border
          flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-base font-bold text-text-primary tracking-tight">
                AlphaMarkets
              </h1>
              <p className="text-[10px] text-text-muted uppercase tracking-widest">
                Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group relative
                ${isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r" />
                  )}
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Saved Runs */}
        {runs.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-0 border-t border-border">
            <div className="px-4 pt-4 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">
                  Recent Runs
                </span>
              </div>
              <span className="text-[10px] font-medium text-text-muted bg-surface-overlay border border-border rounded-full px-1.5 py-0.5 leading-none">
                {runs.length}
              </span>
            </div>

            <div className="px-2 py-2 space-y-1.5">
              {displayedRuns.map((run) => {
                const primaryTags = (run.tags || []).slice(0, 2);
                const extraTags = (run.tags || []).length - 2;
                const markets = run.markets || [];

                return (
                  <button
                    key={run.id}
                    onClick={() => handleLoadRun(run.id)}
                    className="w-full text-left px-3 py-3 rounded-xl
                      border border-transparent
                      hover:border-border hover:bg-surface-overlay
                      transition-all duration-200 group relative"
                  >
                    {/* Tags (primary content) */}
                    {primaryTags.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap mb-2 pr-6">
                        {primaryTags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs font-medium text-text-primary leading-tight"
                          >
                            {i > 0 && <span className="text-text-muted mx-1">·</span>}
                            {tag}
                          </span>
                        ))}
                        {extraTags > 0 && (
                          <span className="text-[10px] text-text-muted">+{extraTags}</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-text-muted mb-2 pr-6 italic">
                        Untitled run
                      </p>
                    )}

                    {/* Metadata row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        {/* Markets */}
                        {markets.slice(0, 2).map((m) => (
                          <MarketBadge key={m} market={m} />
                        ))}
                        {/* Stock count */}
                        {run.stockCount != null && run.stockCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-text-muted">
                            <BarChart2 className="w-2.5 h-2.5" />
                            {run.stockCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <p className="text-[10px] text-text-muted mt-1.5">
                      {formatRelativeDate(run.timestamp)}
                    </p>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteRun(e, run.id)}
                      className="absolute top-2.5 right-2.5 p-1 rounded-md
                        opacity-0 group-hover:opacity-100
                        text-text-muted hover:text-bearish hover:bg-bearish/10
                        transition-all duration-150"
                      title="Delete run"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Arrow hint */}
                    <ChevronRight className="absolute bottom-3 right-3 w-3 h-3 text-text-muted/40
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <button
                onClick={() => {
                  navigate("/");
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-1.5
                  text-[11px] text-accent hover:text-accent/80
                  py-2 mx-auto transition-colors"
              >
                View all {runs.length} runs
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* User info + Logout */}
        {authRequired && user && (
          <div className="px-4 py-3 border-t border-border mt-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                  user.role === "admin" ? "bg-accent/10" : "bg-surface"
                }`}>
                  {user.role === "admin" ? (
                    <Shield className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <span className="text-xs font-medium text-text-muted">
                      {(user.displayName || user.username)[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{user.displayName || user.username}</p>
                  <p className="text-[10px] text-text-muted">{user.role}</p>
                </div>
              </div>
              <button
                onClick={async () => { await logout(); }}
                className="p-1.5 rounded-lg text-text-muted hover:text-bearish hover:bg-bearish/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* API key status */}
        <div className={`px-4 py-4 border-t border-border ${!authRequired || !user ? "mt-auto" : ""}`}>
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">
            API Status
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span
                className={`w-2 h-2 rounded-full ${jinaOk ? "bg-bullish" : "bg-bearish"}`}
              />
              Jina Search
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span
                className={`w-2 h-2 rounded-full ${orOk ? "bg-bullish" : "bg-bearish"}`}
              />
              OpenRouter
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span
                className={`w-2 h-2 rounded-full ${avOk ? "bg-bullish" : "bg-text-muted/30"}`}
              />
              Alpha Vantage
              {!avOk && (
                <span className="text-[10px] text-text-muted">(optional)</span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
