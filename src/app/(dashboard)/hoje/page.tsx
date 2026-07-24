import { createClient } from "@/lib/supabase/server";
import { HojeFilterBar } from "@/components/hoje/HojeFilterBar";
import { HojeSection } from "@/components/hoje/HojeSection";
import { HojeLeadRow } from "@/components/hoje/HojeLeadRow";
import { leadScore, passesFilters, type HojeFilters, type HojeLead } from "@/components/hoje/types";
import type { OutreachMessageRow } from "@/types/database";

const LEAD_SELECT = "*, region:regions(neighborhood, city, state)";

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ regiao?: string; etapa?: string; categoria?: string; scoreMin?: string; atrasados?: string }>;
}) {
  const params = await searchParams;
  const filters: HojeFilters = {
    regiao: params.regiao || undefined,
    etapa: params.etapa || undefined,
    categoria: params.categoria || undefined,
    scoreMin: params.scoreMin ? Number(params.scoreMin) : undefined,
    atrasados: params.atrasados === "1",
  };

  const supabase = await createClient();

  const now = new Date();
  const nowIso = now.toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const tomorrowStart = todayEnd;
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  function applyCommonFilters<T>(query: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = query;
    if (filters.regiao) q = q.eq("region_id", filters.regiao);
    if (filters.etapa) q = q.eq("pipeline_stage", filters.etapa);
    if (filters.categoria) q = q.eq("category", filters.categoria);
    return q;
  }

  // Section-inclusion respects the "só atrasados" toggle: only the two sections that
  // represent something being "late" (overdue follow-ups, stale leads) stay visible.
  const showOverdue = true;
  const showToday = !filters.atrasados;
  const showTomorrow = !filters.atrasados;
  const showStale = true;
  const showNewHighScore = !filters.atrasados;
  const showMeetings = !filters.atrasados;
  const showReadyMessages = !filters.atrasados;

  const [overdueRes, todayRes, tomorrowRes, staleRes, newHighScoreRes, meetingsRes, readyRes, regionsRes] =
    await Promise.all([
      showOverdue
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .lt("next_follow_up_at", nowIso)
              .neq("pipeline_stage", "closed")
              .is("archived_at", null)
              .order("next_follow_up_at", { ascending: true })
              .limit(50)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      showToday
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .gte("next_follow_up_at", todayStart.toISOString())
              .lt("next_follow_up_at", todayEnd.toISOString())
              .neq("pipeline_stage", "closed")
              .is("archived_at", null)
              .order("next_follow_up_at", { ascending: true })
              .limit(50)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      showTomorrow
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .gte("next_follow_up_at", tomorrowStart.toISOString())
              .lt("next_follow_up_at", tomorrowEnd.toISOString())
              .neq("pipeline_stage", "closed")
              .is("archived_at", null)
              .order("next_follow_up_at", { ascending: true })
              .limit(50)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      showStale
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .lt("last_activity_at", sevenDaysAgo.toISOString())
              .neq("pipeline_stage", "closed")
              .is("archived_at", null)
              .order("last_activity_at", { ascending: true })
              .limit(50)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      showNewHighScore
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .eq("pipeline_stage", "new")
              .is("archived_at", null)
              .gte("pre_score", 70)
              .order("pre_score", { ascending: false })
              .limit(10)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      showMeetings
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .not("meeting_at", "is", null)
              .gt("meeting_at", nowIso)
              .is("archived_at", null)
              .order("meeting_at", { ascending: true })
              .limit(50)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      showReadyMessages
        ? applyCommonFilters(
            supabase
              .from("leads")
              .select(LEAD_SELECT)
              .eq("commercial_status", "message_ready")
              .is("archived_at", null)
              .order("last_activity_at", { ascending: false })
              .limit(50)
          )
        : Promise.resolve({ data: [] as HojeLead[] }),
      supabase.from("regions").select("id, neighborhood, city").eq("status", "active").order("neighborhood"),
    ]);

  const overdueLeads = ((overdueRes.data ?? []) as HojeLead[]).filter((l) => passesFilters(l, filters));
  const todayLeads = ((todayRes.data ?? []) as HojeLead[]).filter((l) => passesFilters(l, filters));
  const tomorrowLeads = ((tomorrowRes.data ?? []) as HojeLead[]).filter((l) => passesFilters(l, filters));
  const staleLeads = ((staleRes.data ?? []) as HojeLead[]).filter((l) => passesFilters(l, filters));
  const newHighScoreLeads = ((newHighScoreRes.data ?? []) as HojeLead[])
    .filter((l) => passesFilters(l, filters))
    .sort((a, b) => leadScore(b) - leadScore(a));
  const meetingLeads = ((meetingsRes.data ?? []) as HojeLead[]).filter((l) => passesFilters(l, filters));
  const readyLeads = ((readyRes.data ?? []) as HojeLead[]).filter((l) => passesFilters(l, filters));

  // For "mensagens prontas" we need the latest outreach message per lead to power the
  // WhatsApp quick action. Fetch messages for just those leads, then pick the newest per lead.
  const readyLeadIds = readyLeads.map((l) => l.id);
  const latestMessageByLead = new Map<string, string>();
  if (readyLeadIds.length > 0) {
    const { data: messages } = await supabase
      .from("outreach_messages")
      .select("lead_id, content, created_at")
      .in("lead_id", readyLeadIds)
      .order("created_at", { ascending: false });
    for (const msg of (messages ?? []) as Pick<OutreachMessageRow, "lead_id" | "content" | "created_at">[]) {
      if (!latestMessageByLead.has(msg.lead_id)) latestMessageByLead.set(msg.lead_id, msg.content);
    }
  }

  const regions = (regionsRes.data ?? []) as { id: string; neighborhood: string; city: string }[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
        <p className="mt-1 text-sm text-muted">Sua central diária: follow-ups, leads parados e ações recomendadas.</p>
      </div>

      <HojeFilterBar regions={regions} />

      {showOverdue && (
        <HojeSection title="Follow-ups atrasados" count={overdueLeads.length} emptyMessage="Nenhum follow-up atrasado. Tudo em dia.">
          {overdueLeads.map((lead) => (
            <HojeLeadRow
              key={lead.id}
              lead={lead}
              action="Fazer follow-up"
              dateLabel="Próximo follow-up"
              dateValue={lead.next_follow_up_at}
            />
          ))}
        </HojeSection>
      )}

      {showToday && (
        <HojeSection title="Follow-ups de hoje" count={todayLeads.length} emptyMessage="Nenhum follow-up agendado para hoje.">
          {todayLeads.map((lead) => (
            <HojeLeadRow
              key={lead.id}
              lead={lead}
              action="Fazer follow-up"
              dateLabel="Follow-up"
              dateValue={lead.next_follow_up_at}
            />
          ))}
        </HojeSection>
      )}

      {showTomorrow && (
        <HojeSection title="Follow-ups de amanhã" count={tomorrowLeads.length} emptyMessage="Nenhum follow-up agendado para amanhã.">
          {tomorrowLeads.map((lead) => (
            <HojeLeadRow
              key={lead.id}
              lead={lead}
              action="Preparar follow-up"
              dateLabel="Follow-up"
              dateValue={lead.next_follow_up_at}
            />
          ))}
        </HojeSection>
      )}

      {showStale && (
        <HojeSection
          title="Leads sem atividade há 7+ dias"
          count={staleLeads.length}
          emptyMessage="Nenhum lead parado. Tudo com atividade recente."
        >
          {staleLeads.map((lead) => (
            <HojeLeadRow key={lead.id} lead={lead} action="Retomar contato" dateLabel="Última atividade" dateValue={lead.last_activity_at} />
          ))}
        </HojeSection>
      )}

      {showNewHighScore && (
        <HojeSection
          title="Novos leads com score alto"
          count={newHighScoreLeads.length}
          emptyMessage="Nenhum lead novo com score alto no momento."
        >
          {newHighScoreLeads.map((lead) => (
            <HojeLeadRow key={lead.id} lead={lead} action="Analisar e abordar" />
          ))}
        </HojeSection>
      )}

      {showMeetings && (
        <HojeSection title="Reuniões próximas" count={meetingLeads.length} emptyMessage="Nenhuma reunião marcada.">
          {meetingLeads.map((lead) => (
            <HojeLeadRow key={lead.id} lead={lead} action="Confirmar reunião" dateLabel="Reunião" dateValue={lead.meeting_at} />
          ))}
        </HojeSection>
      )}

      {showReadyMessages && (
        <HojeSection
          title="Mensagens prontas ainda não enviadas"
          count={readyLeads.length}
          emptyMessage="Nenhuma mensagem pendente de envio."
        >
          {readyLeads.map((lead) => (
            <HojeLeadRow
              key={lead.id}
              lead={lead}
              action="Enviar mensagem"
              whatsappMessage={latestMessageByLead.get(lead.id) ?? null}
            />
          ))}
        </HojeSection>
      )}
    </div>
  );
}
