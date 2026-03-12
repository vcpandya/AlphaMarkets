// ─── Stock Data Service ─────────────────────────────────────
// Fetches real market data from Alpha Vantage and optional
// supplementary data via Jina Reader for LLM-grounded analysis.

const AV_BASE = "https://www.alphavantage.co/query";

// ─── Interfaces ─────────────────────────────────────────────

export interface StockQuote {
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  change: number;
  changePercent: string;
  latestTradingDay: string;
}

export interface CompanyOverview {
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  peRatio: string;
  pegRatio: string;
  eps: string;
  dividendYield: string;
  profitMargin: string;
  returnOnEquity: string;
  revenueGrowth: string;
  earningsGrowth: string;
  analystTargetPrice: string;
  beta: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
  fiftyDayMA: string;
  twoHundredDayMA: string;
  forwardPE: string;
  priceToBook: string;
  priceToSales: string;
  evToEBITDA: string;
}

export interface TechnicalIndicators {
  rsi: { date: string; value: number }[];
  macd: { date: string; macd: number; signal: number; histogram: number }[];
  recentPrices: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

export interface StockData {
  quote: StockQuote | null;
  overview: CompanyOverview | null;
  technicals: TechnicalIndicators | null;
}

// ─── Alpha Vantage response types ──────────────────────────

interface AVRateLimited {
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

// ─── Helpers ────────────────────────────────────────────────

function avUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${AV_BASE}?${qs}`;
}

function isRateLimited(json: AVRateLimited): string | null {
  if (json.Note) return json.Note;
  if (json.Information) return json.Information;
  if (json["Error Message"]) return json["Error Message"];
  return null;
}

function safeNum(val: string | undefined | null): number {
  if (!val || val === "None" || val === "-") return 0;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function safeStr(val: string | undefined | null): string {
  return val && val !== "None" ? val : "N/A";
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toLocaleString();
}

// ─── Individual fetchers ────────────────────────────────────

async function fetchQuote(
  ticker: string,
  apiKey: string,
): Promise<StockQuote | null> {
  const url = avUrl({
    function: "GLOBAL_QUOTE",
    symbol: ticker,
    apikey: apiKey,
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const limited = isRateLimited(json as AVRateLimited);
  if (limited) {
    console.warn(`[stockDataService] GLOBAL_QUOTE rate limited: ${limited}`);
    return null;
  }

  const gq = json["Global Quote"];
  if (!gq || Object.keys(gq).length === 0) return null;

  return {
    price: safeNum(gq["05. price"]),
    open: safeNum(gq["02. open"]),
    high: safeNum(gq["03. high"]),
    low: safeNum(gq["04. low"]),
    volume: safeNum(gq["06. volume"]),
    previousClose: safeNum(gq["08. previous close"]),
    change: safeNum(gq["09. change"]),
    changePercent: safeStr(gq["10. change percent"]),
    latestTradingDay: safeStr(gq["07. latest trading day"]),
  };
}

async function fetchOverview(
  ticker: string,
  apiKey: string,
): Promise<CompanyOverview | null> {
  const url = avUrl({
    function: "OVERVIEW",
    symbol: ticker,
    apikey: apiKey,
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return null;

  const json = await res.json();
  const limited = isRateLimited(json as AVRateLimited);
  if (limited) {
    console.warn(`[stockDataService] OVERVIEW rate limited: ${limited}`);
    return null;
  }

  if (!json.Symbol) return null;

  return {
    description: safeStr(json.Description),
    sector: safeStr(json.Sector),
    industry: safeStr(json.Industry),
    marketCap: safeStr(json.MarketCapitalization),
    peRatio: safeStr(json.PERatio),
    pegRatio: safeStr(json.PEGRatio),
    eps: safeStr(json.EPS),
    dividendYield: safeStr(json.DividendYield),
    profitMargin: safeStr(json.ProfitMargin),
    returnOnEquity: safeStr(json.ReturnOnEquityTTM),
    revenueGrowth: safeStr(json.QuarterlyRevenueGrowthYOY),
    earningsGrowth: safeStr(json.QuarterlyEarningsGrowthYOY),
    analystTargetPrice: safeStr(json.AnalystTargetPrice),
    beta: safeStr(json.Beta),
    fiftyTwoWeekHigh: safeStr(json["52WeekHigh"]),
    fiftyTwoWeekLow: safeStr(json["52WeekLow"]),
    fiftyDayMA: safeStr(json["50DayMovingAverage"]),
    twoHundredDayMA: safeStr(json["200DayMovingAverage"]),
    forwardPE: safeStr(json.ForwardPE),
    priceToBook: safeStr(json.PriceToBookRatio),
    priceToSales: safeStr(json.PriceToSalesRatioTTM),
    evToEBITDA: safeStr(json.EVToEBITDA),
  };
}

async function fetchRSI(
  ticker: string,
  apiKey: string,
): Promise<{ date: string; value: number }[]> {
  const url = avUrl({
    function: "RSI",
    symbol: ticker,
    interval: "daily",
    time_period: "14",
    series_type: "close",
    apikey: apiKey,
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const limited = isRateLimited(json as AVRateLimited);
  if (limited) {
    console.warn(`[stockDataService] RSI rate limited: ${limited}`);
    return [];
  }

  const series = json["Technical Analysis: RSI"];
  if (!series) return [];

  const dates = Object.keys(series).sort().reverse().slice(0, 5);
  return dates.map((date) => ({
    date,
    value: safeNum(series[date]?.RSI),
  }));
}

async function fetchMACD(
  ticker: string,
  apiKey: string,
): Promise<{ date: string; macd: number; signal: number; histogram: number }[]> {
  const url = avUrl({
    function: "MACD",
    symbol: ticker,
    interval: "daily",
    series_type: "close",
    apikey: apiKey,
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const limited = isRateLimited(json as AVRateLimited);
  if (limited) {
    console.warn(`[stockDataService] MACD rate limited: ${limited}`);
    return [];
  }

  const series = json["Technical Analysis: MACD"];
  if (!series) return [];

  const dates = Object.keys(series).sort().reverse().slice(0, 5);
  return dates.map((date) => ({
    date,
    macd: safeNum(series[date]?.MACD),
    signal: safeNum(series[date]?.MACD_Signal),
    histogram: safeNum(series[date]?.MACD_Hist),
  }));
}

async function fetchDailyPrices(
  ticker: string,
  apiKey: string,
): Promise<
  { date: string; open: number; high: number; low: number; close: number; volume: number }[]
> {
  const url = avUrl({
    function: "TIME_SERIES_DAILY",
    symbol: ticker,
    outputsize: "compact",
    apikey: apiKey,
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const limited = isRateLimited(json as AVRateLimited);
  if (limited) {
    console.warn(`[stockDataService] TIME_SERIES_DAILY rate limited: ${limited}`);
    return [];
  }

  const series = json["Time Series (Daily)"];
  if (!series) return [];

  const dates = Object.keys(series).sort().reverse().slice(0, 20);
  return dates.map((date) => ({
    date,
    open: safeNum(series[date]?.["1. open"]),
    high: safeNum(series[date]?.["2. high"]),
    low: safeNum(series[date]?.["3. low"]),
    close: safeNum(series[date]?.["4. close"]),
    volume: safeNum(series[date]?.["5. volume"]),
  }));
}

// ─── Main export: fetch all stock data in parallel ──────────

export async function fetchStockData(
  ticker: string,
  alphaVantageKey: string,
): Promise<StockData> {
  if (!alphaVantageKey) {
    return { quote: null, overview: null, technicals: null };
  }

  const upperTicker = ticker.toUpperCase().trim();

  const [quoteResult, overviewResult, rsiResult, macdResult, pricesResult] =
    await Promise.allSettled([
      fetchQuote(upperTicker, alphaVantageKey),
      fetchOverview(upperTicker, alphaVantageKey),
      fetchRSI(upperTicker, alphaVantageKey),
      fetchMACD(upperTicker, alphaVantageKey),
      fetchDailyPrices(upperTicker, alphaVantageKey),
    ]);

  const quote =
    quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const overview =
    overviewResult.status === "fulfilled" ? overviewResult.value : null;

  const rsi =
    rsiResult.status === "fulfilled" ? rsiResult.value : [];
  const macd =
    macdResult.status === "fulfilled" ? macdResult.value : [];
  const recentPrices =
    pricesResult.status === "fulfilled" ? pricesResult.value : [];

  const hasTechnicals = rsi.length > 0 || macd.length > 0 || recentPrices.length > 0;

  return {
    quote,
    overview,
    technicals: hasTechnicals ? { rsi, macd, recentPrices } : null,
  };
}

// ─── Format stock data into a text summary for the LLM ─────

export function formatStockDataForPrompt(data: StockData): string {
  const sections: string[] = [];

  // Current price
  if (data.quote) {
    const q = data.quote;
    const lines = [
      "=== CURRENT PRICE ===",
      `Price: $${q.price.toFixed(2)} | Change: ${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)} (${q.changePercent})`,
      `Open: $${q.open.toFixed(2)} | High: $${q.high.toFixed(2)} | Low: $${q.low.toFixed(2)}`,
      `Volume: ${formatVolume(q.volume)} | Previous Close: $${q.previousClose.toFixed(2)}`,
      `Latest Trading Day: ${q.latestTradingDay}`,
    ];
    sections.push(lines.join("\n"));
  }

  // Company fundamentals
  if (data.overview) {
    const o = data.overview;
    const marketCapFormatted = formatMarketCap(o.marketCap);
    const lines = [
      "=== COMPANY FUNDAMENTALS ===",
      `Sector: ${o.sector} | Industry: ${o.industry}`,
      `Market Cap: ${marketCapFormatted} | P/E: ${o.peRatio} | Forward P/E: ${o.forwardPE}`,
      `EPS: $${o.eps} | PEG: ${o.pegRatio} | P/B: ${o.priceToBook} | P/S: ${o.priceToSales}`,
      `EV/EBITDA: ${o.evToEBITDA} | Beta: ${o.beta}`,
      `Dividend Yield: ${o.dividendYield} | Profit Margin: ${o.profitMargin}`,
      `Return on Equity: ${o.returnOnEquity}`,
      `Revenue Growth (QoQ): ${o.revenueGrowth} | Earnings Growth (QoQ): ${o.earningsGrowth}`,
      `Analyst Target Price: $${o.analystTargetPrice}`,
    ];
    sections.push(lines.join("\n"));
  }

  // Technical indicators
  if (data.technicals) {
    const t = data.technicals;
    const lines: string[] = ["=== TECHNICAL INDICATORS ==="];

    if (t.rsi.length > 0) {
      const current = t.rsi[0];
      const previous = t.rsi.slice(1, 3).map((r) => r.value.toFixed(1)).join(", ");
      lines.push(
        `RSI (14): ${current.value.toFixed(1)}${previous ? ` (previous: ${previous})` : ""}`,
      );
    }

    if (t.macd.length > 0) {
      const current = t.macd[0];
      lines.push(
        `MACD: ${current.macd.toFixed(2)} | Signal: ${current.signal.toFixed(2)} | Histogram: ${current.histogram.toFixed(2)}`,
      );
    }

    if (data.overview) {
      lines.push(
        `50-day MA: $${data.overview.fiftyDayMA} | 200-day MA: $${data.overview.twoHundredDayMA}`,
      );
      lines.push(
        `52-week High: $${data.overview.fiftyTwoWeekHigh} | 52-week Low: $${data.overview.fiftyTwoWeekLow}`,
      );
    }

    sections.push(lines.join("\n"));

    // Recent price action (last 5 days)
    if (t.recentPrices.length > 0) {
      const priceLines = ["=== RECENT PRICE ACTION (Last 5 Days) ==="];
      const display = t.recentPrices.slice(0, 5);
      for (const p of display) {
        priceLines.push(
          `${p.date}: O:${p.open.toFixed(2)} H:${p.high.toFixed(2)} L:${p.low.toFixed(2)} C:${p.close.toFixed(2)} V:${formatVolume(p.volume)}`,
        );
      }
      sections.push(priceLines.join("\n"));
    }
  }

  if (sections.length === 0) {
    return "No stock data available.";
  }

  return sections.join("\n\n");
}

function formatMarketCap(raw: string): string {
  if (raw === "N/A") return "N/A";
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

// ─── Jina Reader: supplementary financial page scraping ─────

export async function scrapeFinancialPage(
  ticker: string,
  jinaKey: string,
): Promise<string | null> {
  if (!jinaKey) return null;

  const targetUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(ticker.toUpperCase().trim())}/`;
  const jinaUrl = `https://r.jina.ai/${targetUrl}`;

  try {
    const res = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jinaKey}`,
        Accept: "text/plain",
      },
    });

    if (!res.ok) return null;

    const text = await res.text();
    if (!text || text.length === 0) return null;

    // Trim to first 3000 chars to save tokens
    return text.slice(0, 3000);
  } catch (err) {
    console.warn(
      `[stockDataService] Failed to scrape financial page for ${ticker}:`,
      err,
    );
    return null;
  }
}
