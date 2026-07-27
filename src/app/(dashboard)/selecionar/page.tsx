import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { SelectionQueue } from "@/components/discovery/SelectionQueue";

export default async function SelecionarPage() {
  const supabase = await createClient();
  const { data: leadsRaw } = await supabase
    .from("leads")
    .select(
      "id, name, category, address, phone, website, google_rating, google_review_count, price_level, maps_url, pre_score"
    )
    .eq("triage_status", "pending_review")
    .order("pre_score", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Triagem"
        title="Selecionar"
        subtitle="Aprove ou descarte rapidamente os estabelecimentos encontrados — só os aprovados seguem para preparação."
      />
      <SelectionQueue leads={leadsRaw ?? []} />
    </div>
  );
}
