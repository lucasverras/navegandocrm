import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MessagePanel } from "@/components/leads/MessagePanel";
import { DecisionMakerPanel } from "@/components/leads/DecisionMakerPanel";
import { StatusPanel } from "@/components/leads/StatusPanel";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import { StageMover } from "@/components/leads/StageMover";
import { FollowUpPicker } from "@/components/leads/FollowUpPicker";
import { RegisterContactButton } from "@/components/leads/RegisterContactButton";
import { Timeline } from "@/components/leads/Timeline";
import { formatDate, formatHumanDate, daysFromNow } from "@/lib/utils";
import { PIPELINE_STAGE_LABELS } from "@/types/domain";
import type {
  LeadAnalysisRow,
  DecisionMakerRow,
  OutreachMessageRow,
  OutreachEventRow,
  LeadRow,
  RegionRow,
} from "@/types/database";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: leadData } = await supabase.from("leads").select("*, regions(id, neighborhood, city)").eq("id", id).single();
  if (!leadData) notFound();
  const lead = leadData as unknown as LeadRow & { regions: Pick<RegionRow, "id" | "neighborhood" | "city"> | null };

  const { data: analysisRaw } = await supabase
    .from("lead_analysis")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const analysis = analysisRaw as unknown as LeadAnalysisRow | null;

  const { data: decisionMakerRaw } = await supabase
    .from("decision_makers")
    .select("*")
    .eq("lead_id", id)
    .order("researched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const decisionMaker = decisionMakerRaw as unknown as DecisionMakerRow | null;

  const { data: latestMessageRaw } = await supabase
    .from("outreach_messages")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestMessage = latestMessageRaw as unknown as OutreachMessageRow | null;

  const { data: eventsRaw } = await supabase
    .from("outreach_events")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const events = (eventsRaw ?? []) as unknown as OutreachEventRow[];

  const evidence = (analysis?.evidence as unknown as { claim: string; source: string; confidence: number }[]) ?? [];
  const risks = (analysis?.risks as unknown as string[]) ?? [];
  const score = lead.ai_score ?? lead.pre_score;
  const followUpOverdue = lead.next_follow_up_at ? (daysFromNow(lead.next_follow_up_at) ?? 0) < 0 : false;

  return (
    <div className="flex flex-col gap-6">
      {/* Resumo */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface/80 p-5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent to-accent-2" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">{lead.name}</h1>
              {lead.is_demo && <Badge tone="warning">DEMO</Badge>}
              {followUpOverdue && <Badge tone="danger">Follow-up atrasado</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {lead.category} · {lead.regions?.neighborhood ?? "região não informada"}
              {lead.regions?.city ? `, ${lead.regions.city}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Score {score}</Badge>
            <Badge tone="default">{PIPELINE_STAGE_LABELS[lead.pipeline_stage]}</Badge>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Responsável</dt>
            <dd>{lead.assigned_to ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Próxima ação</dt>
            <dd>{nextAction(lead)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Próximo follow-up</dt>
            <dd className={followUpOverdue ? "text-danger" : undefined} title={formatDate(lead.next_follow_up_at)}>
              {formatHumanDate(lead.next_follow_up_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Última atividade</dt>
            <dd title={formatDate(lead.last_activity_at)}>{formatHumanDate(lead.last_activity_at)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <WhatsAppButton phone={lead.phone} message={latestMessage?.content ?? ""} />
          <RegisterContactButton leadId={lead.id} />
          <FollowUpPicker leadId={lead.id} current={lead.next_follow_up_at} />
          <StageMover leadId={lead.id} currentStage={lead.pipeline_stage} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações do negócio</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Telefone" value={lead.phone} />
              <Info label="Site" value={lead.website} link={lead.website} />
              <Info label="Instagram" value={lead.instagram} link={lead.instagram ? `https://instagram.com/${lead.instagram.replace("@", "")}` : null} />
              <Info label="Google Maps" value={lead.maps_url ? "Ver no mapa" : null} link={lead.maps_url} />
              <Info label="Nota" value={lead.google_rating?.toString()} />
              <Info label="Avaliações" value={lead.google_review_count?.toString()} />
              <Info label="Unidades" value={lead.estimated_units?.toString()} />
              <Info label="Descoberto em" value={formatDate(lead.created_at)} />
            </dl>
            {lead.notes && (
              <p className="mt-4 rounded-md border border-border bg-surface-2 p-3 text-sm text-muted">{lead.notes}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ScoreBar label="Pré-score (regra)" value={lead.pre_score} />
            {analysis && <ScoreBar label="Score de oportunidade (IA)" value={analysis.opportunity_score} />}
            {analysis && <ScoreBar label="Acesso ao decisor" value={analysis.contact_score} />}
          </CardContent>
        </Card>
      </div>

      {/* Oportunidade */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Oportunidade identificada</CardTitle>
          {analysis && <Badge tone="accent">{analysis.model}</Badge>}
        </CardHeader>
        <CardContent>
          {!analysis ? (
            <p className="text-sm text-muted">Este lead ainda não foi analisado pela IA. Volte para a lista de leads e use &quot;Analisar com IA&quot;.</p>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted">Foco principal</p>
                  <p>{analysis.opportunity_focus || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Serviço recomendado</p>
                  <p>{analysis.recommended_service || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted">Resumo</p>
                <p className="text-foreground/90">{analysis.main_opportunity || "—"}</p>
              </div>
              {evidence.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted">Evidências</p>
                  <ul className="flex flex-col gap-1.5">
                    {evidence.map((e, i) => (
                      <li key={i} className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
                        <span className="text-foreground">{e.claim}</span>
                        <span className="ml-2 text-muted">
                          ({e.source}, confiança {e.confidence}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {risks.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted">Riscos</p>
                  <ul className="list-inside list-disc text-xs text-muted">
                    {risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Badge tone={analysis.should_contact ? "success" : "muted"}>
                  {analysis.should_contact ? "Recomendado abordar" : "Não recomendado abordar"}
                </Badge>
                <Badge tone="muted">Marketing: {analysis.marketing_status}</Badge>
                <Badge tone="muted">Agência: {analysis.agency_status}</Badge>
              </div>
              <p className="text-xs text-muted">{analysis.reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contato e decisor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DecisionMakerPanel leadId={lead.id} decisionMaker={decisionMaker ?? null} />
        <StatusPanel leadId={lead.id} currentStatus={lead.commercial_status} />
      </div>

      {/* Mensagem */}
      <MessagePanel lead={lead} latestMessage={latestMessage ?? null} />

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={events} />
        </CardContent>
      </Card>

      <div className="text-right">
        <Link href="/leads" className="text-xs text-muted hover:text-foreground">
          ← Voltar para Leads
        </Link>
      </div>
    </div>
  );
}

function nextAction(lead: LeadRow): string {
  if (lead.pipeline_stage === "closed") return "Negócio fechado";
  if (!lead.ai_score) return "Analisar com IA";
  if (lead.commercial_status === "message_ready") return "Enviar mensagem";
  if (lead.commercial_status === "not_contacted") return "Gerar mensagem e abordar";
  if (lead.next_follow_up_at) return "Fazer follow-up";
  return "Agendar próximo passo";
}

function Info({ label, value, link }: { label: string; value?: string | null; link?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate">
        {!value ? (
          "—"
        ) : link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent-2 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
