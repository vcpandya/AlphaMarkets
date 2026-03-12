import { Badge } from "../ui/Badge";

const LOGO_TOKEN = "pk_WIjkoWXQRRuTLaos66jxRQ";

interface NodeTooltipProps {
  x: number;
  y: number;
  visible: boolean;
  data: {
    label: string;
    type: string;
    signal?: string;
    impactScore?: number;
    description?: string;
    domain?: string;
    market?: string;
  } | null;
}

export function NodeTooltip({ x, y, visible, data }: NodeTooltipProps) {
  if (!visible || !data) return null;

  const signalVariant =
    data.signal === "bullish"
      ? "bullish"
      : data.signal === "bearish"
        ? "bearish"
        : "neutral";

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ left: x + 12, top: y - 12 }}
    >
      <div className="bg-surface-overlay border border-border rounded-lg p-3 shadow-xl shadow-black/40 max-w-[280px]">
        <div className="flex items-center gap-2.5 mb-2">
          {data.domain && (
            <img
              src={`https://img.logo.dev/${data.domain}?token=${LOGO_TOKEN}&size=32&format=png`}
              alt=""
              className="w-7 h-7 rounded-md bg-surface shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div>
            <span className="text-sm font-semibold text-text-primary block">
              {data.label}
            </span>
            {data.market && (
              <span className="text-[10px] text-text-muted">{data.market}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          <Badge size="sm" variant="default">
            {data.type}
          </Badge>
          {data.signal && (
            <Badge
              size="sm"
              variant={signalVariant as "bullish" | "bearish" | "neutral"}
            >
              {data.signal}
            </Badge>
          )}
        </div>
        {data.impactScore !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-text-muted">Impact</span>
            <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${data.impactScore * 10}%`,
                  backgroundColor:
                    data.signal === "bullish"
                      ? "#22c55e"
                      : data.signal === "bearish"
                        ? "#ef4444"
                        : "#64748b",
                }}
              />
            </div>
            <span className="text-[10px] text-text-secondary font-medium">
              {data.impactScore}/10
            </span>
          </div>
        )}
        {data.description && (
          <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>
    </div>
  );
}
