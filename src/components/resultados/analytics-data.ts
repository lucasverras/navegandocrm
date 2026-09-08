// Server-side data for the Resultados → Analytics tab.
// Runs bounded, parallel queries (count-only HEAD requests for the funnel; narrow
// selects for the small closed/lost sets) and reduces them into chart-ready arrays.
// No server-only imports here, so the type exports can be pulled into the client
// Analytics component via `import type` without leaking server code into the bundle.

import type { SupabaseClient } from "@supabase/supabase-js";

export type FunnelStep = { stage: string; value: number; label: string };
export type NamedCount = { name: string; value: number };
export type MrrPoint = { month: string; mrr: number };

export interface AnalyticsData {
  funnel: FunnelStep[];
  funnelTotalPct: number | null; // overall Selecionados → Fechados
  regions: NamedCount[];
  lossReasons: NamedCount[];
  mrr: MrrPoint[];
}

// commercial_status values that count as a "response" from the lead.
const RESPONSE_STATUSES: string[] = [
  "awaiting_reply",
  "owner_contact_obtained",
  "reception_answered",
  "meeting_scheduled",
];

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

type ClosedRow = {
  region_id: string | null;
  closed_at: string | null;
  current_monthly_fee: number | null;
  initial_monthly_fee: number | null;
};

export async function getAnalytics(supabase: SupabaseClient): Promise<AnalyticsData> {
  const leads = () => supabase.from("leads");
  const countOpts = { count: "exact" as const, head: true };

  const [selecionados, abordados, respostas, reunioes, fechados, closedRes, regionsRes, lostRes] =
    await Promise.all([
      // 1. Funnel — five bounded count queries (head:true, no rows transferred).
      leads().select("id", countOpts).eq("triage_status", "approved"),
      leads().select("id", countOpts).eq("triage_status", "approved").neq("commercial_status", "not_contacted"),
      leads().select("id", countOpts).in("commercial_status", RESPONSE_STATUSES),
      leads().select("id", countOpts).or("commercial_status.eq.meeting_scheduled,pipeline_stage.eq.meeting"),
      leads().select("id", countOpts).eq("pipeline_stage", "closed"),
      // 2 + 4. Closed set (small): region_id feeds "por região", closed_at + fees feed MRR.
      leads()
        .select("region_id, closed_at, current_monthly_fee, initial_monthly_fee")
        .eq("pipeline_stage", "closed"),
      // region id → neighborhood map.
      supabase.from("regions").select("id, neighborhood"),
      // 3. Loss reasons — one narrow column, bounded.
      leads().select("lost_reason").not("lost_reason", "is", null).limit(2000),
    ]);

  const counts = {
    selecionados: selecionados.count ?? 0,
    abordados: abordados.count ?? 0,
    respostas: respostas.count ?? 0,
    reunioes: reunioes.count ?? 0,
    fechados: fechados.count ?? 0,
  };

  const funnelRaw: { stage: string; value: number }[] = [
    { stage: "Selecionados", value: counts.selecionados },
    { stage: "Abordados", value: counts.abordados },
    { stage: "Respostas", value: counts.respostas },
    { stage: "Reuniões", value: counts.reunioes },
    { stage: "Fechados", value: counts.fechados },
  ];
  const funnel: FunnelStep[] = funnelRaw.map((step, i) => {
    if (i === 0) return { ...step, label: String(step.value) };
    const prev = funnelRaw[i - 1].value;
    return { ...step, label: `${step.value} · ${pct(step.value, prev)}%` };
  });
  const funnelTotalPct = counts.selecionados > 0 ? pct(counts.fechados, counts.selecionados) : null;

  const closed = (closedRes.data ?? []) as ClosedRow[];

  // 2. Fechados por região — tally the (small) closed set by neighborhood.
  const regionName = new Map<string, string>();
  for (const r of (regionsRes.data ?? []) as { id: string; neighborhood: string }[]) {
    regionName.set(r.id, r.neighborhood);
  }
  const regionTally = new Map<string, number>();
  for (const row of closed) {
    const name = (row.region_id && regionName.get(row.region_id)) || "Sem região";
    regionTally.set(name, (regionTally.get(name) ?? 0) + 1);
  }
  const regions: NamedCount[] = [...regionTally.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // 3. Motivos de perda — tally lost_reason.
  const lossTally = new Map<string, number>();
  for (const row of (lostRes.data ?? []) as { lost_reason: string | null }[]) {
    const key = (row.lost_reason ?? "").trim();
    if (!key) continue;
    lossTally.set(key, (lossTally.get(key) ?? 0) + 1);
  }
  const lossReasons: NamedCount[] = [...lossTally.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // 4. MRR bruto acumulado — bucket closed clients by YYYY-MM of closed_at, cumulative fee.
  const monthTally = new Map<string, number>();
  for (const row of closed) {
    if (!row.closed_at) continue;
    const month = row.closed_at.slice(0, 7); // YYYY-MM
    const fee = row.current_monthly_fee ?? row.initial_monthly_fee ?? 0;
    monthTally.set(month, (monthTally.get(month) ?? 0) + fee);
  }
  let running = 0;
  const mrr: MrrPoint[] = [...monthTally.keys()]
    .sort()
    .map((month) => {
      running += monthTally.get(month) ?? 0;
      return { month, mrr: running };
    });

  return { funnel, funnelTotalPct, regions, lossReasons, mrr };
}
