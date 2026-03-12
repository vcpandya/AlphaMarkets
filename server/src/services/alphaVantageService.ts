import { NewsArticle } from "../types/index.js";

interface AlphaVantageTickerSentiment {
  ticker: string;
  relevance_score: string;
  ticker_sentiment_score: string;
  ticker_sentiment_label: string;
}

interface AlphaVantageFeedItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  time_published: string;
  overall_sentiment_score: number;
  overall_sentiment_label: string;
  ticker_sentiment: AlphaVantageTickerSentiment[];
}

interface AlphaVantageResponse {
  feed?: AlphaVantageFeedItem[];
  Information?: string;
  Error?: string;
  Note?: string;
}

const TOPIC_MAP: Record<string, string> = {
  oil: "energy_transportation",
  energy: "energy_transportation",
  gas: "energy_transportation",
  transport: "energy_transportation",
  transportation: "energy_transportation",
  tech: "technology",
  technology: "technology",
  ai: "technology",
  software: "technology",
  crypto: "technology",
  blockchain: "technology",
  finance: "finance",
  banking: "finance",
  bank: "finance",
  insurance: "finance",
  market: "financial_markets",
  markets: "financial_markets",
  stocks: "financial_markets",
  stock: "financial_markets",
  trading: "financial_markets",
  bonds: "financial_markets",
  manufacturing: "manufacturing",
  industrial: "manufacturing",
  fiscal: "economy_fiscal",
  tax: "economy_fiscal",
  taxes: "economy_fiscal",
  government: "economy_fiscal",
  monetary: "economy_monetary",
  fed: "economy_monetary",
  interest: "economy_monetary",
  rates: "economy_monetary",
  inflation: "economy_monetary",
  economy: "economy_macro",
  economic: "economy_macro",
  gdp: "economy_macro",
  macro: "economy_macro",
  recession: "economy_macro",
  realestate: "real_estate",
  "real estate": "real_estate",
  housing: "real_estate",
  property: "real_estate",
  retail: "retail_wholesale",
  wholesale: "retail_wholesale",
  consumer: "retail_wholesale",
  earnings: "earnings",
  revenue: "earnings",
  profit: "earnings",
  ipo: "ipo",
  merger: "mergers_acquisitions",
  mergers: "mergers_acquisitions",
  acquisition: "mergers_acquisitions",
  acquisitions: "mergers_acquisitions",
  m_and_a: "mergers_acquisitions",
};

function mapTopicToCategory(topic: string): string {
  const lower = topic.toLowerCase().trim();

  // Direct match
  if (TOPIC_MAP[lower]) {
    return TOPIC_MAP[lower];
  }

  // Check if any keyword appears in the topic string
  for (const [keyword, category] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(keyword)) {
      return category;
    }
  }

  // Default to financial_markets as a reasonable fallback
  return "financial_markets";
}

function formatDateForAV(dateStr: string): string {
  // Accepts ISO date strings or YYYY-MM-DD, converts to YYYYMMDDTHHMM
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}`;
  } catch {
    return "";
  }
}

function parseAVDate(timePublished: string): string {
  // Alpha Vantage format: "20231215T143000"
  try {
    const match = timePublished.match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/
    );
    if (match) {
      const [, year, month, day, hour, min, sec] = match;
      return new Date(
        `${year}-${month}-${day}T${hour}:${min}:${sec || "00"}Z`
      ).toISOString();
    }
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function searchFinanceNews(
  apiKey: string,
  topic: string,
  tickers?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<NewsArticle[]> {
  const category = mapTopicToCategory(topic);

  const params = new URLSearchParams({
    function: "NEWS_SENTIMENT",
    topics: category,
    apikey: apiKey,
  });

  if (tickers) {
    params.set("tickers", tickers);
  }

  const timeFrom = dateFrom ? formatDateForAV(dateFrom) : "";
  const timeTo = dateTo ? formatDateForAV(dateTo) : "";

  if (timeFrom) {
    params.set("time_from", timeFrom);
  }
  if (timeTo) {
    params.set("time_to", timeTo);
  }

  const url = `https://www.alphavantage.co/query?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw Object.assign(
      new Error(
        `Alpha Vantage API error: ${response.status} - ${errorText}`
      ),
      { statusCode: response.status }
    );
  }

  const json = (await response.json()) as AlphaVantageResponse;

  if (json.Error) {
    throw new Error(`Alpha Vantage API error: ${json.Error}`);
  }

  if (json.Note) {
    throw new Error(`Alpha Vantage API rate limit: ${json.Note}`);
  }

  if (json.Information) {
    throw new Error(`Alpha Vantage API info: ${json.Information}`);
  }

  const feed = json.feed || [];

  return feed.map((item) => {
    // Build content from summary + sentiment info
    let content = item.summary || "";

    content += `\n\n[Sentiment: ${item.overall_sentiment_label} (score: ${item.overall_sentiment_score})]`;

    if (item.ticker_sentiment && item.ticker_sentiment.length > 0) {
      const tickerInfo = item.ticker_sentiment
        .map(
          (ts) =>
            `${ts.ticker}: ${ts.ticker_sentiment_label} (score: ${ts.ticker_sentiment_score}, relevance: ${ts.relevance_score})`
        )
        .join("; ");
      content += `\n[Ticker Sentiment: ${tickerInfo}]`;
    }

    return {
      url: item.url || "",
      title: item.title || "Untitled",
      content,
      publishedDate: parseAVDate(item.time_published),
      isNew: true,
      source: `[AlphaVantage] ${item.source || "unknown"}`,
    };
  });
}
