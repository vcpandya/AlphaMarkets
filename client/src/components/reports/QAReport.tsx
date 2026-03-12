import Markdown from "react-markdown";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { QAItem } from "../../types";

interface QAReportProps {
  items: QAItem[];
}

const confidenceVariant = {
  high: "bullish" as const,
  medium: "warning" as const,
  low: "bearish" as const,
};

export function QAReport({ items }: QAReportProps) {
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <Card key={i}>
          <div className="flex items-start gap-4">
            {/* Q badge */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent text-xs font-bold shrink-0 mt-0.5">
              Q{i + 1}
            </div>

            <div className="flex-1 min-w-0">
              {/* Question */}
              <h4 className="text-sm font-semibold text-text-primary leading-relaxed mb-3">
                {item.question}
              </h4>

              {/* Answer */}
              <div className="text-sm text-text-secondary leading-relaxed prose prose-invert prose-sm max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5">
                <Markdown>{item.answer}</Markdown>
              </div>

              {/* Footer: confidence + sectors */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border">
                <Badge variant={confidenceVariant[item.confidence]} size="sm">
                  {item.confidence} confidence
                </Badge>
                {item.relatedSectors.map((sector) => (
                  <Badge key={sector} variant="default" size="sm">
                    {sector}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
