import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { StatusStrip, type StatusItem } from "@/components/dashboard/StatusStrip";
import { FazerAgora, type TodoItem } from "@/components/dashboard/FazerAgora";
import { RecentActivity, summarizeToday } from "@/components/dashboard/DashboardCharts";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { daysFromNow } from "@/lib/utils";

type ActionLead = { id: string; name: string; phone: string | null };
type OverdueLead = ActionLead & { next_follow_up_at: string | null };

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayIso = endOfToday.toISOString();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayIso = startOfToday.toISOString();

  const [
    // --- Operational status strip (all count-only, head:true) ---
    { count: awaitingTriage },
    { count: awaitingPreparation },
    { count: readyToApproach },
    { count: followUpsToday },
    { count: awaitingReplies },
    { count: meetings },
    { count: totalLeads },
    // --- "Fazer agora" sources (all bounded) ---
    { data: readyLeadsData },
    { data: overdueLeadsData },
    { data: dmRows },
    // --- Recent activity ---
    { data: recentEvents },
  ] = await Promise.all([
    // Aguardando triagem
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("triage_status", "pending_review")
      .is("archived_at", null),
    // Aguardando preparação (aprovados que ainda não estão prontos)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("triage_status", "approved")
      .neq("preparation_status", "ready")
      .is("archived_at", null),
    // Prontos para abordar
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("preparation_status", "ready")
      .eq("commercial_status", "not_contacted")
      .is("archived_at", null),
    // Follow-ups hoje (<= fim do dia, definido, não fechado)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", endOfTodayIso)
      .neq("pipeline_stage", "closed")
      .is("archived_at", null),
    // Respostas aguardando
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("commercial_status", "awaiting_reply")
      .is("archived_at", null),
    // Reuniões (status comercial OU etapa de reunião/proposta)
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .or("commercial_status.eq.meeting_scheduled,pipeline_stage.eq.meeting_proposal")
      .is("archived_at", null),
    // Total de restaurantes (linha secundária)
    supabase.from("leads").select("id", { count: "exact", head: true }),
    // (a) Prontos para abordar / mensagem pronta — limit 12
    supabase
      .from("leads")
      .select("id, name, phone")
      .eq("preparation_status", "ready")
      .eq("commercial_status", "not_contacted")
      .is("archived_at", null)
      .order("pre_score", { ascending: false })
      .limit(12),
    // (c) Follow-ups atrasados — limit 12
    supabase
      .from("leads")
      .select("id, name, phone, next_follow_up_at")
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", nowIso)
      .neq("pipeline_stage", "closed")
      .is("archived_at", null)
      .order("next_follow_up_at", { ascending: true })
      .limit(12),
    // (b) source: decisores encontrados — limit 50 (cruzado com leads não abordados abaixo)
    supabase.from("decision_makers").select("lead_id").eq("found", true).limit(50),
    // Atividades de hoje — agregadas (não listadas linha a linha)
    supabase
      .from("outreach_events")
      .select("event_type, metadata")
      .gte("created_at", startOfTodayIso)
      .limit(500),
  ]);

  const activitySummary = summarizeToday(
    (recentEvents ?? []) as { event_type: string; metadata?: Record<string, unknown> | null }[]
  );

  const readyLeads = (readyLeadsData ?? []) as ActionLead[];
  const overdueLeads = (overdueLeadsData ?? []) as OverdueLead[];

  // (b) Decisor encontrado mas ainda não abordado. Bounded follow-up query over the found
  // decision-maker lead ids, restricted to leads that were never contacted.
  const dmLeadIds = Array.from(new Set(((dmRows ?? []) as { lead_id: string }[]).map((r) => r.lead_id))).slice(0, 30);
  let dmLeads: ActionLead[] = [];
  if (dmLeadIds.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone")
      .in("id", dmLeadIds)
      .eq("commercial_status", "not_contacted")
      .is("archived_at", null)
      .limit(12);
    dmLeads = (data ?? []) as ActionLead[];
  }

  // Build the ordered to-do list: (a) prontos para abordar, (b) decisor encontrado, (c) atrasados.
  // Dedupe by lead id (first/highest priority wins) and cap at 10.
  const seen = new Set<string>();
  const todo: TodoItem[] = [];
  const pushTodo = (item: TodoItem) => {
    if (todo.length >= 10 || seen.has(item.id)) return;
    seen.add(item.id);
    todo.push(item);
  };

  for (const lead of readyLeads) {
    pushTodo({
      id: lead.id,
      name: lead.name,
      reason: "Mensagem pronta · pronto para abordar",
      action: "Abordar",
      href: `/leads/${lead.id}`,
    });
  }
  for (const lead of dmLeads) {
    pushTodo({
      id: lead.id,
      name: lead.name,
      reason: "Decisor encontrado · ainda não abordado",
      action: "Abordar",
      href: `/leads/${lead.id}`,
    });
  }
  for (const lead of overdueLeads) {
    const overdue = daysFromNow(lead.next_follow_up_at);
    const reason = overdue != null && overdue < 0 ? `Follow-up atrasado há ${Math.abs(overdue)} dia(s)` : "Follow-up atrasado";
    const waLink = lead.phone ? buildWhatsAppLink(lead.phone, "") : null;
    if (waLink) {
      pushTodo({ id: lead.id, name: lead.name, reason, action: "WhatsApp", href: waLink, external: true });
    } else {
      pushTodo({ id: lead.id, name: lead.name, reason, action: "Fazer follow-up", href: `/leads/${lead.id}` });
    }
  }

  const statusItems: StatusItem[] = [
    { label: "Aguardando triagem", value: awaitingTriage ?? 0, href: "/prospeccao?tab=encontrados" },
    { label: "Aguardando preparação", value: awaitingPreparation ?? 0, href: "/prospeccao?tab=selecionados" },
    { label: "Prontos para abordar", value: readyToApproach ?? 0, href: "/prospeccao?tab=prontos" },
    { label: "Follow-ups hoje", value: followUpsToday ?? 0, href: "/hoje" },
    { label: "Respostas aguardando", value: awaitingReplies ?? 0, href: "/hoje" },
    { label: "Reuniões", value: meetings ?? 0, href: "/pipeline" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Operação"
        title="Radar do dia"
        subtitle="Menos análise, mais operação. O que precisa da sua ação agora — na ordem em que importa."
      />

      <StatusStrip items={statusItems} totalLeads={totalLeads ?? 0} />

      <FazerAgora items={todo} />

      <RecentActivity summary={activitySummary} />
    </div>
  );
}
