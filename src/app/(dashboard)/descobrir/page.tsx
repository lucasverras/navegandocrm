import { createClient } from "@/lib/supabase/server";
import { CampaignForm } from "@/components/discovery/CampaignForm";
import { CampaignRow } from "@/components/discovery/CampaignRow";
import { Table, THead, TBody, Tr, Th } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { Compass } from "lucide-react";
import type { DiscoveryCampaignRow, DiscoveryCampaignStatsRow } from "@/types/database";

export default async function DescobrirPage() {
  const supabase = await createClient();
  const [{ data: campaignsRaw }, { data: statsRaw }] = await Promise.all([
    supabase.from("discovery_campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("discovery_campaign_stats").select("*"),
  ]);
  const campaigns = campaignsRaw as unknown as DiscoveryCampaignRow[] | null;
  const statsByCampaign = new Map(
    ((statsRaw as unknown as DiscoveryCampaignStatsRow[] | null) ?? []).map((s) => [s.discovery_campaign_id, s])
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Descoberta"
        title="Descobrir"
        subtitle="Configure campanhas com filtros de categoria e palavras antes de pesquisar — o lixo óbvio nunca chega à triagem."
      />

      <CampaignForm />

      {!campaigns?.length ? (
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="Nenhuma campanha cadastrada"
          description="Crie uma campanha acima para começar a descobrir estabelecimentos."
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Nome</Th>
              <Th>Região</Th>
              <Th>Status</Th>
              <Th>Aguard. triagem</Th>
              <Th>Aprovados</Th>
              <Th>Filtrados</Th>
              <Th>Última busca</Th>
              <Th>Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {campaigns.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} stats={statsByCampaign.get(campaign.id)} />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
