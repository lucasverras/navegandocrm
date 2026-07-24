import type { LeadRow } from "@/types/database";

// Lead enriched with the region join used across the "Hoje" page.
export interface HojeLead extends LeadRow {
  region?: { neighborhood: string; city: string; state: string } | null;
}

export interface HojeFilters {
  regiao?: string;
  etapa?: string;
  categoria?: string;
  scoreMin?: number;
  atrasados?: boolean;
}

export function leadScore(lead: Pick<LeadRow, "ai_score" | "pre_score">): number {
  return lead.ai_score ?? lead.pre_score;
}

export function passesFilters(lead: HojeLead, filters: HojeFilters): boolean {
  if (filters.regiao && lead.region_id !== filters.regiao) return false;
  if (filters.etapa && lead.pipeline_stage !== filters.etapa) return false;
  if (filters.categoria && lead.category !== filters.categoria) return false;
  if (filters.scoreMin != null && leadScore(lead) < filters.scoreMin) return false;
  return true;
}
