import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, Gem, Eye, Search, Sparkles } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { StockRecommendation, MarketRegion, InsightRarity } from "../../types";

interface StocksReportProps {
  stocks: StockRecommendation[];
  markets?: MarketRegion[];
  onStockClick?: (stock: StockRecommendation) => void;
}

const signalConfig = {
  bullish: {
    variant: "bullish" as const,
    icon: ArrowUp,
    border: "border-l-bullish",
    barColor: "bg-bullish",
  },
  bearish: {
    variant: "bearish" as const,
    icon: ArrowDown,
    border: "border-l-bearish",
    barColor: "bg-bearish",
  },
  neutral: {
    variant: "neutral" as const,
    icon: Minus,
    border: "border-l-neutral-tone",
    barColor: "bg-neutral-tone",
  },
};

const rarityConfig: Record<InsightRarity, { label: string; icon: typeof Eye; color: string; bg: string; border: string }> = {
  obvious: {
    label: "Obvious",
    icon: Eye,
    color: "text-text-muted",
    bg: "bg-surface-overlay",
    border: "border-border",
  },
  moderate: {
    label: "Moderate",
    icon: Search,
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
  },
  rare: {
    label: "Rare Find",
    icon: Sparkles,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  },
  "hidden-gem": {
    label: "Hidden Gem",
    icon: Gem,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
};

export function StocksReport({ stocks, markets, onStockClick }: StocksReportProps) {
  // Extract unique markets from the stock data
  const uniqueMarkets = Array.from(
    new Set(stocks.map((s) => s.market).filter(Boolean)),
  ) as string[];

  const [activeMarket, setActiveMarket] = useState<string>("All");
  const [activeRarity, setActiveRarity] = useState<string>("All");

  const hasRarity = stocks.some((s) => s.rarity);

  const filteredStocks = stocks.filter((s) => {
    if (activeMarket !== "All" && s.market !== activeMarket) return false;
    if (activeRarity !== "All" && s.rarity !== activeRarity) return false;
    return true;
  });

  return (
    <div>
      {/* Filters row */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {/* Market filter tabs */}
        {uniqueMarkets.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {["All", ...uniqueMarkets].map((m) => (
              <button
                key={m}
                onClick={() => setActiveMarket(m)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200
                  ${
                    activeMarket === m
                      ? "text-accent bg-accent/10 border-b-2 border-accent"
                      : "text-text-muted hover:text-text-secondary hover:bg-surface-overlay"
                  }`}
              >
                {m}
                <span className="ml-1.5 text-[10px] text-text-muted">
                  {m === "All"
                    ? stocks.length
                    : stocks.filter((s) => s.market === m).length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Rarity filter */}
        {hasRarity && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 ml-auto">
            {(["All", "hidden-gem", "rare", "moderate", "obvious"] as const).map((r) => {
              const isAll = r === "All";
              const rc = isAll ? null : rarityConfig[r];
              const count = isAll ? stocks.length : stocks.filter((s) => s.rarity === r).length;
              if (!isAll && count === 0) return null;
              const RIcon = rc?.icon;
              return (
                <button
                  key={r}
                  onClick={() => setActiveRarity(r)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200
                    ${
                      activeRarity === r
                        ? rc ? `${rc.color} ${rc.bg}` : "text-accent bg-accent/10"
                        : "text-text-muted hover:text-text-secondary hover:bg-surface-overlay"
                    }`}
                >
                  {RIcon && <RIcon className="w-3 h-3" />}
                  {isAll ? "All" : rc!.label}
                  <span className="text-[10px] text-text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredStocks.map((stock, i) => {
          const cfg = signalConfig[stock.signal];
          const SignalIcon = cfg.icon;

          return (
            <Card
              key={i}
              className={`border-l-4 ${cfg.border} ${onStockClick ? "cursor-pointer hover:bg-surface-overlay/50 hover:border-accent/30" : ""}`}
              onClick={() => onStockClick?.(stock)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-text-primary">
                      {stock.ticker}
                    </span>
                    <Badge variant={cfg.variant} size="sm">
                      <SignalIcon className="w-3 h-3 mr-1" />
                      {stock.signal}
                    </Badge>
                    {stock.market && (
                      <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-surface-overlay border border-border">
                        {stock.market}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {stock.company}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {stock.rarity && (() => {
                    const rc = rarityConfig[stock.rarity];
                    const RarityIcon = rc.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${rc.color} ${rc.bg} ${rc.border}`}>
                        <RarityIcon className="w-3 h-3" />
                        {rc.label}
                      </span>
                    );
                  })()}
                  <Badge variant="default" size="sm">
                    {stock.sector}
                  </Badge>
                </div>
              </div>

              {/* Impact score bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Impact Score</span>
                  <span className="text-text-secondary font-medium">
                    {stock.impactScore}/10
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-overlay rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.barColor}`}
                    style={{ width: `${stock.impactScore * 10}%` }}
                  />
                </div>
              </div>

              {/* Causation chain */}
              {stock.causationChain.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">
                    Causation Chain
                  </p>
                  <div className="flex flex-col gap-1">
                    {stock.causationChain.map((step, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <div className="flex flex-col items-center shrink-0 mt-1">
                          <div className="w-2 h-2 rounded-full bg-accent/60" />
                          {j < stock.causationChain.length - 1 && (
                            <div className="w-px h-4 bg-border" />
                          )}
                        </div>
                        <span className="text-xs text-text-secondary leading-relaxed">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasoning */}
              <p className="text-xs text-text-muted leading-relaxed">
                {stock.reasoning}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
