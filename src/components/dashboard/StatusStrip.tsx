import Link from "next/link";
import { cn } from "@/lib/utils";

export type StatusItem = {
  label: string;
  value: number;
  href: string;
};

// Dense, clickable operational status strip. Each tile links to the screen where the
// operator resolves that bucket. Non-zero buckets read as foreground; empty ones fade to muted.
export function StatusStrip({ items, totalLeads }: { items: StatusItem[]; totalLeads: number }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex flex-col gap-1 bg-surface px-4 py-4 transition-colors hover:bg-surface-2"
          >
            <span
              className={cn(
                "font-display text-3xl font-extrabold tracking-tight tabular-nums",
                item.value > 0 ? "text-foreground" : "text-muted"
              )}
            >
              {item.value}
            </span>
            <span className="text-xs text-muted transition-colors group-hover:text-foreground">{item.label}</span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        <Link href="/leads" className="font-medium text-foreground hover:text-accent-2">
          {totalLeads} restaurantes encontrados
        </Link>{" "}
        no total.
      </p>
    </div>
  );
}
