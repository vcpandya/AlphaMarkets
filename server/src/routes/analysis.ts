import { Router, Request, Response, NextFunction } from "express";
import { validateOpenRouterKey } from "../middleware/validateKeys.js";
import {
  chatCompletion,
  agenticCompletion,
  ToolDefinition,
} from "../services/openRouterService.js";
import { buildPrompt, JSON_SCHEMAS } from "../services/promptBuilder.js";
import { AnalysisRequest } from "../types/index.js";

const router = Router();

const MAX_RETRIES = 2;

/**
 * Attempt to parse JSON from an LLM response, handling common issues
 * like markdown fences, trailing commas, and truncated output.
 */
function robustJsonParse(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?\s*```\s*$/i, "");
  cleaned = cleaned.trim();

  // First attempt: direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue to repair attempts
  }

  // Remove trailing commas before closing brackets/braces
  const noTrailingCommas = cleaned.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(noTrailingCommas);
  } catch {
    // Continue
  }

  // Try to find the outermost JSON structure (array or object)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0].replace(/,\s*([\]}])/g, "$1"));
    } catch {
      // Continue
    }
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0].replace(/,\s*([\]}])/g, "$1"));
    } catch {
      // Continue
    }
  }

  // Truncation repair: count open/close brackets and try to close them
  // This handles deeply nested structures like causechain that get cut off
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    let repaired = cleaned;

    // Trim back to the last complete key-value or array element
    // Remove any trailing partial string (unterminated quote)
    const lastQuoteCount = (repaired.match(/"/g) || []).length;
    if (lastQuoteCount % 2 !== 0) {
      // Odd number of quotes — there's an unterminated string
      const lastQuoteIdx = repaired.lastIndexOf('"');
      // Find the key start (the quote before this value quote)
      const keyStart = repaired.lastIndexOf('"', lastQuoteIdx - 1);
      if (keyStart > 0) {
        // Back up to before this key-value pair
        const commaOrBrace = repaired.lastIndexOf(",", keyStart);
        const openBrace = repaired.lastIndexOf("{", keyStart);
        const openBracket = repaired.lastIndexOf("[", keyStart);
        const cutPoint = Math.max(commaOrBrace, openBrace, openBracket);
        if (cutPoint > 0) {
          repaired = repaired.substring(0, cutPoint + 1);
        }
      }
    }

    // Remove any trailing comma
    repaired = repaired.replace(/,\s*$/, "");

    // Count unmatched brackets and close them
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escape = false;
    for (const ch of repaired) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
      else if (ch === "[") openBrackets++;
      else if (ch === "]") openBrackets--;
    }

    // Close unclosed brackets/braces in reverse order
    // We need to re-scan to know the order they were opened
    const stack: string[] = [];
    inString = false;
    escape = false;
    for (const ch of repaired) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }

    if (stack.length > 0) {
      repaired += stack.reverse().join("");
      try {
        return JSON.parse(repaired.replace(/,\s*([\]}])/g, "$1"));
      } catch {
        // Give up
      }
    }
  }

  throw new Error(
    "Failed to parse JSON from LLM response. Raw output starts with: " +
      cleaned.substring(0, 200)
  );
}

/**
 * Unwrap structured output: for qa/stocks the schema wraps the array
 * in { items: [...] }. If the model returns this wrapper, extract the array.
 * Also handles cases where the model returns a bare array (fallback).
 */
function unwrapResponse(reportType: string, parsed: unknown): unknown {
  if (reportType === "qa" || reportType === "stocks") {
    // If it's already a bare array (from models that ignore json_schema), use as-is
    if (Array.isArray(parsed)) return parsed;
    // Unwrap { items: [...] } wrapper
    if (parsed && typeof parsed === "object" && "items" in parsed) {
      return (parsed as { items: unknown }).items;
    }
  }
  return parsed;
}

router.post(
  "/generate",
  validateOpenRouterKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { model, articles, topic, location, reportType, market, stockCount } =
        req.body as AnalysisRequest;

      if (!model) {
        res.status(400).json({ error: "Missing required field: model" });
        return;
      }
      if (!articles || articles.length === 0) {
        res.status(400).json({ error: "No articles provided for analysis" });
        return;
      }
      if (!reportType) {
        res.status(400).json({ error: "Missing required field: reportType" });
        return;
      }

      const validTypes = ["qa", "stocks", "graph", "causechain"];
      if (!validTypes.includes(reportType)) {
        res.status(400).json({
          error: `Invalid reportType: ${reportType}. Must be one of: ${validTypes.join(", ")}`,
        });
        return;
      }

      const prompt = buildPrompt(reportType, articles, topic, location, market, stockCount);
      const schema = JSON_SCHEMAS[reportType];

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const rawResponse = await chatCompletion(
            req.openRouterKey!,
            model,
            [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.user },
            ],
            {
              jsonMode: true,
              jsonSchema: schema,
            },
          );

          const parsed = robustJsonParse(rawResponse);
          const data = unwrapResponse(reportType, parsed);

          res.json({ reportType, data });
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // Only retry on parse failures, not API errors
          const isParseError = lastError.message.includes("Failed to parse JSON");
          if (!isParseError || attempt === MAX_RETRIES) {
            throw lastError;
          }
          // Retry with a slightly higher temperature hint won't help —
          // the structured output constraint should handle it on retry
        }
      }

      throw lastError;
    } catch (err) {
      next(err);
    }
  }
);

// ─── Tool definitions for agentic stock analysis ────────────

const STOCK_ANALYSIS_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "alpha_vantage",
      description:
        "Query Alpha Vantage financial API. Supports functions: GLOBAL_QUOTE (current price), OVERVIEW (company fundamentals like P/E, market cap, EPS, margins, growth), RSI (relative strength index), MACD (moving average convergence divergence), TIME_SERIES_DAILY (recent OHLCV prices), INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW, EARNINGS. Pass the function name and any extra params.",
      parameters: {
        type: "object",
        properties: {
          function_name: {
            type: "string",
            description: "Alpha Vantage function name, e.g. GLOBAL_QUOTE, OVERVIEW, RSI, MACD, TIME_SERIES_DAILY, INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW, EARNINGS",
          },
          symbol: {
            type: "string",
            description: "Stock ticker symbol, e.g. AAPL, RELIANCE.BSE",
          },
          extra_params: {
            type: "object",
            description: "Additional query params like interval, time_period, series_type, outputsize",
            additionalProperties: { type: "string" },
          },
        },
        required: ["function_name", "symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for any query. Use this to find recent news, analyst reports, market sentiment, earnings calls, or any financial information not available through Alpha Vantage.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query, e.g. 'AAPL Q4 2024 earnings results', 'Tesla price target analysts 2024'",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_webpage",
      description:
        "Read and extract content from a specific URL. Use this to read full articles, financial reports, or data pages you found via search.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL to read",
          },
        },
        required: ["url"],
      },
    },
  },
];

// ─── Tool execution ─────────────────────────────────────────

const AV_BASE = "https://www.alphavantage.co/query";

async function executeStockTool(
  name: string,
  args: Record<string, unknown>,
  apiKeys: { alphaVantage?: string; jina?: string },
): Promise<string> {
  switch (name) {
    case "alpha_vantage": {
      const avKey = apiKeys.alphaVantage;
      if (!avKey) return "Alpha Vantage API key not configured. Try web_search instead.";

      const fnName = args.function_name as string;
      const symbol = args.symbol as string;
      const extra = (args.extra_params || {}) as Record<string, string>;

      const params: Record<string, string> = {
        function: fnName,
        symbol,
        apikey: avKey,
        ...extra,
      };

      // Sensible defaults for technical indicators
      if (fnName === "RSI" && !extra.interval) params.interval = "daily";
      if (fnName === "RSI" && !extra.time_period) params.time_period = "14";
      if (fnName === "RSI" && !extra.series_type) params.series_type = "close";
      if (fnName === "MACD" && !extra.interval) params.interval = "daily";
      if (fnName === "MACD" && !extra.series_type) params.series_type = "close";
      if (fnName === "TIME_SERIES_DAILY" && !extra.outputsize) params.outputsize = "compact";

      const url = `${AV_BASE}?${new URLSearchParams(params).toString()}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return `Alpha Vantage error: HTTP ${res.status}`;

      const json = await res.json();

      // Check rate limit
      if (json.Note || json.Information) {
        return `Alpha Vantage rate limited: ${json.Note || json.Information}. Try again in a minute or use web_search.`;
      }
      if (json["Error Message"]) {
        return `Alpha Vantage error: ${json["Error Message"]}`;
      }

      // Return trimmed JSON (limit to 4000 chars to manage context)
      const text = JSON.stringify(json, null, 2);
      return text.length > 4000 ? text.slice(0, 4000) + "\n... (truncated)" : text;
    }

    case "web_search": {
      const jinaKey = apiKeys.jina;
      if (!jinaKey) return "Jina search API key not configured.";

      const query = args.query as string;
      const url = `https://s.jina.ai/${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${jinaKey}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) return `Search error: HTTP ${res.status}`;

      const json = await res.json() as { data?: { title: string; url: string; content: string }[] };
      const results = (json.data || []).slice(0, 5);

      if (results.length === 0) return "No search results found.";

      return results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${(r.content || "").slice(0, 800)}`,
        )
        .join("\n\n---\n\n");
    }

    case "read_webpage": {
      const jinaKey = apiKeys.jina;
      if (!jinaKey) return "Jina reader API key not configured.";

      const pageUrl = args.url as string;
      const res = await fetch(`https://r.jina.ai/${pageUrl}`, {
        headers: {
          Authorization: `Bearer ${jinaKey}`,
          Accept: "text/plain",
        },
      });

      if (!res.ok) return `Failed to read page: HTTP ${res.status}`;

      const text = await res.text();
      return text.slice(0, 5000) || "Page returned empty content.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ─── Stock detail endpoint (agentic, SSE-based) ──────────────

router.post(
  "/generate-stock-detail",
  validateOpenRouterKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { model, stock, analysisType } = req.body;

      if (!model || !stock || !analysisType) {
        res.status(400).json({ error: "Missing required fields: model, stock, analysisType" });
        return;
      }

      if (analysisType !== "fundamental" && analysisType !== "technical") {
        res.status(400).json({ error: "analysisType must be 'fundamental' or 'technical'" });
        return;
      }

      const alphaVantageKey = req.headers["x-alphavantage-key"] as string | undefined;
      const jinaKey = req.headers["x-jina-key"] as string | undefined;

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      function sendEvent(event: { type: string; message: string; detail?: string; data?: unknown }) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      // Build prompts based on analysisType
      const system = analysisType === "fundamental"
        ? `You are a senior equity research analyst with access to real-time financial tools. Your job is to produce a thorough FUNDAMENTAL analysis of a stock.

IMPORTANT: You MUST use the available tools to gather real data before writing your analysis. Do not guess or make up numbers. Use the tools to get:
1. Current price and quote data (alpha_vantage GLOBAL_QUOTE)
2. Company fundamentals: P/E, EPS, margins, market cap, revenue growth, ROE (alpha_vantage OVERVIEW)
3. Income statement data (alpha_vantage INCOME_STATEMENT)
4. Balance sheet data (alpha_vantage BALANCE_SHEET)
5. Cash flow data (alpha_vantage CASH_FLOW)
6. Earnings history (alpha_vantage EARNINGS)
7. Recent news, analyst price targets, and earnings reports (web_search)
8. Any additional data you think is relevant (read_webpage for details)

Focus your analysis on:
- Company overview and business model
- Financial statements (income, balance sheet, cash flow)
- Valuation metrics (P/E, P/B, P/S, EV/EBITDA)
- Growth metrics, margins, ROE
- Risk factors
- Analyst targets

Make multiple tool calls as needed. Once you have enough data, produce your final analysis.

Write in a natural, conversational tone. Never use em dashes. Be specific with actual numbers from the data you retrieved.`
        : `You are a senior technical analyst with access to real-time financial tools. Your job is to produce a thorough TECHNICAL analysis of a stock.

IMPORTANT: You MUST use the available tools to gather real data before writing your analysis. Do not guess or make up numbers. Use the tools to get:
1. Current price and quote data (alpha_vantage GLOBAL_QUOTE)
2. RSI indicator (alpha_vantage RSI)
3. MACD indicator (alpha_vantage MACD)
4. Recent daily price history for support/resistance and moving averages (alpha_vantage TIME_SERIES_DAILY)
5. Recent news or chart analysis (web_search)
6. Any additional technical data you think is relevant

Focus your analysis on:
- Price action and trends
- RSI and MACD indicators
- Support and resistance levels
- Volume analysis
- Moving averages (50-day, 200-day)

Make multiple tool calls as needed. Once you have enough data, produce your final analysis.

Write in a natural, conversational tone. Never use em dashes. Be specific with actual numbers from the data you retrieved.`;

      const userPrompt = analysisType === "fundamental"
        ? `Analyze the fundamentals of this stock:

Stock: ${stock.ticker} - ${stock.company}
Sector: ${stock.sector}
Current Signal: ${stock.signal}
Impact Score: ${stock.impactScore}/10
Market: ${stock.market || "Global"}
News Context: ${(stock.causationChain || []).join(" -> ")}
Reasoning: ${stock.reasoning || "N/A"}

First, use the tools to gather real fundamental data for ${stock.ticker}. Then produce your final analysis as JSON with this exact structure:
{
  "overview": "2-3 sentences about the company, its business model, and market position with real metrics",
  "financialHealth": "2-3 sentences on financial health based on actual balance sheet and cash flow data",
  "valuation": "2-3 sentences on valuation with real P/E, P/B, P/S, EV/EBITDA ratios",
  "growthProspects": "2-3 sentences on growth outlook with actual revenue/earnings growth numbers",
  "riskFactors": "2-3 sentences on key risks with supporting data",
  "metrics": {
    "price": "$XX.XX",
    "change": "+X.XX%",
    "marketCap": "$X.XB",
    "peRatio": "XX.X",
    "eps": "$X.XX",
    "dividendYield": "X.X%",
    "fiftyTwoWeekHigh": "$XX.XX",
    "fiftyTwoWeekLow": "$XX.XX",
    "analystTarget": "$XX.XX",
    "profitMargin": "XX.X%",
    "revenueGrowth": "XX.X%",
    "returnOnEquity": "XX.X%"
  },
  "signalScore": 7,
  "signalLabel": "Buy"
}

signalScore is an integer from 1-10. signalLabel must be one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell".
Fill in all metrics with real data from the tools. Use "N/A" if a metric is unavailable.
You MUST respond with ONLY valid JSON when you are done researching. No markdown fences.`
        : `Analyze the technicals of this stock:

Stock: ${stock.ticker} - ${stock.company}
Sector: ${stock.sector}
Current Signal: ${stock.signal}
Impact Score: ${stock.impactScore}/10
Market: ${stock.market || "Global"}
News Context: ${(stock.causationChain || []).join(" -> ")}
Reasoning: ${stock.reasoning || "N/A"}

First, use the tools to gather real technical data for ${stock.ticker}. Then produce your final analysis as JSON with this exact structure:
{
  "priceAction": "2-3 sentences on recent price action and trends with actual prices",
  "supportResistance": "2-3 sentences on support and resistance levels from real price data",
  "momentum": "2-3 sentences on RSI, MACD with actual indicator values",
  "volume": "2-3 sentences on volume analysis with real numbers",
  "recommendation": "2-3 sentences with a trading recommendation and specific price targets",
  "indicators": {
    "rsi": "XX.X",
    "rsiSignal": "neutral",
    "macd": "X.XX",
    "macdSignal": "bullish",
    "fiftyDayMA": "$XX.XX",
    "twoHundredDayMA": "$XX.XX",
    "trend": "uptrend",
    "volumeTrend": "increasing"
  },
  "support": ["$XX.XX", "$XX.XX"],
  "resistance": ["$XX.XX", "$XX.XX"],
  "signalScore": 7,
  "signalLabel": "Buy"
}

signalScore is an integer from 1-10. signalLabel must be one of: "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell".
rsiSignal must be one of: "oversold", "neutral", "overbought".
macdSignal must be one of: "bullish", "bearish", "neutral".
trend must be one of: "uptrend", "downtrend", "sideways".
volumeTrend must be one of: "increasing", "decreasing", "stable".
Fill in all indicators with real data from the tools. Use "N/A" if a value is unavailable.
You MUST respond with ONLY valid JSON when you are done researching. No markdown fences.`;

      const rawResponse = await agenticCompletion(
        req.openRouterKey!,
        model,
        [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        STOCK_ANALYSIS_TOOLS,
        (toolName, toolArgs) =>
          executeStockTool(toolName, toolArgs, {
            alphaVantage: alphaVantageKey,
            jina: jinaKey,
          }),
        {
          maxIterations: 10,
          jsonMode: true,
          onProgress: sendEvent,
        },
      );

      const parsed = robustJsonParse(rawResponse);
      sendEvent({ type: "result", message: "Analysis complete", data: parsed });
      res.end();
    } catch (err) {
      // For SSE, send error as an event then end
      const message = err instanceof Error ? err.message : "Unknown error";
      res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      res.end();
    }
  },
);

// ─── Chat endpoint ──────────────────────────────────────────

router.post(
  "/chat",
  validateOpenRouterKey,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { model, messages } = req.body;

      if (!model || !messages) {
        res.status(400).json({ error: "Missing required fields: model, messages" });
        return;
      }

      const rawResponse = await chatCompletion(
        req.openRouterKey!,
        model,
        messages,
        {},
      );

      res.json({ content: rawResponse });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
