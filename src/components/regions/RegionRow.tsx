"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tr, Td } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils";
import type { RegionRow as RegionRowType } from "@/types/database";
import { Search, Archive, RotateCcw } from "lucide-react";

export function RegionRow({ region }: { region: RegionRowType }) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleSearch() {
    setSearching(true);
    const res = await fetch(`/api/regions/${region.id}/search`, { method: "POST" });
    const data = await res.json();
    setSearching(false);

    if (!res.ok) {
      toast.error(data.error ?? "Erro na pesquisa");
      return;
    }

    toast.success(`Pesquisa concluída: ${data.placesNew} novos, ${data.placesDuplicate} duplicados`);
    router.refresh();
  }

  async function handleToggleStatus() {
    setToggling(true);
    const nextStatus = region.status === "active" ? "archived" : "active";
    const res = await fetch(`/api/regions/${region.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setToggling(false);
    if (!res.ok) {
      toast.error("Erro ao atualizar região");
      return;
    }
    router.refresh();
  }

  return (
    <Tr>
      <Td className="font-medium">{region.neighborhood}</Td>
      <Td>
        {region.city} - {region.state}
      </Td>
      <Td>{(region.radius_meters / 1000).toFixed(1)} km</Td>
      <Td>
        <Badge tone={region.status === "active" ? "success" : "muted"}>
          {region.status === "active" ? "Ativa" : "Arquivada"}
        </Badge>
      </Td>
      <Td>{region.restaurants_found}</Td>
      <Td>{formatDate(region.last_searched_at)}</Td>
      <Td>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={searching} onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" />
            Pesquisar
          </Button>
          <Button size="sm" variant="ghost" loading={toggling} onClick={handleToggleStatus}>
            {region.status === "active" ? <Archive className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </Td>
    </Tr>
  );
}
