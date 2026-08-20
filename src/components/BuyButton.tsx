import { useState, type ReactNode } from "react";
import { PURCHASE } from "@/data/site";

type Props = {
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
  label?: string;
};

/**
 * Single place where the purchase destination is resolved.
 * Set PURCHASE.url in src/data/site.ts to connect checkout later.
 */
export function BuyButton({ children, variant = "solid", className = "", label }: Props) {
  const [notice, setNotice] = useState(false);

  const base =
    "inline-flex items-center justify-center rounded-full px-8 py-3.5 text-xs font-medium tracking-[0.18em] uppercase transition-all duration-200 ease-out";
  const styles =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-product)]"
      : "border border-primary/25 text-primary hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]";

  if (PURCHASE.url) {
    return (
      <a href={PURCHASE.url} aria-label={label} className={`${base} ${styles} ${className}`}>
        {children}
      </a>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        aria-label={label}
        onClick={() => setNotice(true)}
        className={`${base} ${styles} ${className}`}
      >
        {children}
      </button>
      {notice && (
        <span role="status" className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {PURCHASE.unavailableMessage}
        </span>
      )}
    </span>
  );
}
