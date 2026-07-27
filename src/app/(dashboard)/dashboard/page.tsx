import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeading } from "@/components/ui/PageHeading";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: regionsCount },
    { count: leadsCount },
    { count: analyzedCount },
    { count: strongOpportunities },
    { count: decisionMakersFound },
    { count: messagesGenerated },
    { count: messagesSent },
    { count: meetingsScheduled },
    { count: discardedCount },
    { data: leadsByCategory },
    { data: topLeads },
    { data: recentEvents },
  ] = await Promise.all([
    supabase.from("regions").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("lead_analysis").select("id", { count: "exact", head: true }),
    supabase.from("lead_analysis").select("id", { count: "exact", head: true }).gte("opportunity_score", 70),
    supabase.from("decision_makers").select("id", { count: "exact", head: true }).eq("found", true),
    supabase.from("outreach_messages").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("commercial_status", "message_sent"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("commercial_status", "meeting_scheduled"),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_status", "not_interested"),
    supabase.from("leads").select("category"),
    supabase.from("leads").select("id, name, pre_score, ai_score").order("pre_score", { ascending: false }).limit(5),
    supabase.from("outreach_events").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  const categoryTally = new Map<string, number>();
  for (const row of (leadsByCategory ?? []) as { category: string }[]) {
    categoryTally.set(row.category, (categoryTally.get(row.category) ?? 0) + 1);
  }
  const categoryData = Array.from(categoryTally.entries()).map(([name, value]) => ({ name, value }));

  const stats = [
    { label: "Regiões pesquisadas", value: regionsCount ?? 0 },
    { label: "Restaurantes encontrados", value: leadsCount ?? 0 },
    { label: "Leads analisados", value: analyzedCount ?? 0 },
    { label: "Oportunidades fortes", value: strongOpportunities ?? 0 },
    { label: "Decisores encontrados", value: decisionMakersFound ?? 0 },
    { label: "Mensagens geradas", value: messagesGenerated ?? 0 },
    { label: "Mensagens enviadas", value: messagesSent ?? 0 },
    { label: "Reuniões marcadas", value: meetingsScheduled ?? 0 },
    { label: "Leads descartados", value: discardedCount ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Visão geral" title="Funil de prospecção" subtitle="O movimento real por trás dos números: leads, oportunidades e conversas em andamento." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent to-accent-2" />
            <CardContent className="pt-5">
              <p className="font-display text-3xl font-extrabold tracking-tight text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs text-muted">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardCharts categoryData={categoryData} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads com maior nota</CardTitle>
          </CardHeader>
          <CardContent>
            {!topLeads?.length ? (
              <p className="text-sm text-muted">Nenhum lead ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {(topLeads as { id: string; name: string; pre_score: number; ai_score: number | null }[]).map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span>{lead.name}</span>
                    <span className="text-muted">
                      pré {lead.pre_score} {lead.ai_score != null ? `· ia ${lead.ai_score}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentEvents?.length ? (
              <p className="text-sm text-muted">Nenhuma atividade registrada.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {(recentEvents as { id: string; event_type: string; created_at: string }[]).map((event) => (
                  <li key={event.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span className="text-xs">{event.event_type}</span>
                    <span className="text-xs text-muted">{formatDate(event.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
