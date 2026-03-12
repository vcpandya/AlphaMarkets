export interface NewsArticle {
  url: string;
  title: string;
  content: string;
  publishedDate: string;
  isNew: boolean;
  source?: string;
}

export interface NewsSearchResult {
  articles: NewsArticle[];
  stats: {
    total: number;
    new: number;
    previouslySeen: number;
  };
}

export interface QAItem {
  question: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  relatedSectors: string[];
}

export type InsightRarity = "obvious" | "moderate" | "rare" | "hidden-gem";

export interface StockRecommendation {
  ticker: string;
  company: string;
  sector: string;
  signal: "bullish" | "bearish" | "neutral";
  impactScore: number;
  causationChain: string[];
  reasoning: string;
  market?: string;
  rarity?: InsightRarity;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "sector" | "stock" | "event" | "news";
  signal?: "bullish" | "bearish" | "neutral";
  impactScore?: number;
  size: number;
  domain?: string;
  market?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  strength: number;
  direction: "positive" | "negative";
}

export interface CauseChainNode {
  id: string;
  label: string;
  type: "news_source" | "cause" | "effect" | "stock_impact";
  description: string;
  referenceUrl?: string;
  referenceSource?: string;
  relatedArticles?: { title: string; url: string }[];
  impactExplanation?: string;
}

export interface CauseChainLink {
  source: string;
  target: string;
  label: string;
  impactScore: number;
  direction: "positive" | "negative";
}

export interface CauseChainAnalysis {
  chains: {
    newsSource: string;
    nodes: CauseChainNode[];
    links: CauseChainLink[];
  }[];
}

export interface AnalysisRequest {
  model: string;
  articles: NewsArticle[];
  topic: string;
  location: string;
  reportType: "qa" | "stocks" | "graph" | "causechain";
}

export interface NewsSearchRequest {
  topic: string;
  location: string;
  datePeriod: {
    from: string;
    to: string;
  };
  previousArticleUrls: string[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  promptPrice: string;
  completionPrice: string;
}

export interface AnalysisResults {
  qa: QAItem[] | null;
  stocks: StockRecommendation[] | null;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  causechain: CauseChainAnalysis | null;
}

export interface ProgressStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export interface AnalysisProgress {
  steps: ProgressStep[];
  currentStep: number;
  isRunning: boolean;
}

export type MarketRegion = "US" | "India" | "Europe" | "Asia" | "Global";

export interface SavedRun {
  id: string;
  timestamp: string;
  tags: string[];
  location: string;
  markets: MarketRegion[];
  stockCount?: number;
  results: AnalysisResults;
}

export type NewsSource = "jina" | "alphavantage" | "both";

export interface ManualSources {
  urls: string[];
  files: { name: string; content: string; type: string }[];
  text: string;
}

export interface EnvKeyStatus {
  found: boolean;
  preview: string | null;
}

export interface EnvKeysResponse {
  openRouter: EnvKeyStatus;
  jina: EnvKeyStatus;
  alphaVantage: EnvKeyStatus;
}
