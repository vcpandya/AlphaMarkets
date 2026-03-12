import type {
  NewsSearchResult,
  OpenRouterModel,
  NewsArticle,
  NewsSource,
  EnvKeysResponse,
  ManualSources,
} from "../types";

const API_BASE = "/api";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let message: string;
    try {
      const parsed = JSON.parse(body);
      message = parsed.error || parsed.message || body;
    } catch {
      message = body;
    }
    throw new Error(`API error (${res.status}): ${message}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchModels(
  openRouterKey: string,
): Promise<OpenRouterModel[]> {
  const res = await fetch(`${API_BASE}/models`, {
    headers: { "x-openrouter-key": openRouterKey },
  });
  const data = await handleResponse<{ models: OpenRouterModel[] }>(res);
  return data.models;
}

export async function checkEnvKeys(): Promise<EnvKeysResponse> {
  const res = await fetch(`${API_BASE}/env-keys`);
  return handleResponse<EnvKeysResponse>(res);
}

export async function resolveEnvKey(
  key: "openRouter" | "jina" | "alphaVantage",
): Promise<string> {
  const res = await fetch(`${API_BASE}/env-keys/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = await handleResponse<{ value: string }>(res);
  return data.value;
}

export async function extractUrl(
  jinaKey: string,
  url: string,
): Promise<{ title: string; content: string; url: string }> {
  const res = await fetch(`${API_BASE}/content/extract-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-jina-key": jinaKey,
    },
    body: JSON.stringify({ url }),
  });
  return handleResponse<{ title: string; content: string; url: string }>(res);
}

export async function searchNews(
  jinaKey: string,
  params: {
    topic: string;
    location: string;
    datePeriod: { from: string; to: string };
    previousArticleUrls: string[];
    newsSource?: NewsSource;
    tickers?: string;
    manualArticles?: NewsArticle[];
  },
  alphaVantageKey?: string,
): Promise<NewsSearchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-jina-key": jinaKey,
  };
  if (alphaVantageKey) {
    headers["x-alphavantage-key"] = alphaVantageKey;
  }
  const res = await fetch(`${API_BASE}/news/search`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  return handleResponse<NewsSearchResult>(res);
}

export async function chat(
  openRouterKey: string,
  model: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const res = await fetch(`${API_BASE}/analysis/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openrouter-key": openRouterKey,
    },
    body: JSON.stringify({ model, messages }),
  });
  const data = await handleResponse<{ content: string }>(res);
  return data.content;
}

export async function generateReport<T>(
  openRouterKey: string,
  params: {
    model: string;
    articles: NewsArticle[];
    topic: string;
    location: string;
    reportType: "qa" | "stocks" | "graph" | "causechain";
    market?: string;
    stockCount?: number;
  },
): Promise<T> {
  const res = await fetch(`${API_BASE}/analysis/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openrouter-key": openRouterKey,
    },
    body: JSON.stringify(params),
  });
  const data = await handleResponse<{ reportType: string; data: T }>(res);
  return data.data;
}
