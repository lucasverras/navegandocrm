"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { COMMERCIAL_STATUSES } from "@/types/domain";

const LABELS: Record<string, string> = {
  not_contacted: "Não abordado",
  message_ready: "Mensagem pronta",
  message_sent: "Enviada",
  invalid_number: "Número inválido",
  chatbot: "Chatbot",
  reception_answered: "Recepção respondeu",
  forwarded: "Encaminhado ao responsável",
  owner_contact_obtained: "Contato do dono obtido",
  awaiting_reply: "Aguardando retorno",
  no_reply: "Sem resposta",
  not_interested: "Não interessado",
  meeting_scheduled: "Reunião marcada",
};

export function StatusPanel({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado");
    router.refresh();
  }

  async function handleDiscard() {
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_status: "not_interested" }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Erro ao descartar lead");
      return;
    }
    toast.success("Lead descartado");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status comercial</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {COMMERCIAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABELS[s] ?? s}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button size="sm" loading={loading} onClick={handleSave}>
            Salvar status
          </Button>
          <Button size="sm" variant="danger" onClick={handleDiscard}>
            Descartar lead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
