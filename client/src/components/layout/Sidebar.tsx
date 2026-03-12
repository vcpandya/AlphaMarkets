import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Settings, TrendingUp, X, Trash2, Clock } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useSavedRuns } from "../../hooks/useSavedRuns";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { jinaKey, openRouterKey, alphaVantageKey } = useSettings();
  const { runs, deleteRun } = useSavedRuns();
  const navigate = useNavigate();

  const jinaOk = Boolean(jinaKey);
  const orOk = Boolean(openRouterKey);
  const avOk = Boolean(alphaVantageKey);

  const displayedRuns = runs.slice(0, 5);
  const hasMore = runs.length > 5;

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
          <div className="px-3 flex-1 overflow-y-auto">
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 px-3 mb-2">
                <Clock className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">
                  Saved Runs
                </span>
              </div>

              <div className="space-y-0.5">
                {displayedRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => handleLoadRun(run.id)}
                    className="w-full text-left px-3 py-2 rounded-lg
                      hover:bg-surface-overlay transition-colors group relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">
                        {formatDate(run.timestamp)}
                      </span>
                      <button
                        onClick={(e) => handleDeleteRun(e, run.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-bearish transition-all"
                        title="Delete run"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {run.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="inline-block rounded-full bg-accent/10 px-1.5 py-0 text-[9px] text-accent/80 border border-accent/20"
                        >
                          {tag}
                        </span>
                      ))}
                      {run.tags.length > 3 && (
                        <span className="text-[9px] text-text-muted">
                          +{run.tags.length - 3}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {run.markets.map((m) => (
                        <span
                          key={m}
                          className="text-[9px] text-text-muted"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={() => {
                    navigate("/");
                    onClose();
                  }}
                  className="w-full text-center text-[10px] text-accent hover:text-accent/80 py-2 transition-colors"
                >
                  View all ({runs.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* API key status */}
        <div className="px-4 py-4 border-t border-border mt-auto">
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
