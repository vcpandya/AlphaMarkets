import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, CheckCircle } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useAnalysis } from "../../hooks/useAnalysis";
import { useSavedRuns } from "../../hooks/useSavedRuns";
import { AnalysisForm } from "./AnalysisForm";
import { ProgressOverlay } from "./ProgressOverlay";
import { ReportTabs } from "./ReportTabs";
import { Button } from "../ui/Button";
import type { MarketRegion, ManualSources, AnalysisResults, SavedRun } from "../../types";
import { useChatContext } from "../../contexts/ChatContext";

export function Dashboard() {
  const {
    jinaKey,
    openRouterKey,
    alphaVantageKey,
    selectedModel,
    newsSource,
    hasKeys,
  } = useSettings();
  const { results, progress, error, runAnalysis } = useAnalysis(
    jinaKey,
    openRouterKey,
    selectedModel,
    alphaVantageKey,
    newsSource,
  );
  const { saveRun, getRun } = useSavedRuns();
  const [searchParams] = useSearchParams();

  const [hasRun, setHasRun] = useState(false);
  const [lastTags, setLastTags] = useState<string[]>([]);
  const [lastMarkets, setLastMarkets] = useState<MarketRegion[]>(["Global"]);
  const [lastStockCount, setLastStockCount] = useState<number | undefined>(undefined);
  const [lastLocation, setLastLocation] = useState("");
  const [saved, setSaved] = useState(false);
  const [loadedRun, setLoadedRun] = useState<SavedRun | null>(null);

  // Load saved run from URL param
  const runId = searchParams.get("run");
  useEffect(() => {
    if (runId) {
      getRun(runId).then((run) => {
        if (run) {
          setLoadedRun(run);
          setHasRun(false);
        } else {
          setLoadedRun(null);
        }
      });
    } else {
      setLoadedRun(null);
    }
  }, [runId, getRun]);

  async function handleAnalyze(params: {
    topic: string;
    location: string;
    dateFrom: string;
    dateTo: string;
    tickers?: string;
    tags: string[];
    markets: MarketRegion[];
    stockCount?: number;
    manualSources?: ManualSources;
  }) {
    setLoadedRun(null);
    setHasRun(true);
    setSaved(false);
    setLastTags(params.tags);
    setLastMarkets(params.markets);
    setLastStockCount(params.stockCount);
    setLastLocation(params.location);
    await runAnalysis(params);
  }

  async function handleSave() {
    await saveRun({
      tags: lastTags,
      location: lastLocation,
      markets: lastMarkets,
      stockCount: lastStockCount,
      results,
    });
    setSaved(true);
  }

  const { setContext } = useChatContext();

  // Determine which results and metadata to display
  const displayResults: AnalysisResults = loadedRun ? loadedRun.results : results;
  const displayMarkets: MarketRegion[] = loadedRun ? loadedRun.markets : lastMarkets;
  useEffect(() => {
    setContext({
      page: "dashboard",
      results: displayResults,
      tags: lastTags,
      markets: lastMarkets,
    });
  }, [displayResults, lastTags, lastMarkets]);

  const hasResults =
    displayResults.qa || displayResults.stocks || displayResults.graph || displayResults.causechain;
  const showResults = (hasRun || loadedRun) && hasResults && !progress.isRunning;

  return (
    <div className="space-y-6">
      <AnalysisForm
        onAnalyze={handleAnalyze}
        isRunning={progress.isRunning}
        hasKeys={hasKeys}
        selectedModel={selectedModel}
        newsSource={newsSource}
      />

      {error && (
        <div className="rounded-lg border border-bearish/30 bg-bearish/5 p-4">
          <p className="text-sm text-bearish">{error}</p>
        </div>
      )}

      {progress.isRunning && <ProgressOverlay progress={progress} />}

      {showResults && (
        <div className="space-y-4">
          {/* Save button (only for fresh analysis, not loaded runs) */}
          {!loadedRun && (
            <div className="flex justify-end">
              <Button
                variant={saved ? "secondary" : "primary"}
                size="sm"
                icon={
                  saved ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )
                }
                onClick={handleSave}
                disabled={saved}
              >
                {saved ? "Saved" : "Save Analysis"}
              </Button>
            </div>
          )}

          {loadedRun && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Viewing saved run from{" "}
              <span className="text-text-secondary">
                {new Date(loadedRun.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          <ReportTabs
            results={displayResults}
            markets={displayMarkets}
            openRouterKey={openRouterKey}
            selectedModel={selectedModel}
            jinaKey={jinaKey}
            alphaVantageKey={alphaVantageKey}
          />
        </div>
      )}
    </div>
  );
}
