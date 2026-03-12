import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glass?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  glass = false,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border transition-all duration-200
        ${glass
          ? "bg-surface-raised/60 backdrop-blur-xl"
          : "bg-surface-raised"
        }
        ${paddings[padding]}
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
