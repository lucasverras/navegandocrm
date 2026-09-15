"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Table, THead, TBody, Tr, Th } from "@/components/ui/Table";
import { FechadoRow, FechadoCard, type Fechado } from "@/components/resultados/FechadoRow";

type StatusFilter = "all" | "active" | "churned";

export function ResultadosTable({ clients }: { clients: Fechado[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let list = clients;
    if (status === "active") list = list.filter((c) => !c.churned_at);
    if (status === "churned") list = list.filter((c) => !!c.churned_at);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [clients, status, search]);

  const selectClass = "h-7 rounded border border-border bg-surface px-2 text-xs text-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-40 bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
          />
        </div>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Todos ({clients.length})</option>
          <option value="active">Ativos ({clients.filter((c) => !c.churned_at).length})</option>
          <option value="churned">Encerrados ({clients.filter((c) => !!c.churned_at).length})</option>
        </select>
        <span className="ml-auto text-xs tabular-nums text-muted">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Nenhum cliente encontrado.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((c) => <FechadoCard key={c.id} client={c} />)}
          </div>
          <div className="hidden md:block">
            <Table>
              <THead>
                <Tr>
                  <Th>Cliente</Th>
                  <Th>Entrou</Th>
                  <Th>Saiu</Th>
                  <Th>Meses</Th>
                  <Th>Mensalidade</Th>
                  <Th>Receita Nav.</Th>
                  <Th>Comissão</Th>
                  <Th>Recebida</Th>
                  <Th>Pendente</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((c) => <FechadoRow key={c.id} client={c} />)}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
