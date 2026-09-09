import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  // Rams "less but better": no uppercase kicker (the heading carries its own weight); the
  // `eyebrow` prop is accepted for compatibility but intentionally not rendered.
  void eyebrow;
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
