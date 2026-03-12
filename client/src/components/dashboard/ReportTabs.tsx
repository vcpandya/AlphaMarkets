import { useState, useRef, useEffect } from "react";
import { useChatContext } from "../../contexts/ChatContext";
import { Globe, FileText, FileDown, ChevronDown } from "lucide-react";
import type { AnalysisResults, MarketRegion, StockRecommendation } from "../../types";
import { QAReport } from "../reports/QAReport";
import { StocksReport } from "../reports/StocksReport";
import { StockDetailView } from "../reports/StockDetailView";
import { GraphReport } from "../reports/GraphReport";
import { exportAsHTML, exportAsPDF, exportAsWord } from "../../utils/exportReport";

interface ReportTabsProps {
  results: AnalysisResults;
  markets?: MarketRegion[];
  openRouterKey: string;
  selectedModel: string;
  jinaKey?: string;
  alphaVantageKey?: string;
}

const TABS = [
  { id: "qa", label: "Q&A Analysis" },
  { id: "stocks", label: "Stocks to Watch" },
  { id: "graph", label: "Impact Graph" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReportTabs({ results, markets, openRouterKey, selectedModel, jinaKey, alphaVantageKey }: ReportTabsProps) {
  const [active, setActive] = useState<TabId>("qa");
  const { setContext } = useChatContext();
  useEffect(() => {
    setContext({ activeTab: active });
  }, [active]);
  const [selectedStock, setSelectedStock] = useState<StockRecommendation | null>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tabRefs.current.get(active);
    if (el) {
      const parent = el.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setIndicator({
          left: elRect.left - parentRect.left,
          width: elRect.width,
        });
      }
    }
  }, [active]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportOpen]);

  async function handleExport(format: "html" | "pdf" | "word") {
    setExportOpen(false);
    if (!contentRef.current) return;
    const filename = `alphamarkets-report-${Date.now()}`;
    switch (format) {
      case "html":
        await exportAsHTML(contentRef.current, filename);
        break;
      case "pdf":
        await exportAsPDF(contentRef.current, filename);
        break;
      case "word":
        await exportAsWord(contentRef.current, filename);
        break;
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="relative border-b border-border">
        <div className="flex items-center gap-0">
          <div className="flex gap-0 flex-1 relative">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                }}
                onClick={() => setActive(tab.id)}
                className={`px-5 py-3 text-sm font-medium transition-colors duration-200 relative
                  ${active === tab.id
                    ? "text-accent"
                    : "text-text-muted hover:text-text-secondary"
                  }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Sliding indicator */}
            <div
              className="absolute bottom-0 h-[2px] bg-accent transition-all duration-300 ease-out rounded-full"
              style={{ left: indicator.left, width: indicator.width }}
            />
          </div>

          {/* Export dropdown */}
          <div className="relative ml-auto" ref={exportRef}>
            <button
              onClick={() => setExportOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-muted
                hover:text-text-secondary rounded-lg hover:bg-surface-overlay transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export
              <ChevronDown className={`w-3 h-3 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-surface-raised shadow-xl shadow-black/40 py-1">
                <button
                  onClick={() => handleExport("html")}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
                >
                  <Globe className="w-4 h-4 text-text-muted" />
                  HTML
                </button>
                <button
                  onClick={() => handleExport("word")}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
                >
                  <FileText className="w-4 h-4 text-text-muted" />
                  Word
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
                >
                  <FileDown className="w-4 h-4 text-text-muted" />
                  PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-6" ref={contentRef}>
        {active === "qa" && results.qa && <QAReport items={results.qa} />}
        {active === "qa" && !results.qa && <EmptyState />}

        {active === "stocks" && results.stocks && (
          <StocksReport
            stocks={results.stocks}
            markets={markets}
            onStockClick={setSelectedStock}
          />
        )}
        {active === "stocks" && !results.stocks && <EmptyState />}

        {active === "graph" && (
          <GraphReport
            graph={results.graph}
            causechain={results.causechain}
            markets={markets}
          />
        )}
      </div>

      {selectedStock && (
        <StockDetailView
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          openRouterKey={openRouterKey}
          selectedModel={selectedModel}
          jinaKey={jinaKey}
          alphaVantageKey={alphaVantageKey}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-text-muted text-sm">
      No data available for this report yet.
    </div>
  );
}
