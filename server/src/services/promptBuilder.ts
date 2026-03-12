import { NewsArticle, PromptPair } from "../types/index.js";

// ─── JSON Schemas for structured output ─────────────────────

export const JSON_SCHEMAS: Record<string, { name: string; schema: Record<string, unknown> }> = {
  qa: {
    name: "qa_report",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              relatedSectors: { type: "array", items: { type: "string" } },
            },
            required: ["question", "answer", "confidence", "relatedSectors"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  stocks: {
    name: "stocks_report",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker: { type: "string" },
              company: { type: "string" },
              sector: { type: "string" },
              signal: { type: "string", enum: ["bullish", "bearish", "neutral"] },
              impactScore: { type: "number" },
              causationChain: { type: "array", items: { type: "string" } },
              reasoning: { type: "string" },
              market: { type: "string" },
              rarity: { type: "string", enum: ["obvious", "moderate", "rare", "hidden-gem"] },
            },
            required: ["ticker", "company", "sector", "signal", "impactScore", "causationChain", "reasoning", "rarity"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  graph: {
    name: "graph_report",
    schema: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: ["sector", "stock", "event", "news"] },
              signal: { type: "string", enum: ["bullish", "bearish", "neutral"] },
              impactScore: { type: "number" },
              size: { type: "number" },
              domain: { type: "string" },
              market: { type: "string" },
            },
            required: ["id", "label", "type", "signal", "impactScore"],
            additionalProperties: false,
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              target: { type: "string" },
              label: { type: "string" },
              strength: { type: "number" },
              direction: { type: "string", enum: ["positive", "negative"] },
            },
            required: ["source", "target", "label", "strength", "direction"],
            additionalProperties: false,
          },
        },
      },
      required: ["nodes", "edges"],
      additionalProperties: false,
    },
  },
  causechain: {
    name: "causechain_report",
    schema: {
      type: "object",
      properties: {
        chains: {
          type: "array",
          items: {
            type: "object",
            properties: {
              newsSource: { type: "string" },
              nodes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    type: { type: "string", enum: ["news_source", "cause", "effect", "stock_impact"] },
                    description: { type: "string" },
                    referenceUrl: { type: "string" },
                    referenceSource: { type: "string" },
                    relatedArticles: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          url: { type: "string" },
                        },
                        required: ["title", "url"],
                        additionalProperties: false,
                      },
                    },
                    impactExplanation: { type: "string" },
                  },
                  required: ["id", "label", "type", "description"],
                  additionalProperties: false,
                },
              },
              links: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    source: { type: "string" },
                    target: { type: "string" },
                    label: { type: "string" },
                    impactScore: { type: "number" },
                    direction: { type: "string", enum: ["positive", "negative"] },
                  },
                  required: ["source", "target", "label", "impactScore", "direction"],
                  additionalProperties: false,
                },
              },
            },
            required: ["newsSource", "nodes", "links"],
            additionalProperties: false,
          },
        },
      },
      required: ["chains"],
      additionalProperties: false,
    },
  },
};

function formatArticlesForPrompt(articles: NewsArticle[]): string {
  return articles
    .map(
      (a, i) =>
        `--- Article ${i + 1} ---\nTitle: ${a.title}\nSource: ${a.source || "unknown"}\nDate: ${a.publishedDate}\nURL: ${a.url}\n\n${a.content}`
    )
    .join("\n\n");
}

function marketContext(market?: string): string {
  return market ? ` Focus analysis on ${market} market context.` : "";
}

const TONE_INSTRUCTION = ` Write in a natural, conversational tone like a knowledgeable colleague explaining things plainly. Never use em dashes (—). Use commas, periods, or semicolons instead. Avoid bullet-point-style phrasing and overly formal language. Be direct and clear.`;

export function buildQAPrompt(
  articles: NewsArticle[],
  topic: string,
  location: string,
  market?: string,
): PromptPair {
  const articlesText = formatArticlesForPrompt(articles);

  const system = `You are a senior financial analyst and macroeconomist. Generate 5-8 pointed questions about the given news and provide expert-level responses with deep causation analysis. Each answer should explain causes, impacts, remedies, and alternatives. Focus on actionable insights for investors and market participants.${marketContext(market)}${TONE_INSTRUCTION}`;

  const user = `Topic: ${topic}
Location/Region: ${location}

Here are the latest news articles:

${articlesText}

Based on these articles, generate 5-8 insightful Q&A pairs analyzing the financial and economic implications.

You MUST respond with ONLY valid JSON matching this exact schema, with no markdown fences or extra text:
{
  "items": [
    {
      "question": "string",
      "answer": "string",
      "confidence": "high" | "medium" | "low",
      "relatedSectors": ["string"]
    }
  ]
}`;

  return { system, user };
}

export function buildStocksPrompt(
  articles: NewsArticle[],
  topic: string,
  location: string,
  market?: string,
  stockCount?: number,
): PromptPair {
  const articlesText = formatArticlesForPrompt(articles);
  const countInstruction = stockCount
    ? `Identify ${stockCount} specific stocks`
    : "Identify all significantly impacted stocks";
  const marketInstruction = market
    ? ` Focus on ${market} market. For India, use NSE/BSE tickers (e.g., RELIANCE.NS). For US, use NYSE/NASDAQ tickers. For Europe, use relevant local exchange tickers. Tag each stock with its market in the 'market' field.`
    : "";

  const system = `You are an equity research analyst. ${countInstruction} impacted by these news events. For each, provide a causation chain from news event through sector impact to specific stock effect. Include impact score 1-10. Focus on publicly traded companies with clear causal links to the reported events.

For each stock, also classify the insight rarity:
- "obvious": Direct, first-order impact anyone would spot (e.g., oil conflict -> oil companies)
- "moderate": Requires some sector knowledge to connect (e.g., oil conflict -> shipping costs -> logistics companies)
- "rare": Multi-step, non-obvious causation chain requiring deeper analysis (e.g., oil conflict -> LPG shortage -> restaurant closures -> electric/solar cooker manufacturers boom)
- "hidden-gem": Highly non-obvious, long-logic chain that most analysts would miss entirely (e.g., oil conflict -> cold storage demand spike due to supply chain disruption -> cold storage REITs)

Prioritize finding rare and hidden-gem insights. These long-logic, multi-step causation chains are the most valuable. Think creatively about second, third, and fourth-order effects.${marketInstruction}${TONE_INSTRUCTION}`;

  const user = `Topic: ${topic}
Location/Region: ${location}

Here are the latest news articles:

${articlesText}

${countInstruction} impacted by these news events with full causation analysis.

You MUST respond with ONLY valid JSON matching this exact schema, with no markdown fences or extra text:
{
  "items": [
    {
      "ticker": "string",
      "company": "string",
      "sector": "string",
      "signal": "bullish" | "bearish" | "neutral",
      "impactScore": 1-10,
      "causationChain": ["news event description", "sector impact", "company-specific effect"],
      "reasoning": "string",
      "market": "US" | "India" | "Europe" | "Asia",
      "rarity": "obvious" | "moderate" | "rare" | "hidden-gem"
    }
  ]
}`;

  return { system, user };
}

export function buildGraphPrompt(
  articles: NewsArticle[],
  topic: string,
  location: string,
  market?: string,
): PromptPair {
  const articlesText = formatArticlesForPrompt(articles);

  const system = `You are a financial systems analyst. Create a relationship graph showing how news events connect to sectors and stocks. Return nodes (events, sectors, stocks) and edges (causal relationships with strength 1-10 and positive/negative direction). Ensure every node has at least one edge and the graph is connected.${marketContext(market)}${TONE_INSTRUCTION}`;

  const user = `Topic: ${topic}
Location/Region: ${location}

Here are the latest news articles:

${articlesText}

Create a relationship graph mapping news events to sectors and stocks with causal connections.

You MUST respond with ONLY valid JSON matching this exact schema, with no markdown fences or extra text:
{
  "nodes": [
    {
      "id": "string",
      "label": "string",
      "type": "sector" | "stock" | "event" | "news",
      "signal": "bullish" | "bearish" | "neutral",
      "impactScore": 1-10,
      "size": 10-50,
      "domain": "company website domain for logo lookup (e.g., apple.com, tatamotors.com). Required for stock nodes, optional for others",
      "market": "market region"
    }
  ],
  "edges": [
    {
      "source": "node_id",
      "target": "node_id",
      "label": "string describing relationship",
      "strength": 1-10,
      "direction": "positive" | "negative"
    }
  ]
}`;

  return { system, user };
}

export function buildCauseChainPrompt(
  articles: NewsArticle[],
  topic: string,
  location: string,
  market?: string,
): PromptPair {
  const articlesText = formatArticlesForPrompt(articles);

  const system = `You are a financial causation analyst. For each major news event, trace the complete cause-effect chain showing how it impacts various stocks directly and indirectly. Show the path from news to cause to intermediate effects to stock impact. Each link has an impactScore (1-10) and direction (positive=green/negative=red). Group chains by their originating news source. Each chain should have at least 3-5 nodes forming a clear causal path. For news_source nodes, include the URL of the originating article and source name. For all nodes, include a detailed impact explanation. Include related article references where applicable.${marketContext(market)}${TONE_INSTRUCTION}`;

  const user = `Topic: ${topic}
Location/Region: ${location}

Here are the latest news articles:

${articlesText}

For each major news event, trace the complete cause-effect chain to stock impacts. Cover all significant chains you can identify.

You MUST respond with ONLY valid JSON matching this exact schema, with no markdown fences or extra text:
{
  "chains": [
    {
      "newsSource": "string describing the originating news event",
      "nodes": [
        {
          "id": "string",
          "label": "string",
          "type": "news_source" | "cause" | "effect" | "stock_impact",
          "description": "string",
          "referenceUrl": "URL of the originating article (required for news_source nodes)",
          "referenceSource": "name of the news source (required for news_source nodes)",
          "relatedArticles": [{"title": "string", "url": "string"}],
          "impactExplanation": "detailed explanation of the impact"
        }
      ],
      "links": [
        {
          "source": "node_id",
          "target": "node_id",
          "label": "string describing the causal relationship",
          "impactScore": 1-10,
          "direction": "positive" | "negative"
        }
      ]
    }
  ]
}`;

  return { system, user };
}

export function buildPrompt(
  reportType: "qa" | "stocks" | "graph" | "causechain",
  articles: NewsArticle[],
  topic: string,
  location: string,
  market?: string,
  stockCount?: number,
): PromptPair {
  switch (reportType) {
    case "qa":
      return buildQAPrompt(articles, topic, location, market);
    case "stocks":
      return buildStocksPrompt(articles, topic, location, market, stockCount);
    case "graph":
      return buildGraphPrompt(articles, topic, location, market);
    case "causechain":
      return buildCauseChainPrompt(articles, topic, location, market);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}
