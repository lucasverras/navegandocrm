import { createClient } from "@/lib/supabase/server";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { formatDate } from "@/lib/utils";
import { History } from "lucide-react";

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("outreach_events")
    .select("*, leads(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Registro" title="Histórico" subtitle="Log de pesquisas, análises, mensagens e mudanças de status." />

      {!events?.length ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="Nenhum evento registrado" />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Data</Th>
              <Th>Lead</Th>
              <Th>Evento</Th>
              <Th>Canal</Th>
            </Tr>
          </THead>
          <TBody>
            {(events as unknown as { id: string; created_at: string; event_type: string; channel: string | null }[]).map((event) => (
              <Tr key={event.id}>
                <Td className="text-xs">{formatDate(event.created_at)}</Td>
                <Td>{(event as unknown as { leads?: { name?: string } }).leads?.name ?? "—"}</Td>
                <Td className="text-xs">{event.event_type}</Td>
                <Td className="text-xs">{event.channel}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
