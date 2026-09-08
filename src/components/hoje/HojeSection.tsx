import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function HojeSection({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}) {
  // Empty sections collapse to a single quiet line so the sections that actually need action
  // surface immediately — no stack of large "0" cards pushing real work down.
  if (count === 0) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-1 py-2.5" title={emptyMessage}>
        <span className="text-sm text-muted">{title}</span>
        <span className="tabular-nums text-xs text-muted/70">0</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Badge tone="accent">{count}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2.5">{children}</div>
      </CardContent>
    </Card>
  );
}
