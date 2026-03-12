import { useState, useCallback, useEffect } from "react";
import { X, ArrowUp, ArrowDown, Minus, RefreshCw, Check, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Spinner } from "../ui/Spinner";
import { useStockAnalysis } from "../../hooks/useStockAnalysis";
import type { StockRecommendation } from "../../types";
import type { FundamentalAnalysis, TechnicalAnalysis } from "../../hooks/useStockAnalysis";
import { useChatContext } from "../../contexts/ChatContext";

interface StockDetailViewProps {
  stock: StockRecommendation;
  onClose: () => void;
  openRouterKey: string;
  selectedModel: string;
  jinaKey?: string;
  alphaVantageKey?: string;
}

const signalConfig = {
  bullish: { variant: "bullish" as const, icon: ArrowUp },
  bearish: { variant: "bearish" as const, icon: ArrowDown },
  neutral: { variant: "neutral" as const, icon: Minus },
};

type TabId = "fundamental" | "technical";

export function StockDetailView({
  stock,
  onClose,
  openRouterKey,
  selectedModel,
  jinaKey,
  alphaVantageKey,
}: StockDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("fundamental");
  const [technicalLoaded, setTechnicalLoaded] = useState(false);
  const { setContext } = useChatContext();

  useEffect(() => {
    setContext({
      page: "stock-detail",
      selectedStock: stock,
      activeTab: activeTab,
    });
    return () => {
      setContext({ page: "dashboard", selectedStock: null, activeTab: undefined });
    };
  }, [stock, activeTab]);

  const cfg = signalConfig[stock.signal];
  const SignalIcon = cfg.icon;

  const handleTabSwitch = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (tab === "technical") {
      setTechnicalLoaded(true);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-4 lg:inset-8 bg-surface-raised rounded-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-overlay/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl font-bold text-text-primary shrink-0">
              {stock.ticker}
            </span>
            <span className="text-sm text-text-secondary truncate">{stock.company}</span>
            <Badge variant={cfg.variant} size="md">
              <SignalIcon className="w-3.5 h-3.5 mr-1" />
              {stock.signal}
            </Badge>
            <Badge variant="default" size="sm">
              {stock.sector}
            </Badge>
            {stock.market && (
              <span className="text-xs text-text-muted px-2 py-0.5 rounded bg-surface-overlay border border-border">
                {stock.market}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar is rendered by each tab panel so it can show cached/refresh per-tab */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "fundamental" ? (
            <FundamentalTabPanel
              stock={stock}
              openRouterKey={openRouterKey}
              selectedModel={selectedModel}
              jinaKey={jinaKey}
              alphaVantageKey={alphaVantageKey}
              activeTab={activeTab}
              onTabSwitch={handleTabSwitch}
            />
          ) : technicalLoaded ? (
            <TechnicalTabPanel
              stock={stock}
              openRouterKey={openRouterKey}
              selectedModel={selectedModel}
              jinaKey={jinaKey}
              alphaVantageKey={alphaVantageKey}
              activeTab={activeTab}
              onTabSwitch={handleTabSwitch}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Panel Props ───────────────────────────────────────────

interface TabPanelProps {
  stock: StockRecommendation;
  openRouterKey: string;
  selectedModel: string;
  jinaKey?: string;
  alphaVantageKey?: string;
  activeTab: TabId;
  onTabSwitch: (tab: TabId) => void;
}

// ─── Fundamental Tab Panel ─────────────────────────────────────

function FundamentalTabPanel({
  stock, openRouterKey, selectedModel, jinaKey, alphaVantageKey,
  activeTab, onTabSwitch,
}: TabPanelProps) {
  const { data, loading, error, progress, cached, cachedAt, refresh } = useStockAnalysis(
    stock, "fundamental", openRouterKey, selectedModel, jinaKey, alphaVantageKey,
  );

  return (
    <>
      <TabBar activeTab={activeTab} onTabSwitch={onTabSwitch} cached={cached} cachedAt={cachedAt} data={data} refresh={refresh} impactScore={stock.impactScore} />
      <div className="flex-1 overflow-y-auto p-6">
        <TabContent loading={loading} error={error} progress={progress} refresh={refresh} ticker={stock.ticker}>
          {data && <FundamentalContent data={data as FundamentalAnalysis} />}
        </TabContent>
      </div>
    </>
  );
}

// ─── Technical Tab Panel ───────────────────────────────────────

function TechnicalTabPanel({
  stock, openRouterKey, selectedModel, jinaKey, alphaVantageKey,
  activeTab, onTabSwitch,
}: TabPanelProps) {
  const { data, loading, error, progress, cached, cachedAt, refresh } = useStockAnalysis(
    stock, "technical", openRouterKey, selectedModel, jinaKey, alphaVantageKey,
  );

  return (
    <>
      <TabBar activeTab={activeTab} onTabSwitch={onTabSwitch} cached={cached} cachedAt={cachedAt} data={data} refresh={refresh} impactScore={stock.impactScore} />
      <div className="flex-1 overflow-y-auto p-6">
        <TabContent loading={loading} error={error} progress={progress} refresh={refresh} ticker={stock.ticker}>
          {data && <TechnicalContent data={data as TechnicalAnalysis} />}
        </TabContent>
      </div>
    </>
  );
}

// ─── Tab Bar ───────────────────────────────────────────────────

function TabBar({
  activeTab, onTabSwitch, cached, cachedAt, data, refresh, impactScore,
}: {
  activeTab: TabId;
  onTabSwitch: (tab: TabId) => void;
  cached: boolean;
  cachedAt: string | null;
  data: unknown;
  refresh: () => void;
  impactScore: number;
}) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-surface-overlay/30 shrink-0">
      <div className="flex items-center bg-surface-overlay rounded-full p-1 border border-border">
        <button
          onClick={() => onTabSwitch("fundamental")}
          className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
            activeTab === "fundamental"
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Fundamental
        </button>
        <button
          onClick={() => onTabSwitch("technical")}
          className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
            activeTab === "technical"
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Technical
        </button>
      </div>

      {cached && (
        <Badge variant="default" size="sm" className="ml-2">
          Cached
        </Badge>
      )}
      {cached && cachedAt && (
        <span className="text-[10px] text-text-muted ml-1">
          {new Date(cachedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })},{" "}
          {new Date(cachedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </span>
      )}

      {(cached || data) && (
        <button
          onClick={refresh}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          title="Refresh analysis"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}

      <div className="ml-auto flex items-center gap-4">
        <span className="text-xs text-text-muted">
          Impact: <span className="text-text-secondary font-medium">{impactScore}/10</span>
        </span>
      </div>
    </div>
  );
}

// ─── Tab Content Wrapper ───────────────────────────────────────

function TabContent({
  loading, error, progress, refresh, ticker, children,
}: {
  loading: boolean;
  error: string | null;
  progress: { type: string; message: string; detail?: string }[];
  refresh: () => void;
  ticker: string;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-bearish/30 bg-bearish/5 p-6 text-center">
        <p className="text-sm text-bearish mb-3">{error}</p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary
            bg-surface-overlay border border-border rounded-lg hover:bg-surface-raised transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (loading && progress.length > 0) {
    return <ProgressDisplay ticker={ticker} steps={progress} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-sm text-text-muted">Starting analysis...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Progress Display ──────────────────────────────────────────

function ProgressDisplay({ ticker, steps }: { ticker: string; steps: { type: string; message: string; detail?: string }[] }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-surface-overlay/50 rounded-2xl border border-border p-8">
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-text-primary">{ticker}</span>
          <p className="text-xs text-text-muted mt-1">Analyzing...</p>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 ${isLast ? "animate-pulse" : ""}`}
              >
                <div className="shrink-0 mt-0.5">
                  {isLast ? (
                    <Spinner size="sm" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm ${isLast ? "text-text-primary" : "text-text-secondary"}`}>
                    {step.message}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">{step.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Signal Gauge ──────────────────────────────────────────────

function SignalGauge({ score, label }: { score: number; label: string }) {
  const pct = ((score - 1) / 9) * 100;
  const labelColor =
    score >= 8 ? "text-green-400" :
    score >= 6 ? "text-emerald-400" :
    score >= 4 ? "text-yellow-400" :
    score >= 2 ? "text-orange-400" :
    "text-red-400";

  return (
    <div className="bg-surface-overlay/50 rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Signal Score</span>
        <span className={`text-sm font-bold ${labelColor}`}>{label}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden"
        style={{ background: "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)" }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-800 shadow-lg transition-all duration-500"
          style={{ left: `clamp(0%, calc(${pct}% - 8px), calc(100% - 16px))` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-text-muted">1</span>
        <span className="text-xs font-medium text-text-secondary">{score}/10</span>
        <span className="text-[10px] text-text-muted">10</span>
      </div>
    </div>
  );
}

// ─── Metric Card ───────────────────────────────────────────────

function MetricCard({ label, value, colorize }: { label: string; value: string; colorize?: boolean }) {
  let valueColor = "text-text-primary";
  if (colorize && value) {
    const numMatch = value.match(/[+-]?\d+\.?\d*/);
    if (numMatch) {
      const num = parseFloat(numMatch[0]);
      if (num > 0) valueColor = "text-green-400";
      else if (num < 0) valueColor = "text-red-400";
    }
  }

  return (
    <div className="bg-surface-overlay/50 rounded-xl border border-border p-4">
      <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueColor} truncate`}>{value || "N/A"}</p>
    </div>
  );
}

// ─── Fundamental Content ───────────────────────────────────────

function FundamentalContent({ data }: { data: FundamentalAnalysis }) {
  const m = data.metrics;
  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div>
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Key Metrics</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Price" value={m.price} />
          <MetricCard label="Change" value={m.change} colorize />
          <MetricCard label="Market Cap" value={m.marketCap} />
          <MetricCard label="P/E Ratio" value={m.peRatio} />
          <MetricCard label="EPS" value={m.eps} />
          <MetricCard label="Dividend Yield" value={m.dividendYield} />
          <MetricCard label="Analyst Target" value={m.analystTarget} />
          <MetricCard label="Profit Margin" value={m.profitMargin} colorize />
          <MetricCard label="ROE" value={m.returnOnEquity} colorize />
          <MetricCard label="Revenue Growth" value={m.revenueGrowth} colorize />
          <MetricCard label="52wk High" value={m.fiftyTwoWeekHigh} />
          <MetricCard label="52wk Low" value={m.fiftyTwoWeekLow} />
        </div>
      </div>

      {/* Signal Gauge */}
      <SignalGauge score={data.signalScore} label={data.signalLabel} />

      {/* Detailed Analysis */}
      <div>
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Detailed Analysis</h3>
        <div className="space-y-3">
          <AnalysisCard title="Overview" content={data.overview} />
          <AnalysisCard title="Financial Health" content={data.financialHealth} />
          <AnalysisCard title="Valuation" content={data.valuation} />
          <AnalysisCard title="Growth Prospects" content={data.growthProspects} />
          <AnalysisCard title="Risk Factors" content={data.riskFactors} />
        </div>
      </div>
    </div>
  );
}

// ─── Technical Content ─────────────────────────────────────────

function IndicatorBadge({ label, value, signal }: { label: string; value: string; signal?: string }) {
  let badgeVariant: "default" | "bullish" | "bearish" | "neutral" | "warning" = "default";
  if (signal === "bullish" || signal === "oversold") badgeVariant = "bullish";
  else if (signal === "bearish" || signal === "overbought") badgeVariant = "bearish";
  else if (signal === "neutral") badgeVariant = "neutral";

  return (
    <div className="bg-surface-overlay/50 rounded-xl border border-border p-4">
      <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-text-primary mb-2">{value || "N/A"}</p>
      {signal && (
        <Badge variant={badgeVariant} size="sm">{signal}</Badge>
      )}
    </div>
  );
}

function TechnicalContent({ data }: { data: TechnicalAnalysis }) {
  const ind = data.indicators;

  const trendIcon = ind.trend === "uptrend"
    ? <TrendingUp className="w-4 h-4 text-green-400 inline mr-1" />
    : ind.trend === "downtrend"
      ? <TrendingDown className="w-4 h-4 text-red-400 inline mr-1" />
      : null;

  return (
    <div className="space-y-6">
      {/* Indicator Cards */}
      <div>
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Technical Indicators</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <IndicatorBadge label="RSI" value={ind.rsi} signal={ind.rsiSignal} />
          <IndicatorBadge label="MACD" value={ind.macd} signal={ind.macdSignal} />
          <div className="bg-surface-overlay/50 rounded-xl border border-border p-4">
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Trend</p>
            <p className="text-lg font-bold text-text-primary">
              {trendIcon}{ind.trend || "N/A"}
            </p>
          </div>
          <IndicatorBadge label="Volume Trend" value={ind.volumeTrend} />
          <MetricCard label="50-day MA" value={ind.fiftyDayMA} />
          <MetricCard label="200-day MA" value={ind.twoHundredDayMA} />
        </div>
      </div>

      {/* Support / Resistance */}
      <div>
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Support & Resistance Levels</h3>
        <div className="bg-surface-overlay/50 rounded-xl border border-border p-5">
          <SupportResistanceChart support={data.support} resistance={data.resistance} />
        </div>
      </div>

      {/* Signal Gauge */}
      <SignalGauge score={data.signalScore} label={data.signalLabel} />

      {/* Detailed Analysis */}
      <div>
        <h3 className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">Detailed Analysis</h3>
        <div className="space-y-3">
          <AnalysisCard title="Price Action" content={data.priceAction} />
          <AnalysisCard title="Support & Resistance" content={data.supportResistance} />
          <AnalysisCard title="Momentum" content={data.momentum} />
          <AnalysisCard title="Volume" content={data.volume} />
          <AnalysisCard title="Recommendation" content={data.recommendation} />
        </div>
      </div>
    </div>
  );
}

// ─── Support/Resistance Chart ──────────────────────────────────

function SupportResistanceChart({ support, resistance }: { support: string[]; resistance: string[] }) {
  const parse = (s: string) => {
    const m = s.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  };

  const supportVals = support.map(parse).filter((v): v is number => v !== null);
  const resistanceVals = resistance.map(parse).filter((v): v is number => v !== null);
  const allVals = [...supportVals, ...resistanceVals];

  if (allVals.length === 0) {
    return <p className="text-sm text-text-muted text-center">No levels available</p>;
  }

  const min = Math.min(...allVals) * 0.98;
  const max = Math.max(...allVals) * 1.02;
  const range = max - min || 1;

  function pct(val: number) {
    return ((val - min) / range) * 100;
  }

  return (
    <div className="relative h-20 mb-6">
      {/* Track */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-surface-overlay rounded-full" />

      {/* Resistance levels */}
      {resistanceVals.map((v, i) => (
        <div
          key={`r-${i}`}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${pct(v)}%`, transform: "translateX(-50%)" }}
        >
          <span className="text-[10px] font-medium text-red-400 mb-1">${v.toFixed(2)}</span>
          <div className="w-0.5 h-4 bg-red-400/60 rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-300 mt-0.5" />
        </div>
      ))}

      {/* Support levels */}
      {supportVals.map((v, i) => (
        <div
          key={`s-${i}`}
          className="absolute bottom-0 flex flex-col items-center"
          style={{ left: `${pct(v)}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 border border-green-300 mb-0.5" />
          <div className="w-0.5 h-4 bg-green-400/60 rounded-full" />
          <span className="text-[10px] font-medium text-green-400 mt-1">${v.toFixed(2)}</span>
        </div>
      ))}

      {/* Legend */}
      <div className="absolute -bottom-6 right-0 flex items-center gap-4">
        <span className="flex items-center gap-1 text-[10px] text-text-muted">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Resistance
        </span>
        <span className="flex items-center gap-1 text-[10px] text-text-muted">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Support
        </span>
      </div>
    </div>
  );
}

// ─── Analysis Card ─────────────────────────────────────────────

function AnalysisCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-surface-overlay/50 rounded-xl border border-border p-4">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {title}
      </h4>
      <p className="text-sm text-text-primary leading-relaxed">{content}</p>
    </div>
  );
}
