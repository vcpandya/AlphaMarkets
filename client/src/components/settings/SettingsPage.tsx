import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Check,
  Key,
  Bot,
  Search,
  Terminal,
  TrendingUp,
  Radio,
  CheckCircle2,
  XCircle,
  Database,
  Mail,
  Clock,
  Plus,
  Trash2,
  Power,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useSettings } from "../../hooks/useSettings";
import { useAuth } from "../../contexts/AuthContext";
import { fetchModels, checkEnvKeys, resolveEnvKey } from "../../services/api";
import type {
  OpenRouterModel,
  EnvKeysResponse,
  NewsSource,
  StorageBackend,
  ScheduleConfig,
  ScheduleFrequency,
  MarketRegion,
  AnalysisModules,
} from "../../types";

export function SettingsPage() {
  const {
    jinaKey,
    openRouterKey,
    alphaVantageKey,
    selectedModel,
    newsSource,
    setJinaKey,
    setOpenRouterKey,
    setAlphaVantageKey,
    setSelectedModel,
    setNewsSource,
    agentMailKey,
    setAgentMailKey,
    storageBackend,
    sqliteAvailable,
    setStorageBackend,
  } = useSettings();
  const { byok, authRequired } = useAuth();

  // In server mode with BYOK off, keys come from server env vars
  const usingServerKeys = authRequired && !byok;

  const [jinaInput, setJinaInput] = useState(jinaKey);
  const [orInput, setOrInput] = useState(openRouterKey);
  const [avInput, setAvInput] = useState(alphaVantageKey);
  const [amInput, setAmInput] = useState(agentMailKey);
  const [showJina, setShowJina] = useState(false);
  const [showOr, setShowOr] = useState(false);
  const [showAv, setShowAv] = useState(false);
  const [showAm, setShowAm] = useState(false);

  // Schedule state
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    tags: "global markets, tech AI",
    markets: ["Global"] as MarketRegion[],
    location: "",
    modules: { qa: true, stocks: true, graph: false, causechain: false } as AnalysisModules,
    stockCount: undefined as number | undefined,
    frequency: "daily" as ScheduleFrequency,
    time: "08:00",
    dayOfWeek: 1,
    dayOfMonth: 1,
    emailTo: "",
  });
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Env key detection state
  const [envKeys, setEnvKeys] = useState<EnvKeysResponse | null>(null);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);

  const loadModels = useCallback(async (key: string) => {
    if (!key) return;
    setLoadingModels(true);
    setModelError(null);
    try {
      const m = await fetchModels(key);
      setModels(m);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (openRouterKey) {
      loadModels(openRouterKey);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDetectEnv() {
    setEnvLoading(true);
    setEnvError(null);
    try {
      const result = await checkEnvKeys();
      setEnvKeys(result);
    } catch (err) {
      setEnvError(err instanceof Error ? err.message : "Failed to detect env variables");
    } finally {
      setEnvLoading(false);
    }
  }

  async function handleUseEnvKey(key: "openRouter" | "jina" | "alphaVantage" | "agentMail") {
    setResolvingKey(key);
    try {
      const value = await resolveEnvKey(key);
      if (key === "openRouter") {
        setOrInput(value);
      } else if (key === "jina") {
        setJinaInput(value);
      } else if (key === "alphaVantage") {
        setAvInput(value);
      } else if (key === "agentMail") {
        setAmInput(value);
      }
    } catch {
      // silently fail — user can manually enter
    } finally {
      setResolvingKey(null);
    }
  }

  // Load schedules
  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    try {
      const res = await fetch("/api/storage/schedules", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch { /* server may not have sqlite */ }
    finally { setSchedulesLoading(false); }
  }, []);

  useEffect(() => {
    if (sqliteAvailable) loadSchedules();
  }, [sqliteAvailable, loadSchedules]);

  async function handleCreateSchedule() {
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const schedule: ScheduleConfig = {
      id,
      name: newSchedule.name || `Schedule ${schedules.length + 1}`,
      tags: newSchedule.tags.split(",").map((t) => t.trim()).filter(Boolean),
      markets: newSchedule.markets,
      location: newSchedule.location,
      modules: newSchedule.modules,
      stockCount: newSchedule.stockCount,
      frequency: newSchedule.frequency,
      time: newSchedule.time,
      dayOfWeek: newSchedule.frequency === "weekly" ? newSchedule.dayOfWeek : undefined,
      dayOfMonth: newSchedule.frequency === "monthly" ? newSchedule.dayOfMonth : undefined,
      emailTo: newSchedule.emailTo,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/storage/schedules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (res.ok) {
        const data = await res.json();
        setSchedules((prev) => [...prev, data.schedule || schedule]);
        setShowNewSchedule(false);
        setNewSchedule({
          name: "", tags: "global markets, tech AI", markets: ["Global"],
          location: "", modules: { qa: true, stocks: true, graph: false, causechain: false },
          stockCount: undefined, frequency: "daily", time: "08:00",
          dayOfWeek: 1, dayOfMonth: 1, emailTo: "",
        });
      }
    } catch { /* ignore */ }
  }

  async function handleDeleteSchedule(id: string) {
    await fetch(`/api/storage/schedules/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleToggleSchedule(id: string) {
    const res = await fetch(`/api/storage/schedules/${encodeURIComponent(id)}/toggle`, { method: "POST", credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setSchedules((prev) => prev.map((s) => s.id === id ? data.schedule : s));
    }
  }

  function handleSave() {
    setJinaKey(jinaInput.trim());
    setOpenRouterKey(orInput.trim());
    setAlphaVantageKey(avInput.trim());
    setAgentMailKey(amInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    if (orInput.trim() && orInput.trim() !== openRouterKey) {
      loadModels(orInput.trim());
    }
  }

  const NEWS_SOURCE_OPTIONS: {
    value: NewsSource;
    title: string;
    description: string;
  }[] = [
    {
      value: "jina",
      title: "Jina Search",
      description: "General news search across the web",
    },
    {
      value: "alphavantage",
      title: "Alpha Vantage",
      description: "Financial news with sentiment analysis",
    },
    {
      value: "both",
      title: "Both Sources",
      description: "Combine results from Jina + Alpha Vantage",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Auto-detect Environment Variables */}
      {(byok || !authRequired) && <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Terminal className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Auto-detect Environment Variables
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Check if API keys are available as environment variables on the server.
            </p>
          </div>
        </div>

        <Button
          onClick={handleDetectEnv}
          disabled={envLoading}
          size="sm"
          className="mb-4"
        >
          {envLoading ? (
            <>
              <Spinner size="sm" /> Detecting...
            </>
          ) : (
            "Detect Env Variables"
          )}
        </Button>

        {envError && (
          <p className="text-sm text-bearish mb-3">{envError}</p>
        )}

        {envKeys && (
          <div className="space-y-2.5">
            {(
              [
                { key: "openRouter" as const, label: "OpenRouter" },
                { key: "jina" as const, label: "Jina" },
                { key: "alphaVantage" as const, label: "Alpha Vantage" },
                { key: "agentMail" as const, label: "AgentMail" },
              ] as const
            ).map(({ key, label }) => {
              const status = envKeys[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-overlay px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    {status.found ? (
                      <CheckCircle2 className="w-4 h-4 text-bullish shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-bearish shrink-0" />
                    )}
                    <div>
                      <span className="text-sm text-text-primary font-medium">
                        {label}
                      </span>
                      {status.found && status.preview && (
                        <span className="ml-2 text-xs text-text-muted font-mono">
                          {status.preview}
                        </span>
                      )}
                    </div>
                  </div>
                  {status.found && (
                    <button
                      type="button"
                      onClick={() => handleUseEnvKey(key)}
                      disabled={resolvingKey === key}
                      className="text-xs font-medium text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                    >
                      {resolvingKey === key ? "Loading..." : "Use"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>}

      {/* Server Keys Banner */}
      {usingServerKeys && (
        <div className="rounded-lg border border-bullish/30 bg-bullish/5 px-4 py-3">
          <p className="text-sm text-bullish font-medium">Using Server API Keys</p>
          <p className="text-xs text-text-muted mt-0.5">
            Your admin has enabled shared server-side API keys. You don't need to enter your own.
          </p>
        </div>
      )}

      {/* OpenRouter API Key */}
      {(byok || !authRequired) && <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              OpenRouter API Key
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Powers LLM analysis for reports, stock recommendations, and graph generation.
              Get your key at{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>
        </div>
        <div className="relative">
          <Input
            type={showOr ? "text" : "password"}
            placeholder="sk-or-v1-..."
            value={orInput}
            onChange={(e) => setOrInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowOr(!showOr)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            {showOr ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Card>}

      {/* Jina API Key */}
      {(byok || !authRequired) && <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Search className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Jina API Key
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Powers real-time news search and article retrieval.
              Get your key at{" "}
              <a
                href="https://jina.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                jina.ai
              </a>
            </p>
          </div>
        </div>
        <div className="relative">
          <Input
            type={showJina ? "text" : "password"}
            placeholder="jina_..."
            value={jinaInput}
            onChange={(e) => setJinaInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowJina(!showJina)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            {showJina ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Card>}

      {/* Alpha Vantage API Key */}
      {(byok || !authRequired) && <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">
                Alpha Vantage API Key
              </h3>
              <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent uppercase tracking-wide">
                Optional &mdash; Finance News
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Provides financial news with built-in sentiment analysis.
              Get free key at{" "}
              <a
                href="https://www.alphavantage.co/support/#api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                alphavantage.co
              </a>
            </p>
          </div>
        </div>
        <div className="relative">
          <Input
            type={showAv ? "text" : "password"}
            placeholder="Your Alpha Vantage API key..."
            value={avInput}
            onChange={(e) => setAvInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowAv(!showAv)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            {showAv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Card>}

      {/* News Source Selector */}
      <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Radio className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              News Source
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Choose where to fetch news articles for market analysis.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {NEWS_SOURCE_OPTIONS.map((option) => {
            const isSelected = newsSource === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setNewsSource(option.value)}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200
                  ${
                    isSelected
                      ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                      : "border-border bg-surface-overlay hover:border-text-muted/30 hover:bg-surface-overlay/80"
                  }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${isSelected ? "border-accent" : "border-text-muted/40"}`}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-accent" : "text-text-primary"
                    }`}
                  >
                    {option.title}
                  </span>
                  <p className="text-xs text-text-muted mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Storage Backend */}
      <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Database className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Storage Backend
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Choose where to persist analysis data. SQLite is recommended for server deployments (EC2, etc.).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {([
            {
              value: "indexeddb" as StorageBackend,
              title: "IndexedDB (Browser)",
              description: "Data stored locally in your browser. Best for personal / local use.",
              available: true,
            },
            {
              value: "sqlite" as StorageBackend,
              title: "SQLite (Server)",
              description: sqliteAvailable
                ? "Data stored on the server in a SQLite database. Best for EC2 / shared deployments."
                : "Server-side SQLite not detected. Make sure the server has better-sqlite3 installed.",
              available: sqliteAvailable,
            },
          ]).map((option) => {
            const isSelected = storageBackend === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => option.available && setStorageBackend(option.value)}
                disabled={!option.available}
                className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200
                  ${!option.available
                    ? "border-border bg-surface-overlay/50 opacity-60 cursor-not-allowed"
                    : isSelected
                      ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                      : "border-border bg-surface-overlay hover:border-text-muted/30 hover:bg-surface-overlay/80"
                  }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${isSelected ? "border-accent" : "border-text-muted/40"}`}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-accent" : "text-text-primary"
                    }`}
                  >
                    {option.title}
                  </span>
                  {option.value === "sqlite" && sqliteAvailable && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-bullish/10 px-1.5 py-0.5 text-[10px] font-medium text-bullish">
                      Available
                    </span>
                  )}
                  <p className="text-xs text-text-muted mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* AgentMail API Key */}
      {(byok || !authRequired) && <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">
                AgentMail API Key
              </h3>
              <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent uppercase tracking-wide">
                Optional &mdash; Email Reports
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Send scheduled analysis reports via email.
              Get your key at{" "}
              <a
                href="https://agentmail.to"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                agentmail.to
              </a>
            </p>
          </div>
        </div>
        <div className="relative">
          <Input
            type={showAm ? "text" : "password"}
            placeholder="Your AgentMail API key..."
            value={amInput}
            onChange={(e) => setAmInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowAm(!showAm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            {showAm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Card>}

      {/* Scheduled Analysis */}
      {sqliteAvailable && (
        <Card>
          <div className="flex items-start gap-4 mb-5">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text-primary">
                Scheduled Analysis
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Automatically run analyses on a schedule and receive email reports.
                Requires SQLite backend and API keys configured as environment variables on the server.
              </p>
            </div>
          </div>

          {/* Existing schedules */}
          {schedulesLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner size="sm" /> Loading schedules...
            </div>
          ) : schedules.length > 0 ? (
            <div className="space-y-2 mb-4">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                    s.enabled
                      ? "border-border bg-surface-overlay"
                      : "border-border/50 bg-surface-overlay/50 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{s.name}</span>
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        s.enabled ? "bg-bullish/10 text-bullish" : "bg-text-muted/10 text-text-muted"
                      }`}>
                        {s.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {s.frequency} at {s.time}
                      {s.frequency === "weekly" && ` (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.dayOfWeek ?? 1]})`}
                      {s.frequency === "monthly" && ` (day ${s.dayOfMonth})`}
                      {" | "}{s.tags.slice(0, 3).join(", ")}
                      {" | "}{s.emailTo}
                      {s.nextRun && (
                        <span className="ml-2 text-accent">
                          Next: {new Date(s.nextRun).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSchedule(s.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        s.enabled ? "text-bullish hover:bg-bullish/10" : "text-text-muted hover:bg-surface-overlay"
                      }`}
                      title={s.enabled ? "Pause" : "Enable"}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSchedule(s.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-bearish hover:bg-bearish/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted mb-4">No scheduled analyses yet.</p>
          )}

          {/* New schedule form */}
          {showNewSchedule ? (
            <div className="space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Schedule Name"
                  placeholder="e.g., Morning Briefing"
                  value={newSchedule.name}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, name: e.target.value }))}
                />
                <Input
                  label="Email To"
                  type="email"
                  placeholder="you@example.com"
                  value={newSchedule.emailTo}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, emailTo: e.target.value }))}
                />
              </div>
              <Input
                label="Topics (comma-separated)"
                placeholder="global markets, oil energy, tech AI"
                value={newSchedule.tags}
                onChange={(e) => setNewSchedule((p) => ({ ...p, tags: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Frequency</label>
                  <select
                    value={newSchedule.frequency}
                    onChange={(e) => setNewSchedule((p) => ({ ...p, frequency: e.target.value as ScheduleFrequency }))}
                    className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Time (UTC)</label>
                  <input
                    type="time"
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule((p) => ({ ...p, time: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  />
                </div>
                {newSchedule.frequency === "weekly" && (
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">Day</label>
                    <select
                      value={newSchedule.dayOfWeek}
                      onChange={(e) => setNewSchedule((p) => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                    >
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                        <option key={d} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {newSchedule.frequency === "monthly" && (
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">Day of Month</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={newSchedule.dayOfMonth}
                      onChange={(e) => setNewSchedule((p) => ({ ...p, dayOfMonth: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                )}
              </div>

              {/* Module checkboxes */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">Modules</label>
                <div className="flex gap-3 flex-wrap">
                  {([
                    { key: "qa" as const, label: "Expert Q&A" },
                    { key: "stocks" as const, label: "Stock Picks" },
                    { key: "graph" as const, label: "Impact Graph" },
                    { key: "causechain" as const, label: "Cause Chain" },
                  ]).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newSchedule.modules[key]}
                        onChange={() => setNewSchedule((p) => ({
                          ...p,
                          modules: { ...p.modules, [key]: !p.modules[key] },
                        }))}
                        className="w-3.5 h-3.5 rounded border-border accent-[var(--color-accent,#6366f1)]"
                      />
                      <span className="text-xs text-text-secondary">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Markets */}
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">Markets</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(["US", "India", "Europe", "Asia", "Global"] as MarketRegion[]).map((m) => {
                    const selected = newSchedule.markets.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewSchedule((p) => ({
                          ...p,
                          markets: selected
                            ? p.markets.length > 1 ? p.markets.filter((x) => x !== m) : p.markets
                            : [...p.markets, m],
                        }))}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          selected
                            ? "bg-accent text-white border-accent"
                            : "bg-surface-overlay text-text-muted border-border hover:border-text-muted/30"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleCreateSchedule}
                  disabled={!newSchedule.emailTo.trim()}
                >
                  Create Schedule
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowNewSchedule(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowNewSchedule(true)}
            >
              New Schedule
            </Button>
          )}
        </Card>
      )}

      {/* Model Selector */}
      <Card>
        <div className="flex items-start gap-4 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
            <Key className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Model Selection
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Choose the LLM model for analysis. Save your OpenRouter key first
              to load available models.
            </p>
          </div>
        </div>

        {loadingModels ? (
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <Spinner size="sm" />
            Loading models...
          </div>
        ) : modelError ? (
          <p className="text-sm text-bearish">{modelError}</p>
        ) : models.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-overlay px-3 py-2
              text-sm text-text-primary outline-none transition-all duration-200
              focus:border-accent focus:ring-1 focus:ring-accent/30"
          >
            <option value="">Select a model...</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({(m.contextLength / 1000).toFixed(0)}k ctx)
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-text-muted">
            Save your OpenRouter API key to load available models.
          </p>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} size="lg">
          {saved ? (
            <>
              <Check className="w-4 h-4" /> Saved
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
        {saved && (
          <span className="text-sm text-bullish animate-pulse">
            Settings saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
