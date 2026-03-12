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

export type MarketRegion = "US" | "India" | "Europe" | "Asia" | "Global";

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
  relatedArticles?: { title: string; url: string; }[];
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
  market?: MarketRegion;
  stockCount?: number;
}

export type NewsSource = "jina" | "alphavantage" | "both";

export interface NewsSearchRequest {
  topic: string;
  location: string;
  datePeriod: {
    from: string;
    to: string;
  };
  previousArticleUrls: string[];
  newsSource?: NewsSource;
  tickers?: string;
  manualArticles?: NewsArticle[];
}

export interface PromptPair {
  system: string;
  user: string;
}
