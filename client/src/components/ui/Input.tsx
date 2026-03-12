import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border border-border bg-surface-overlay px-3 py-2
            text-sm text-text-primary placeholder-text-muted
            outline-none transition-all duration-200
            focus:border-accent focus:ring-1 focus:ring-accent/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-bearish focus:border-bearish focus:ring-bearish/30" : ""}
            ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-text-muted">{hint}</p>
        )}
        {error && <p className="text-xs text-bearish">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
