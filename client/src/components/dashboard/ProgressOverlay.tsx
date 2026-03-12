import { Check, Loader2, Circle, AlertCircle } from "lucide-react";
import { Card } from "../ui/Card";
import type { AnalysisProgress, ProgressStep } from "../../types";

interface ProgressOverlayProps {
  progress: AnalysisProgress;
}

function StepIcon({ status }: { status: ProgressStep["status"] }) {
  switch (status) {
    case "done":
      return <Check className="w-4 h-4 text-bullish" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-bearish" />;
    default:
      return <Circle className="w-4 h-4 text-text-muted" />;
  }
}

export function ProgressOverlay({ progress }: ProgressOverlayProps) {
  const { steps } = progress;
  const doneCount = steps.filter((s) => s.status === "done").length;
  const pct = (doneCount / steps.length) * 100;

  return (
    <Card glass className="relative overflow-hidden">
      {/* Animated progress bar at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-surface-overlay">
        <div
          className="h-full bg-gradient-to-r from-accent to-accent/60 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {pct < 100 && (
          <div className="absolute top-0 left-0 h-full w-full">
            <div className="h-full bg-accent/20 animate-pulse-glow" />
          </div>
        )}
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Analysis in Progress
          </h3>
          <span className="text-xs text-text-muted">
            {doneCount}/{steps.length} complete
          </span>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              <StepIcon status={step.status} />
              <span
                className={`text-sm transition-colors duration-200 ${
                  step.status === "running"
                    ? "text-accent font-medium"
                    : step.status === "done"
                      ? "text-text-secondary"
                      : step.status === "error"
                        ? "text-bearish"
                        : "text-text-muted"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
