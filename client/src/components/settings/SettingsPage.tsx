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
} from "lucide-react";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useSettings } from "../../hooks/useSettings";
import { fetchModels, checkEnvKeys, resolveEnvKey } from "../../services/api";
import type { OpenRouterModel, EnvKeysResponse, NewsSource } from "../../types";

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
  } = useSettings();

  const [jinaInput, setJinaInput] = useState(jinaKey);
  const [orInput, setOrInput] = useState(openRouterKey);
  const [avInput, setAvInput] = useState(alphaVantageKey);
  const [showJina, setShowJina] = useState(false);
  const [showOr, setShowOr] = useState(false);
  const [showAv, setShowAv] = useState(false);
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

  async function handleUseEnvKey(key: "openRouter" | "jina" | "alphaVantage") {
    setResolvingKey(key);
    try {
      const value = await resolveEnvKey(key);
      if (key === "openRouter") {
        setOrInput(value);
      } else if (key === "jina") {
        setJinaInput(value);
      } else if (key === "alphaVantage") {
        setAvInput(value);
      }
    } catch (err) {
      // silently fail — user can manually enter
    } finally {
      setResolvingKey(null);
    }
  }

  function handleSave() {
    setJinaKey(jinaInput.trim());
    setOpenRouterKey(orInput.trim());
    setAlphaVantageKey(avInput.trim());
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
      <Card>
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
      </Card>

      {/* OpenRouter API Key */}
      <Card>
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
      </Card>

      {/* Jina API Key */}
      <Card>
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
      </Card>

      {/* Alpha Vantage API Key */}
      <Card>
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
      </Card>

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
