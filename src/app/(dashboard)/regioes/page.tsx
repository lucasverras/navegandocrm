import { createClient } from "@/lib/supabase/server";
import { RegionForm } from "@/components/regions/RegionForm";
import { RegionRow } from "@/components/regions/RegionRow";
import { Table, THead, TBody, Tr, Th } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapPin } from "lucide-react";
import type { RegionRow as RegionRowType } from "@/types/database";

export default async function RegioesPage() {
  const supabase = await createClient();
  const { data: regionsRaw } = await supabase.from("regions").select("*").order("created_at", { ascending: false });
  const regions = regionsRaw as unknown as RegionRowType[] | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Regiões</h1>
        <p className="mt-1 text-sm text-muted">Cadastre bairros para pesquisar restaurantes com o Google Places.</p>
      </div>

      <RegionForm />

      {!regions?.length ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="Nenhuma região cadastrada"
          description="Adicione uma região acima para começar a pesquisar leads."
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Bairro</Th>
              <Th>Cidade / UF</Th>
              <Th>Raio</Th>
              <Th>Status</Th>
              <Th>Restaurantes</Th>
              <Th>Última pesquisa</Th>
              <Th>Ações</Th>
            </Tr>
          </THead>
          <TBody>
            {regions.map((region) => (
              <RegionRow key={region.id} region={region} />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
