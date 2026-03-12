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
} from "../types";
import * as api from "../services/api";
import { useNewsHistory } from "./useNewsHistory";

const INITIAL_STEPS: ProgressStep[] = [
  { id: "news", label: "Searching news articles...", status: "pending" },
  { id: "qa", label: "Generating Q&A report...", status: "pending" },
  { id: "stocks", label: "Generating stock recommendations...", status: "pending" },
  { id: "graphs", label: "Building impact graph & cause chain...", status: "pending" },
];

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
    makeProgress(INITIAL_STEPS, 0, false),
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
    }) => {
      setError(null);
      setResults({ qa: null, stocks: null, graph: null, causechain: null });

      let steps = INITIAL_STEPS.map((s) => ({ ...s }));
      setProgress(makeProgress(steps, 0, true));

      try {
        // Step 1: Search news + process manual sources
        steps = updateStep(steps, 0, "running");
        setProgress(makeProgress(steps, 0, true));

        // Process manual sources into NewsArticle objects
        const manualArticles: NewsArticle[] = [];
        const ms = params.manualSources;
        if (ms) {
          // Extract URLs in parallel
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
          // Files
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
          // Raw text
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
          // Skip news search, use only manual articles
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

          // If server didn't merge manual articles, merge client-side
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

        steps = updateStep(steps, 0, "done");
        setProgress(makeProgress(steps, 1, true));

        const market = params.markets?.join(",") || "Global";
        const commonParams = {
          model: selectedModel,
          articles: allArticles,
          topic: params.topic,
          location: params.location,
          market,
          stockCount: params.stockCount,
        };

        // Step 2: Generate QA report
        steps = updateStep(steps, 1, "running");
        setProgress(makeProgress(steps, 1, true));

        const qaPromise = api
          .generateReport<QAItem[]>(openRouterKey, {
            ...commonParams,
            reportType: "qa",
          })
          .then((data) => {
            setResults((prev) => ({ ...prev, qa: data }));
          });

        // Step 3: Generate stocks report (parallel with QA)
        steps = updateStep(steps, 2, "running");
        setProgress(makeProgress(steps, 2, true));

        const stocksPromise = api
          .generateReport<StockRecommendation[]>(openRouterKey, {
            ...commonParams,
            reportType: "stocks",
          })
          .then((data) => {
            setResults((prev) => ({ ...prev, stocks: data }));
          });

        await Promise.all([qaPromise, stocksPromise]);

        steps = updateStep(steps, 1, "done");
        steps = updateStep(steps, 2, "done");
        setProgress(makeProgress(steps, 3, true));

        // Step 4: Generate graph + causechain in parallel
        steps = updateStep(steps, 3, "running");
        setProgress(makeProgress(steps, 3, true));

        const graphPromise = api
          .generateReport<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
            openRouterKey,
            { ...commonParams, reportType: "graph" },
          )
          .then((data) => {
            setResults((prev) => ({ ...prev, graph: data }));
          });

        const causechainPromise = api
          .generateReport<CauseChainAnalysis>(openRouterKey, {
            ...commonParams,
            reportType: "causechain",
          })
          .then((data) => {
            setResults((prev) => ({ ...prev, causechain: data }));
          });

        await Promise.all([graphPromise, causechainPromise]);

        steps = updateStep(steps, 3, "done");
        setProgress(makeProgress(steps, 4, false));
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
