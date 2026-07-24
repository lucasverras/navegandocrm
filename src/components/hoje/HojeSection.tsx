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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Badge tone={count > 0 ? "accent" : "muted"}>{count}</Badge>
      </CardHeader>
      <CardContent>
        {count === 0 ? <p className="text-sm text-muted">{emptyMessage}</p> : <div className="flex flex-col gap-2.5">{children}</div>}
      </CardContent>
    </Card>
  );
}
