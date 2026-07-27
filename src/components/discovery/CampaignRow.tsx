"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tr, Td } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import { Search, Archive, RotateCcw } from "lucide-react";
import type { DiscoveryCampaignRow, DiscoveryCampaignStatsRow } from "@/types/database";

export function CampaignRow({
  campaign,
  stats,
}: {
  campaign: DiscoveryCampaignRow;
  stats: DiscoveryCampaignStatsRow | undefined;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleSearch() {
    setSearching(true);
    const res = await fetch(`/api/discovery-campaigns/${campaign.id}/search`, { method: "POST" });
    const data = await res.json();
    setSearching(false);

    if (!res.ok) {
      toast.error(data.error ?? "Erro na pesquisa");
      return;
    }

    toast.success(
      `Encontrados: ${data.placesFound} · Removidos por categoria: ${data.removedByCategory} · ` +
        `Removidos por palavra: ${data.removedByKeyword} · Duplicados: ${data.placesDuplicate} · ` +
        `Enviados para triagem: ${data.sentToTriage}`
    );
    router.refresh();
  }

  async function handleToggleStatus() {
    setToggling(true);
    const nextStatus = campaign.status === "active" ? "archived" : "active";
    const res = await fetch(`/api/discovery-campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setToggling(false);
    if (!res.ok) {
      toast.error("Erro ao atualizar campanha");
      return;
    }
    router.refresh();
  }

  return (
    <Tr>
      <Td className="font-medium">{campaign.name}</Td>
      <Td>
        {campaign.neighborhood}, {campaign.city} - {campaign.state}
      </Td>
      <Td>
        <Badge tone={campaign.status === "active" ? "success" : "muted"}>
          {campaign.status === "active" ? "Ativa" : campaign.status === "paused" ? "Pausada" : "Arquivada"}
        </Badge>
      </Td>
      <Td>{stats?.pending_review ?? 0}</Td>
      <Td>{stats?.approved ?? 0}</Td>
      <Td>{stats?.auto_filtered ?? 0}</Td>
      <Td>{formatDate(campaign.last_searched_at)}</Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={searching} onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" />
            Buscar agora
          </Button>
          <Button size="sm" variant="ghost" loading={toggling} onClick={handleToggleStatus}>
            {campaign.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
