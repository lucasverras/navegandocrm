import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { eventLabel } from "@/lib/event-labels";
import { History } from "lucide-react";

type EventRow = {
  id: string;
  created_at: string;
  event_type: string;
  lead_id: string | null;
  metadata: Record<string, unknown> | null;
  leads?: { name?: string } | null;
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yst = new Date(today);
  yst.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yst)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outreach_events")
    .select("id, created_at, event_type, lead_id, metadata, leads(name)")
    .order("created_at", { ascending: false })
    .limit(300);
  const events = (data ?? []) as unknown as EventRow[];

  // Group by day, and collapse consecutive identical system events for the same lead within a day.
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = e.created_at.slice(0, 10);
    const arr = byDay.get(key) ?? [];
    const prev = arr[arr.length - 1];
    if (prev && prev.event_type === e.event_type && prev.lead_id === e.lead_id) continue; // dedupe repeats
    arr.push(e);
    byDay.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Registro" title="Histórico" subtitle="A jornada de cada lead, em linguagem humana." />

      {!events.length ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="Nenhum evento registrado" />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{dayLabel(list[0].created_at)}</h2>
              <ol className="flex flex-col border-l border-border pl-4">
                {list.map((e) => (
                  <li key={e.id} className="relative py-1.5 text-sm">
                    <span className="absolute -left-[21px] top-2.5 h-2 w-2 rounded-full bg-accent/60 ring-4 ring-background" />
                    <span className="tabular-nums text-xs text-muted">
                      {new Date(e.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>{" "}
                    {e.lead_id ? (
                      <Link href={`/leads/${e.lead_id}`} className="font-medium text-foreground hover:text-accent-2">
                        {e.leads?.name ?? "Lead"}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">Sistema</span>
                    )}
                    <span className="text-muted"> · {eventLabel(e.event_type, e.metadata)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
