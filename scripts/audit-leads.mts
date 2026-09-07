// READ-ONLY audit of the leads table against the current filter rules.
// Prints the funnel, how many rows WOULD be auto-filtered (by reason), the pipeline count
// before/after the pipeline_stage=null gate, and a pre_score histogram. Writes nothing.
// Run: npx tsx scripts/audit-leads.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { reclassifyByNameCategory } from "../src/lib/discovery-filters";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("leads")
  .select("id, name, category, triage_status, pipeline_stage, business_status, preparation_status, pre_score");
if (error) throw error;
const leads = data ?? [];

const junkByReason: Record<string, number> = {};
const junkExamples: string[] = [];
let junk = 0;
for (const l of leads) {
  const reason = l.business_status === "client" ? null : reclassifyByNameCategory(l.name, l.category);
  if (reason) {
    junk++;
    junkByReason[reason] = (junkByReason[reason] ?? 0) + 1;
    if (junkExamples.length < 15) junkExamples.push(`${l.name} [${l.category}] → ${reason} (score ${l.pre_score})`);
  }
}

const inPipelineNow = leads.filter((l) => l.pipeline_stage != null).length;
const inNew = leads.filter((l) => l.pipeline_stage === "new").length;
const keptInPipeline = leads.filter((l) => l.pipeline_stage != null && l.pipeline_stage !== "new").length;

const hist: Record<string, number> = { "0-39": 0, "40-59": 0, "60-74": 0, "75-89": 0, "90-100": 0 };
for (const l of leads) {
  const s = l.pre_score ?? 0;
  if (s < 40) hist["0-39"]++;
  else if (s < 60) hist["40-59"]++;
  else if (s < 75) hist["60-74"]++;
  else if (s < 90) hist["75-89"]++;
  else hist["90-100"]++;
}
const top = leads.filter((l) => (l.pre_score ?? 0) >= 90).sort((a, b) => (b.pre_score ?? 0) - (a.pre_score ?? 0)).slice(0, 10);

console.log("=== FUNNEL (atual) ===");
console.log("total leads:", leads.length);
console.log("  auto_filtered:", leads.filter((l) => l.triage_status === "auto_filtered").length);
console.log("  pending_review:", leads.filter((l) => l.triage_status === "pending_review").length);
console.log("  approved:", leads.filter((l) => l.triage_status === "approved").length);
console.log("  preparados (ready):", leads.filter((l) => l.preparation_status === "ready").length);
console.log("  no pipeline (stage != null):", inPipelineNow, `(dos quais em 'new': ${inNew})`);
console.log("\n=== RECLASSIFICAÇÃO (o que sairia) ===");
console.log("junk detectado agora:", junk, junkByReason);
console.log("pipeline DEPOIS do gate:", keptInPipeline, "(remove", inPipelineNow - keptInPipeline, "raw/junk)");
console.log("exemplos:\n - " + junkExamples.join("\n - "));
console.log("\n=== HISTOGRAMA pre_score ===", hist);
console.log("% em 90-100:", ((hist["90-100"] / Math.max(1, leads.length)) * 100).toFixed(1) + "%");
console.log("top score >=90 (nome → score):\n - " + top.map((l) => `${l.name} → ${l.pre_score}`).join("\n - "));
