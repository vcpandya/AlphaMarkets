import { RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";

interface GraphControlsProps {
  sectors: string[];
  selectedSectors: Set<string>;
  onToggleSector: (sector: string) => void;
  onResetZoom: () => void;
}

export function GraphControls({
  sectors,
  selectedSectors,
  onToggleSector,
  onResetZoom,
}: GraphControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <span className="text-xs text-text-muted uppercase tracking-wider">
        Filter:
      </span>
      {sectors.map((s) => {
        const active = selectedSectors.size === 0 || selectedSectors.has(s);
        return (
          <button
            key={s}
            onClick={() => onToggleSector(s)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-all duration-200
              ${active
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-surface-overlay text-text-muted hover:text-text-secondary"
              }`}
          >
            {s}
          </button>
        );
      })}
      <div className="ml-auto">
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={onResetZoom}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
