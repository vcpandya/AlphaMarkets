import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "bullish" | "bearish" | "neutral" | "accent" | "warning";
  size?: "sm" | "md";
  className?: string;
}

const variantClasses = {
  default: "bg-surface-overlay text-text-secondary border-border",
  bullish: "bg-bullish/10 text-bullish border-bullish/30",
  bearish: "bg-bearish/10 text-bearish border-bearish/30",
  neutral: "bg-neutral-tone/10 text-neutral-tone border-neutral-tone/30",
  accent: "bg-accent/10 text-accent border-accent/30",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
