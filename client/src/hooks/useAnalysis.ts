import { useState, useCallback } from "react";
import type {
  AnalysisResults,
  AnalysisProgress,
  ProgressStep,
  QAItem,
  StockRecommendation,
  GraphNode,
  GraphEdge,
  CauseChainAnalysis,
  NewsSource,
  NewsArticle,
  MarketRegion,
  ManualSources,
  AnalysisModules,
} from "../types";
import * as api from "../services/api";
import { useNewsHistory } from "./useNewsHistory";

function buildSteps(modules: AnalysisModules): ProgressStep[] {
  const steps: ProgressStep[] = [
    { id: "news", label: "Searching news articles...", status: "pending" },
  ];
  if (modules.qa) steps.push({ id: "qa", label: "Generating Q&A report...", status: "pending" });
  if (modules.stocks) steps.push({ id: "stocks", label: "Generating stock recommendations...", status: "pending" });
  if (modules.graph || modules.causechain) {
    const parts = [modules.graph && "impact graph", modules.causechain && "cause chain"].filter(Boolean);
    steps.push({ id: "graphs", label: `Building ${parts.join(" & ")}...`, status: "pending" });
  }
  return steps;
}

function makeProgress(
  steps: ProgressStep[],
  current: number,
  running: boolean,
): AnalysisProgress {
  return { steps, currentStep: current, isRunning: running };
}

export function useAnalysis(
  jinaKey: string,
  openRouterKey: string,
  selectedModel: string,
  alphaVantageKey: string,
  newsSource: NewsSource,
) {
  const [results, setResults] = useState<AnalysisResults>({
    qa: null,
    stocks: null,
    graph: null,
    causechain: null,
  });
  const [progress, setProgress] = useState<AnalysisProgress>(
    makeProgress([], 0, false),
  );
  const [error, setError] = useState<string | null>(null);
  const { getPreviousUrls, addUrls } = useNewsHistory();

  const updateStep = (
    steps: ProgressStep[],
    idx: number,
    status: ProgressStep["status"],
  ): ProgressStep[] => steps.map((s, i) => (i === idx ? { ...s, status } : s));

  const runAnalysis = useCallback(
    async (params: {
      topic: string;
      location: string;
      dateFrom: string;
      dateTo: string;
      tickers?: string;
      tags?: string[];
      markets?: MarketRegion[];
      stockCount?: number;
      manualSources?: ManualSources;
      modules?: AnalysisModules;
    }) => {
      const modules = params.modules ?? { qa: true, stocks: true, graph: true, causechain: true };
      setError(null);
      setResults({ qa: null, stocks: null, graph: null, causechain: null });

      let steps = buildSteps(modules);
      let stepIdx = 0;
      setProgress(makeProgress(steps, 0, true));

      const findStep = (id: string) => steps.findIndex((s) => s.id === id);

      try {
        // Step: Search news + process manual sources
        steps = updateStep(steps, findStep("news"), "running");
        setProgress(makeProgress(steps, stepIdx, true));

        // Process manual sources into NewsArticle objects
        const manualArticles: NewsArticle[] = [];
        const ms = params.manualSources;
        if (ms) {
          if (ms.urls.length > 0) {
            const urlResults = await Promise.allSettled(
              ms.urls.map((url) => api.extractUrl(jinaKey, url)),
            );
            for (const result of urlResults) {
              if (result.status === "fulfilled") {
                manualArticles.push({
                  url: result.value.url,
                  title: result.value.title || result.value.url,
                  content: result.value.content,
                  publishedDate: new Date().toISOString(),
                  isNew: true,
                  source: "Manual URL",
                });
              }
            }
          }
          for (const file of ms.files) {
            manualArticles.push({
              url: `manual://${file.name}`,
              title: file.name,
              content: file.content,
              publishedDate: new Date().toISOString(),
              isNew: true,
              source: "Manual Upload",
            });
          }
          if (ms.text.trim()) {
            manualArticles.push({
              url: "manual://pasted-text",
              title: "Manual Input",
              content: ms.text.trim(),
              publishedDate: new Date().toISOString(),
              isNew: true,
              source: "Manual Input",
            });
          }
        }

        const hasTopicOrTags = !!(params.topic && params.topic.trim());
        const onlyManual = !hasTopicOrTags && manualArticles.length > 0;

        let allArticles: NewsArticle[];

        if (onlyManual) {
          allArticles = manualArticles;
        } else {
          const historyKey = params.topic || "__general__";
          const previousUrls = await getPreviousUrls(historyKey);
          const newsResult = await api.searchNews(
            jinaKey,
            {
              topic: params.topic,
              location: params.location,
              datePeriod: { from: params.dateFrom, to: params.dateTo },
              previousArticleUrls: previousUrls,
              newsSource,
              tickers: params.tickers,
              manualArticles: manualArticles.length > 0 ? manualArticles : undefined,
            },
            alphaVantageKey || undefined,
          );

          allArticles = newsResult.articles;

          if (manualArticles.length > 0) {
            const existingUrls = new Set(allArticles.map((a) => a.url));
            for (const ma of manualArticles) {
              if (!existingUrls.has(ma.url)) {
                allArticles.push(ma);
              }
            }
          }

          await addUrls(
            historyKey,
            newsResult.articles.map((a) => a.url),
          );
        }

        if (allArticles.length === 0) {
          throw new Error(
            "No news articles found. Try adjusting the topic or date range, or add manual sources.",
          );
        }

        steps = updateStep(steps, findStep("news"), "done");
        stepIdx++;
        setProgress(makeProgress(steps, stepIdx, true));

        const market = params.markets?.join(",") || "Global";
        const commonParams = {
          model: selectedModel,
          articles: allArticles,
          topic: params.topic,
          location: params.location,
          market,
          stockCount: params.stockCount,
        };

        // Phase 2: QA + Stocks in parallel (only selected modules)
        const phase2Promises: Promise<void>[] = [];

        if (modules.qa) {
          const qaIdx = findStep("qa");
          steps = updateStep(steps, qaIdx, "running");
          setProgress(makeProgress(steps, stepIdx, true));
          phase2Promises.push(
            api.generateReport<QAItem[]>(openRouterKey, { ...commonParams, reportType: "qa" })
              .then((data) => { setResults((prev) => ({ ...prev, qa: data })); }),
          );
        }

        if (modules.stocks) {
          const stocksIdx = findStep("stocks");
          steps = updateStep(steps, stocksIdx, "running");
          setProgress(makeProgress(steps, stepIdx, true));
          phase2Promises.push(
            api.generateReport<StockRecommendation[]>(openRouterKey, { ...commonParams, reportType: "stocks" })
              .then((data) => { setResults((prev) => ({ ...prev, stocks: data })); }),
          );
        }

        if (phase2Promises.length > 0) {
          await Promise.all(phase2Promises);
          if (modules.qa) steps = updateStep(steps, findStep("qa"), "done");
          if (modules.stocks) steps = updateStep(steps, findStep("stocks"), "done");
          stepIdx++;
          setProgress(makeProgress(steps, stepIdx, true));
        }

        // Phase 3: Graph + Cause Chain in parallel (only selected modules)
        const phase3Promises: Promise<void>[] = [];

        if (modules.graph) {
          phase3Promises.push(
            api.generateReport<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
              openRouterKey, { ...commonParams, reportType: "graph" },
            ).then((data) => { setResults((prev) => ({ ...prev, graph: data })); }),
          );
        }

        if (modules.causechain) {
          phase3Promises.push(
            api.generateReport<CauseChainAnalysis>(openRouterKey, { ...commonParams, reportType: "causechain" })
              .then((data) => { setResults((prev) => ({ ...prev, causechain: data })); }),
          );
        }

        if (phase3Promises.length > 0) {
          const graphsIdx = findStep("graphs");
          steps = updateStep(steps, graphsIdx, "running");
          setProgress(makeProgress(steps, stepIdx, true));
          await Promise.all(phase3Promises);
          steps = updateStep(steps, graphsIdx, "done");
          stepIdx++;
        }

        setProgress(makeProgress(steps, steps.length, false));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(message);
        setProgress((prev) => ({ ...prev, isRunning: false }));
      }
    },
    [jinaKey, openRouterKey, selectedModel, alphaVantageKey, newsSource, getPreviousUrls, addUrls],
  );

  return { results, progress, error, runAnalysis };
}
