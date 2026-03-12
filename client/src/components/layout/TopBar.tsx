import { Menu } from "lucide-react";

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
}

export function TopBar({ title, onMenuClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-md">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
    </header>
  );
}
