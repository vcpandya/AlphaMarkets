import { X, ExternalLink, Newspaper, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { Badge } from "../ui/Badge";
import type { CauseChainNode } from "../../types";

interface CauseChainDetailPanelProps {
  node: CauseChainNode | null;
  onClose: () => void;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Newspaper }
> = {
  news_source: { label: "News Source", color: "#8b5cf6", icon: Newspaper },
  cause: { label: "Cause", color: "#f59e0b", icon: Zap },
  effect: { label: "Effect", color: "#3b82f6", icon: AlertTriangle },
  stock_impact: { label: "Stock Impact", color: "#22c55e", icon: TrendingUp },
};

export function CauseChainDetailPanel({
  node,
  onClose,
}: CauseChainDetailPanelProps) {
  const isOpen = node !== null;
  const cfg = node ? TYPE_CONFIG[node.type] || TYPE_CONFIG.cause : TYPE_CONFIG.cause;
  const Icon = cfg.icon;

  return (
    <div
      className={`w-[400px] shrink-0 h-full bg-surface-raised border-l border-accent/30 overflow-y-auto
        transition-transform duration-300 ease-out
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      style={{ display: isOpen ? undefined : "none" }}
    >
      {node && (
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: cfg.color + "20",
                    color: cfg.color,
                    border: `1px solid ${cfg.color}40`,
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
              </div>
              <h3 className="text-lg font-bold text-text-primary leading-tight">
                {node.label}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Description
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              {node.description}
            </p>
          </div>

          {/* Reference URL */}
          {node.referenceUrl && (
            <div>
              <a
                href={node.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg
                  bg-accent/10 border border-accent/30 text-accent text-sm font-medium
                  hover:bg-accent/20 transition-colors"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  View Source Article
                  {node.referenceSource && (
                    <span className="text-accent/60 ml-1">
                      ({node.referenceSource})
                    </span>
                  )}
                </span>
              </a>
            </div>
          )}

          {/* Impact Explanation */}
          {node.impactExplanation && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Impact Analysis
              </h4>
              <div className="rounded-lg bg-surface-overlay border border-border p-3">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {node.impactExplanation}
                </p>
              </div>
            </div>
          )}

          {/* Related Articles */}
          {node.relatedArticles && node.relatedArticles.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Related Articles
              </h4>
              <div className="space-y-2">
                {node.relatedArticles.map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2.5 rounded-lg
                      bg-surface-overlay border border-border text-sm text-text-secondary
                      hover:border-accent/30 hover:text-text-primary transition-colors group"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-muted group-hover:text-accent transition-colors" />
                    <span className="leading-snug">{article.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
