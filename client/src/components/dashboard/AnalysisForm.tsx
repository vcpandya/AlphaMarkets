import { useState, useRef } from "react";
import { Play, AlertCircle, ChevronDown, X, Upload, Plus, Link as LinkIcon, FileText, Type } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import TagInput from "../ui/TagInput";
import type { NewsSource, MarketRegion, ManualSources } from "../../types";

const DEFAULT_TAGS: string[] = [
  "global markets",
  "oil energy",
  "tech AI",
  "inflation rates",
  "geopolitics",
  "crypto",
  "earnings",
  "commodities",
  "forex currencies",
  "real estate",
];

const MARKET_OPTIONS: MarketRegion[] = ["US", "India", "Europe", "Asia", "Global"];

interface AnalysisFormProps {
  onAnalyze: (params: {
    topic: string;
    location: string;
    dateFrom: string;
    dateTo: string;
    tickers?: string;
    tags: string[];
    markets: MarketRegion[];
    stockCount?: number;
    manualSources?: ManualSources;
  }) => void;
  isRunning: boolean;
  hasKeys: boolean;
  selectedModel: string;
  newsSource: NewsSource;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

const NEWS_SOURCE_LABELS: Record<NewsSource, string> = {
  jina: "Jina",
  alphavantage: "Alpha Vantage",
  both: "Jina + Alpha Vantage",
};

type SourceTab = "urls" | "files" | "text";

export function AnalysisForm({
  onAnalyze,
  isRunning,
  hasKeys,
  selectedModel,
  newsSource,
}: AnalysisFormProps) {
  const [tags, setTags] = useState<string[]>([...DEFAULT_TAGS]);
  const [markets, setMarkets] = useState<MarketRegion[]>(["Global"]);
  const [stockCount, setStockCount] = useState<number | undefined>(undefined);
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tickers, setTickers] = useState("");

  // Manual sources state
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceTab>("urls");
  const [manualUrls, setManualUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [bulkUrlInput, setBulkUrlInput] = useState("");
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [manualText, setManualText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showTickers = newsSource === "alphavantage" || newsSource === "both";

  function toggleMarket(m: MarketRegion) {
    setMarkets((prev) => {
      if (prev.includes(m)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== m);
      }
      return [...prev, m];
    });
  }

  function addUrl(url: string) {
    const trimmed = url.trim();
    if (trimmed && !manualUrls.includes(trimmed)) {
      setManualUrls((prev) => [...prev, trimmed]);
    }
  }

  function handleAddUrl() {
    addUrl(urlInput);
    setUrlInput("");
  }

  function handleBulkAdd() {
    const urls = bulkUrlInput
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    const newUrls = [...manualUrls];
    for (const url of urls) {
      if (!newUrls.includes(url)) {
        newUrls.push(url);
      }
    }
    setManualUrls(newUrls);
    setBulkUrlInput("");
  }

  function removeUrl(url: string) {
    setManualUrls((prev) => prev.filter((u) => u !== url));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setManualFiles((prev) => [...prev, ...newFiles]);
    }
    // Reset input so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setManualFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function readFileContent(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(`[Error reading file: ${file.name}]`);
      reader.readAsText(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const todayStr = today();

    // Build manual sources
    let manualSources: ManualSources | undefined;
    const hasManualContent =
      manualUrls.length > 0 || manualFiles.length > 0 || manualText.trim().length > 0;

    if (hasManualContent) {
      const fileContents = await Promise.all(
        manualFiles.map(async (f) => ({
          name: f.name,
          content: await readFileContent(f),
          type: f.type || "text/plain",
        })),
      );
      manualSources = {
        urls: manualUrls,
        files: fileContents,
        text: manualText,
      };
    }

    onAnalyze({
      topic: tags.join(", "),
      location: location.trim(),
      dateFrom: dateFrom || todayStr,
      dateTo: dateTo || todayStr,
      ...(showTickers && tickers.trim() ? { tickers: tickers.trim() } : {}),
      tags,
      markets,
      ...(stockCount !== undefined ? { stockCount } : {}),
      ...(manualSources ? { manualSources } : {}),
    });
  }

  const manualSourceCount =
    manualUrls.length + manualFiles.length + (manualText.trim() ? 1 : 0);

  return (
    <Card glass className="relative overflow-hidden">
      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-text-primary mb-1">
            Market Intelligence Analysis
          </h3>
          <p className="text-xs text-text-muted">
            Analyze market impact across sectors and stocks. Select tags, markets, and date range.
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1.5">
            Topics
          </label>
          <TagInput
            tags={tags}
            onChange={setTags}
            placeholder="Add a topic tag..."
            defaultTags={DEFAULT_TAGS}
          />
        </div>

        {/* Markets + Stock count */}
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-2">
            Markets
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {MARKET_OPTIONS.map((m) => {
              const selected = markets.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMarket(m)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border
                    ${
                      selected
                        ? "bg-accent text-white border-accent shadow-sm shadow-accent/20"
                        : "bg-surface-overlay text-text-muted border-border hover:text-text-secondary hover:border-text-muted/30"
                    }`}
                >
                  {m}
                </button>
              );
            })}

            {/* Stock count */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
              <label className="text-xs text-text-muted whitespace-nowrap">
                Stocks per market (blank = all)
              </label>
              <input
                type="number"
                value={stockCount ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setStockCount(undefined);
                  } else {
                    const v = parseInt(raw, 10);
                    if (!isNaN(v) && v > 0) setStockCount(v);
                  }
                }}
                placeholder="-"
                className="w-16 rounded-lg border border-border bg-surface-overlay px-2 py-1.5
                  text-sm text-text-primary text-center outline-none
                  focus:border-accent focus:ring-1 focus:ring-accent/30
                  placeholder:text-text-muted/50
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Location Relevance"
            placeholder="e.g., India, US, Global (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                hint="Defaults to today"
              />
            </div>
            <div className="flex-1">
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                hint="Defaults to today"
              />
            </div>
          </div>

          {showTickers && (
            <div className="md:col-span-2">
              <Input
                label="Tickers"
                placeholder="e.g., AAPL,MSFT,RELIANCE.BSE"
                value={tickers}
                onChange={(e) => setTickers(e.target.value)}
              />
              <p className="text-[10px] text-text-muted mt-1">
                Comma-separated stock tickers for Alpha Vantage news filtering.
              </p>
            </div>
          )}
        </div>

        {/* Additional Sources - Collapsible */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setSourcesOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-surface-overlay hover:bg-surface-overlay/80 transition-colors"
          >
            <span className="text-xs font-medium text-text-secondary flex items-center gap-2">
              Additional Sources (optional)
              {manualSourceCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  {manualSourceCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${sourcesOpen ? "rotate-180" : ""}`}
            />
          </button>

          {sourcesOpen && (
            <div className="px-3 pb-3 pt-2 space-y-3 bg-surface-overlay/30">
              {/* Sub-tabs */}
              <div className="flex gap-1 border-b border-border">
                {([
                  { key: "urls" as SourceTab, label: "URLs", icon: LinkIcon },
                  { key: "files" as SourceTab, label: "Files", icon: FileText },
                  { key: "text" as SourceTab, label: "Paste Text", icon: Type },
                ]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSourceTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-[1px]
                      ${sourceTab === key
                        ? "border-accent text-accent"
                        : "border-transparent text-text-muted hover:text-text-secondary"
                      }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              {/* URLs tab */}
              {sourceTab === "urls" && (
                <div className="space-y-2">
                  {/* Single URL input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddUrl();
                        }
                      }}
                      placeholder="https://example.com/article"
                      className="flex-1 rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5
                        text-xs text-text-primary outline-none placeholder:text-text-muted/50
                        focus:border-accent focus:ring-1 focus:ring-accent/30"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrl}
                      disabled={!urlInput.trim()}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                        bg-accent/10 text-accent hover:bg-accent/20 transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>

                  {/* Bulk paste */}
                  <div className="space-y-1.5">
                    <textarea
                      value={bulkUrlInput}
                      onChange={(e) => setBulkUrlInput(e.target.value)}
                      placeholder="Paste multiple URLs, one per line..."
                      rows={3}
                      className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5
                        text-xs text-text-primary outline-none resize-none placeholder:text-text-muted/50
                        focus:border-accent focus:ring-1 focus:ring-accent/30"
                    />
                    {bulkUrlInput.trim() && (
                      <button
                        type="button"
                        onClick={handleBulkAdd}
                        className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
                      >
                        + Add URLs
                      </button>
                    )}
                  </div>

                  {/* URL pills */}
                  {manualUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {manualUrls.map((url) => (
                        <span
                          key={url}
                          className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] text-accent max-w-[280px]"
                        >
                          <span className="truncate">{url}</span>
                          <button
                            type="button"
                            onClick={() => removeUrl(url)}
                            className="shrink-0 hover:text-bearish transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Files tab */}
              {sourceTab === "files" && (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.html,.htm,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border border-dashed border-border
                      bg-surface-overlay hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-text-muted" />
                    <span className="text-xs text-text-muted">
                      Click to upload .pdf, .html, .txt files
                    </span>
                  </button>

                  {manualFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {manualFiles.map((file, i) => (
                        <span
                          key={`${file.name}-${i}`}
                          className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] text-accent"
                        >
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="shrink-0 hover:text-bearish transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Text tab */}
              {sourceTab === "text" && (
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">
                    Paste news content directly
                  </label>
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Paste article text, press releases, or any news content here..."
                    rows={5}
                    className="w-full rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5
                      text-xs text-text-primary outline-none resize-y placeholder:text-text-muted/50
                      focus:border-accent focus:ring-1 focus:ring-accent/30"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {selectedModel && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Model: <span className="text-text-secondary">{selectedModel}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Source:{" "}
            <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              {NEWS_SOURCE_LABELS[newsSource]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          {hasKeys && selectedModel ? (
            <Button
              type="submit"
              size="lg"
              disabled={isRunning}
              icon={<Play className="w-4 h-4" />}
              className="min-w-[160px]"
            >
              {isRunning ? "Analyzing..." : "Analyze"}
            </Button>
          ) : (
            <div className="flex items-center gap-3 text-sm text-text-muted">
              <AlertCircle className="w-4 h-4 text-bearish shrink-0" />
              <span>
                {!hasKeys
                  ? "API keys required. "
                  : "Select a model in "}
                <Link to="/settings" className="text-accent hover:underline">
                  Settings
                </Link>
                {!hasKeys ? " to get started." : " to continue."}
              </span>
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}
