import { useState, useEffect, useCallback, useRef } from "react";
import type { StockRecommendation } from "../types";
import { getStockAnalysis, putStockAnalysis } from "../lib/db";

export interface FundamentalAnalysis {
  overview: string;
  financialHealth: string;
  valuation: string;
  growthProspects: string;
  riskFactors: string;
  metrics: {
    price: string;
    change: string;
    marketCap: string;
    peRatio: string;
    eps: string;
    dividendYield: string;
    fiftyTwoWeekHigh: string;
    fiftyTwoWeekLow: string;
    analystTarget: string;
    profitMargin: string;
    revenueGrowth: string;
    returnOnEquity: string;
  };
  signalScore: number;
  signalLabel: string;
}

export interface TechnicalAnalysis {
  priceAction: string;
  supportResistance: string;
  momentum: string;
  volume: string;
  recommendation: string;
  indicators: {
    rsi: string;
    rsiSignal: string;
    macd: string;
    macdSignal: string;
    fiftyDayMA: string;
    twoHundredDayMA: string;
    trend: string;
    volumeTrend: string;
  };
  support: string[];
  resistance: string[];
  signalScore: number;
  signalLabel: string;
}

interface ProgressStep {
  type: string;
  message: string;
  detail?: string;
}

function cacheKey(ticker: string, analysisType: string, model: string): string {
  return `${ticker}_${analysisType}_${model}`;
}

export function useStockAnalysis(
  stock: StockRecommendation,
  analysisType: "fundamental" | "technical",
  openRouterKey: string,
  selectedModel: string,
  jinaKey?: string,
  alphaVantageKey?: string,
): {
  data: FundamentalAnalysis | TechnicalAnalysis | null;
  loading: boolean;
  error: string | null;
  progress: ProgressStep[];
  cached: boolean;
  cachedAt: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<FundamentalAnalysis | TechnicalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    setRefreshCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null);
    setProgress([]);
    setCached(false);
    setCachedAt(null);

    const key = cacheKey(stock.ticker, analysisType, selectedModel);

    async function run() {
      // Check cache first (skip on manual refresh)
      if (refreshCount === 0) {
        try {
          const cachedEntry = await getStockAnalysis(key);
          if (cachedEntry && !cancelled) {
            setData(cachedEntry.data as FundamentalAnalysis | TechnicalAnalysis);
            setCachedAt(cachedEntry.timestamp);
            setCached(true);
            setLoading(false);
            return;
          }
        } catch {
          // Cache miss or error, proceed with fetch
        }
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-openrouter-key": openRouterKey,
        };
        if (jinaKey) headers["x-jina-key"] = jinaKey;
        if (alphaVantageKey) headers["x-alphavantage-key"] = alphaVantageKey;

        const res = await fetch("/api/analysis/generate-stock-detail", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: selectedModel,
            stock,
            analysisType,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`API error (${res.status}): ${body}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (cancelled) break;
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as {
                  type: string;
                  message: string;
                  detail?: string;
                  data?: unknown;
                };
                if (event.type === "result") {
                  const result = event.data as FundamentalAnalysis | TechnicalAnalysis;
                  setData(result);
                  // Save to cache
                  try {
                    await putStockAnalysis(key, result);
                  } catch {
                    // Cache write failure is non-fatal
                  }
                } else if (event.type === "error") {
                  setError(event.message);
                } else {
                  setProgress((prev) => [...prev, {
                    type: event.type,
                    message: event.message,
                    detail: event.detail,
                  }]);
                }
              } catch {
                // JSON parse failure on SSE line, skip
              }
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to load analysis",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [stock.ticker, analysisType, openRouterKey, selectedModel, jinaKey, alphaVantageKey, refreshCount]);

  return { data, loading, error, progress, cached, cachedAt, refresh };
}
