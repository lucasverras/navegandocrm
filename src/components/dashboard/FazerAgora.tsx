import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export type TodoItem = {
  id: string;
  /** Lead name. */
  name: string;
  /** Short reason this is actionable, e.g. "Mensagem pronta · pronto para abordar". */
  reason: string;
  /** Button label, e.g. "Abordar" / "WhatsApp". */
  action: string;
  /** Destination — internal route or wa.me link when `external`. */
  href: string;
  /** When true, opens in a new tab (WhatsApp), else an in-app Link. */
  external?: boolean;
};

// The centerpiece: a concrete, ordered to-do list. One obvious action per row.
export function FazerAgora({ items }: { items: TodoItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-end justify-between gap-2">
        <div>
          <p className="eyebrow mb-1">Fazer agora</p>
          <CardTitle>Suas próximas ações</CardTitle>
        </div>
        <Badge tone={items.length ? "accent" : "muted"}>{items.length}</Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nada pendente agora. Bom trabalho.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 px-3.5 py-2.5"
              >
                <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/leads/${item.id}`} className="truncate font-medium text-foreground hover:text-accent-2">
                    {item.name}
                  </Link>
                  <span className="truncate text-xs text-muted">{item.reason}</span>
                </div>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button variant="secondary" size="sm">
                      {item.action}
                    </Button>
                  </a>
                ) : (
                  <Link href={item.href} className="shrink-0">
                    <Button variant="primary" size="sm">
                      {item.action}
                    </Button>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
