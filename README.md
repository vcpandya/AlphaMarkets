<p align="center">
  <img src="https://img.shields.io/badge/%CE%B1-AlphaMarkets-3b82f6?style=for-the-badge&labelColor=0f1117" alt="AlphaMarkets" />
</p>

<h1 align="center">AlphaMarkets</h1>

<p align="center">
  <strong>AI-powered market intelligence that finds what others miss.</strong>
</p>

<p align="center">
  Enter a topic. Get expert Q&A, stock recommendations with causation chains,<br/>
  interactive D3 visualizations, agentic deep-dive analysis, and a context-aware AI assistant.<br/>
  All powered by the LLM of your choice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite_7-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Express_5-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/D3.js-F9A03C?style=flat-square&logo=d3dotjs&logoColor=black" alt="D3" />
</p>

---

## What It Does

AlphaMarkets ingests real-time news from multiple sources, runs it through LLMs via OpenRouter, and produces four interconnected financial intelligence reports. It goes beyond first-order analysis to uncover **hidden-gem insights** through multi-step causation chains that most analysts would miss entirely.

> *Iran conflict -> LPG shortage -> restaurant closures -> electric cooker manufacturers boom*
>
> That's a hidden gem. AlphaMarkets finds those.

---

## Features

### Four Interconnected Reports

| Report | What You Get |
|--------|-------------|
| **Q&A Analysis** | 5-8 expert-level questions with deep causation analysis, confidence levels, and sector tags |
| **Stocks to Watch** | Actionable stock recommendations with signals, impact scores, causation chains, and **insight rarity classification** |
| **Impact Graph** | Interactive D3 force-directed network mapping news events to sectors and stocks with causal edges |
| **Cause Chain** | Hierarchical flow visualization tracing news through multiple orders of impact to stock-level effects |

### Insight Rarity System

Every stock recommendation is classified by how non-obvious the finding is:

| Level | Badge | Description |
|-------|-------|-------------|
| **Obvious** | `Eye` | Direct, first-order impact anyone would spot |
| **Moderate** | `Search` | Requires sector knowledge to connect the dots |
| **Rare Find** | `Sparkles` | Multi-step, non-obvious causation chain |
| **Hidden Gem** | `Gem` | Long-logic chain most analysts would miss entirely |

Filter stocks by rarity to focus on the most valuable, non-obvious insights.

### Agentic Stock Deep Dive

Click any stock tile to open a detailed analysis panel with two tabs:

- **Fundamental Analysis** - Financial health, valuation, growth prospects, risk factors, key metrics (P/E, EPS, margins, ROE), and a signal gauge
- **Technical Analysis** - Price action, support/resistance levels, momentum indicators (RSI, MACD, moving averages), volume analysis, and signal scoring

The LLM autonomously calls tools (Alpha Vantage API, web search, page reader) in an agentic loop to gather real data before producing analysis. Live progress is streamed via SSE so you see exactly what's happening. Results are cached in IndexedDB with timestamps.

### Context-Aware AI Chatbot

A floating assistant (bottom-right) that knows exactly what you're looking at:

- Aware of your current page, active tab, selected stock, loaded analysis results
- **Three explanation levels**: ELI5 (beginner-friendly), Standard, Pro (technical with LaTeX formulas)
- Full **markdown** and **LaTeX math** rendering in responses
- Tables, code blocks, and rich formatting support

### Multi-Source News Ingestion

| Source | Type | Best For |
|--------|------|----------|
| **Jina Search** | General web search | Broad news coverage across all topics and regions |
| **Alpha Vantage** | Financial news API | Finance-specific news with built-in sentiment scores |
| **Both** | Combined | Maximum coverage with URL-based deduplication |
| **Manual Sources** | URLs, file uploads, pasted text | Your own research, PDFs, paywalled articles |

### Additional Capabilities

- **Multi-market support** - US (NYSE/NASDAQ), India (NSE/BSE), Europe, Asia, Global
- **Unlimited stock count** - Leave blank to find all impacted stocks, no artificial limits
- **Fullscreen graphs** - Expand Impact Graph and Cause Chain for deep exploration (ESC to exit)
- **Export** - Download reports as HTML, PDF, or Word documents
- **Saved runs** - Persist analyses in IndexedDB, revisit from the sidebar
- **Incremental news tracking** - Previously seen articles are tagged; new articles are highlighted
- **Environment variable auto-detection** - Keys detected from your system automatically

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **npm 9+**

### 1. Clone & Install

```bash
git clone https://github.com/vcpandya/AlphaMarkets.git
cd AlphaMarkets
npm install
```

### 2. Set Up API Keys

You need at minimum an **OpenRouter** key. Jina and Alpha Vantage are recommended.

**Option A** - Environment variables (auto-detected by the app):

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export JINA_API_KEY="jina_..."
export ALPHA_VANTAGE_API_KEY="..."
```

**Option B** - Enter them in the Settings page after launching.

### 3. Launch

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend** at `http://localhost:5173`
- **Backend** at `http://localhost:3001`

### 4. Analyze

1. Open Settings and configure API keys (or click **Detect Env Variables**)
2. Go to Dashboard, enter a topic like *"Iran conflict impact on global energy markets"*
3. Select target markets and optionally add manual news sources
4. Hit **Analyze** and explore the four report tabs
5. Click any stock tile for agentic deep-dive analysis
6. Use the floating chatbot to ask follow-up questions
7. Save or export your analysis

---

## Architecture

```
AlphaMarkets/
  client/                              React 19 + Vite 7 + Tailwind CSS 4
    src/
      components/
        dashboard/                     AnalysisForm, ProgressOverlay, ReportTabs
        reports/                       QAReport, StocksReport, StockDetailView, GraphReport
        graph/                         ForceGraph, CauseChainGraph, NodeTooltip
        chat/                          FloatingChat (context-aware AI assistant)
        settings/                      SettingsPage
        layout/                        AppShell, Sidebar, TopBar
        ui/                            Button, Card, Input, Badge, Spinner
      contexts/                        ChatContext (cross-component awareness)
      hooks/                           useAnalysis, useSettings, useStockAnalysis, useSavedRuns
      services/api.ts                  API client
      lib/db.ts                        IndexedDB (saved runs, stock analysis cache)
      types/index.ts                   Shared types

  server/                              Express 5 + TypeScript
    src/
      routes/
        news.ts                        POST /api/news/search (multi-source + manual)
        analysis.ts                    POST /api/analysis/generate (structured JSON)
                                       POST /api/analysis/generate-stock-detail (agentic SSE)
                                       POST /api/analysis/chat
        content.ts                     POST /api/content/extract-url (Jina Reader)
        models.ts                      GET  /api/models
        envkeys.ts                     GET  /api/env-keys
      services/
        openRouterService.ts           LLM completions + agentic tool-use loop
        promptBuilder.ts               4 report prompts + JSON schemas
        jinaService.ts                 Jina Search & Reader APIs
        alphaVantageService.ts         Alpha Vantage news + market data
        stockDataService.ts            Financial data formatting
```

### Data Flow

```
News Sources (Jina / Alpha Vantage / Manual)
        |
        v
   Aggregation & Deduplication
        |
        v
   LLM Analysis (OpenRouter)
   - Structured JSON output (json_schema / json_object)
   - Robust JSON repair + retry
   - max_tokens: 40,000
        |
        v
   Four Report Types (parallel generation)
   Q&A  |  Stocks (with rarity)  |  Impact Graph  |  Cause Chain
        |
        v
   Interactive UI + IndexedDB Caching
        |
        v
   Stock Detail (agentic tool-use via SSE)
   - Alpha Vantage API calls
   - Web search
   - Page content extraction
   - Iterative data gathering
   - Wind-down mechanism for final response
```

### Key Technical Decisions

| Decision | Approach |
|----------|----------|
| **Structured LLM output** | Layered: `json_schema` -> `json_object` -> robust JSON repair -> retry (up to 2x) |
| **Agentic stock analysis** | Iterative tool-use loop with wind-down phase (tools removed at N-2 iterations, nudge at N-3) |
| **Real-time progress** | POST-based SSE via `fetch` + `ReadableStream` (not `EventSource`, which only supports GET) |
| **Caching** | IndexedDB with composite keys (`ticker_analysisType_model`) and ISO timestamps |
| **Styling** | Tailwind CSS v4 with `@theme {}` blocks in CSS (no `tailwind.config.js`) |
| **Chat context** | React Context propagated from Dashboard/ReportTabs/StockDetailView into system prompt |

---

## API Keys

| Service | Required | Free Tier | Get Key |
|---------|----------|-----------|---------|
| **OpenRouter** | Yes | Pay-per-use | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Jina** | Recommended | 100 req/min | [jina.ai](https://jina.ai/) |
| **Alpha Vantage** | Recommended | 25 req/day | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |

### Environment Variable Names

```
OPENROUTER_API_KEY  or  OPENROUTER_KEY
JINA_API_KEY        or  JINA_KEY
ALPHA_VANTAGE_API_KEY  or  ALPHA_VANTAGE_KEY  or  ALPHAVANTAGE_API_KEY
```

Keys are stored client-side in `localStorage` and sent per-request via headers. The server never persists keys.

---

## Design

Dark financial dashboard aesthetic inspired by Bloomberg Terminal:

| Token | Value | Usage |
|-------|-------|-------|
| `surface` | `#0f1117` | Page background |
| `surface-raised` | `#1a1d27` | Cards, panels |
| `surface-overlay` | `#242836` | Overlays, dropdowns |
| `accent` | `#3b82f6` | Interactive elements |
| `bullish` | `#22c55e` | Positive signals |
| `bearish` | `#ef4444` | Negative signals |
| `border` | `#2d3148` | Subtle borders |

Custom scrollbars, smooth transitions, responsive sidebar with collapsible navigation.

---

## Scripts

```bash
npm run dev        # Start client + server in development mode
npm run build      # Production build (client + server)
```

---

## License

MIT

---

<p align="center">
  <sub>Built for investors, analysts, and anyone who wants to understand how news moves markets.</sub>
</p>
