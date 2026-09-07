import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reclassifyByNameCategory } from "@/lib/discovery-filters";

export const maxDuration = 60;

// One-off (re-runnable, idempotent) reprocessing of every stored lead through the CURRENT
// deterministic rules — the ~353 rows imported before the filter existed were never classified.
// Junk (markets, gas stations, pharmacies, chains, non-food) → triage_status 'auto_filtered' with
// a reason, pre_score 0, and removed from the pipeline board. Raw discovery rows that were dumped
// into pipeline_stage='new' (never consciously added) are pulled off the board too. Nothing is
// deleted — every row is kept for audit. GET/?dryRun=1 previews the funnel without writing.
type LeadLite = {
  id: string;
  name: string;
  category: string | null;
  triage_status: string;
  pipeline_stage: string | null;
  business_status: string | null;
  preparation_status: string | null;
};

function funnel(leads: LeadLite[]) {
  return {
    encontrados: leads.length,
    filtrados_auto: leads.filter((l) => l.triage_status === "auto_filtered").length,
    aguardando_triagem: leads.filter((l) => l.triage_status === "pending_review").length,
    selecionados: leads.filter((l) => l.triage_status === "approved").length,
    preparados: leads.filter((l) => l.preparation_status === "ready").length,
    no_pipeline: leads.filter((l) => l.pipeline_stage != null).length,
  };
}

async function run(dryRun: boolean) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leads")
    .select("id, name, category, triage_status, pipeline_stage, business_status, preparation_status");
  if (error) throw new Error(error.message);
  const leads = (data ?? []) as unknown as LeadLite[];

  const before = funnel(leads);

  // Bucket the work.
  const junkByReason = new Map<string, string[]>();
  const rawNewToDetach: string[] = []; // non-junk rows sitting in 'new' (never consciously added)

  for (const lead of leads) {
    // Never auto-filter an actual client.
    const reason = lead.business_status === "client" ? null : reclassifyByNameCategory(lead.name, lead.category);
    if (reason && lead.triage_status !== "auto_filtered") {
      const arr = junkByReason.get(reason) ?? [];
      arr.push(lead.id);
      junkByReason.set(reason, arr);
    } else if (!reason && lead.pipeline_stage === "new") {
      rawNewToDetach.push(lead.id);
    }
  }

  const junkTotal = [...junkByReason.values()].reduce((n, a) => n + a.length, 0);
  const summary = {
    dryRun,
    before,
    would_auto_filter: junkTotal,
    auto_filter_by_reason: Object.fromEntries([...junkByReason].map(([r, ids]) => [r, ids.length])),
    would_detach_from_pipeline: rawNewToDetach.length + junkTotal,
  };

  if (dryRun) return summary;

  // Apply — junk rows: auto_filter + reason + pre_score 0 + off the board.
  for (const [reason, ids] of junkByReason) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await admin
        .from("leads")
        .update({ triage_status: "auto_filtered", exclusion_reason: reason, pre_score: 0, pipeline_stage: null })
        .in("id", chunk);
    }
  }
  // Non-junk raw rows dumped in 'new' — pull off the board (they return to discovery/triage).
  for (let i = 0; i < rawNewToDetach.length; i += 200) {
    const chunk = rawNewToDetach.slice(i, i + 200);
    await admin.from("leads").update({ pipeline_stage: null }).in("id", chunk);
  }

  // Recompute the funnel after.
  const { data: after } = await admin
    .from("leads")
    .select("id, name, category, triage_status, pipeline_stage, business_status, preparation_status");
  return { ...summary, dryRun: false, after: funnel((after ?? []) as unknown as LeadLite[]) };
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get("dryRun") !== "0";
  try {
    return NextResponse.json(await run(dryRun));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  try {
    return NextResponse.json(await run(dryRun));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}
