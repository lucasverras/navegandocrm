"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import type { OutreachMessageRow, LeadRow } from "@/types/database";
import { Sparkles, Copy, RefreshCcw, Wand2 } from "lucide-react";

type MessageOption = { strategy: string; message: string; evidence: string; variant?: string };

const STRATEGY_LABEL: Record<string, string> = {
  observacao: "Observação",
  case: "Case",
  direta: "Direta",
};

export function MessagePanel({ lead, latestMessage }: { lead: LeadRow; latestMessage: OutreachMessageRow | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latestMessage?.content ?? "");
  const [loading, setLoading] = useState<"generate" | "regenerate" | "refine" | "save" | "options" | null>(null);
  const [options, setOptions] = useState<MessageOption[] | null>(null);

  async function generateOptions() {
    setLoading("options");
    setOptions(null);
    const res = await fetch(`/api/leads/${lead.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategies: true }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao gerar opções");
      return;
    }
    setOptions(data.options ?? []);
  }

  async function applyOption(opt: MessageOption) {
    setLoading("generate");
    const res = await fetch(`/api/leads/${lead.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: opt.message, variant: opt.variant ?? "diagnosis" }),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao salvar mensagem");
      return;
    }
    setDraft(data.message.content);
    setOptions(null);
    toast.success("Mensagem escolhida");
    router.refresh();
  }

  async function generate(refine = false) {
    setLoading(refine ? "refine" : "generate");
    const res = await fetch(`/api/leads/${lead.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refine }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      toast.error(data.error ?? "Erro ao gerar mensagem");
      return;
    }

    setDraft(data.message.content);
    toast.success(refine ? "Mensagem refinada" : "Mensagem gerada");
    router.refresh();
  }

  async function saveEdit() {
    if (!latestMessage) return;
    setLoading("save");
    const res = await fetch(`/api/messages/${latestMessage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Erro ao salvar edição");
      return;
    }
    setEditing(false);
    toast.success("Mensagem atualizada");
    router.refresh();
  }

  async function markSent() {
    const res = await fetch(`/api/leads/${lead.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "message_sent" }),
    });
    if (!res.ok) {
      toast.error("Erro ao marcar como enviada");
      return;
    }
    toast.success("Marcado como enviada");
    router.refresh();
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(draft);
    toast.success("Copiado");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mensagem comercial</CardTitle>
        {latestMessage && (
          <Badge tone="accent">
            {latestMessage.variant} · {latestMessage.model}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {draft ? (
          editing ? (
            <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-4 text-sm leading-relaxed">
              {draft}
            </p>
          )
        ) : (
          <p className="text-sm text-muted">Nenhuma mensagem gerada ainda.</p>
        )}

        {options && options.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">3 estratégias — escolha uma:</p>
            {options.map((opt, i) => (
              <div key={i} className="rounded-md border border-border bg-surface-2 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge tone="accent">{STRATEGY_LABEL[opt.strategy] ?? opt.strategy}</Badge>
                  <Button size="sm" variant="outline" onClick={() => applyOption(opt)}>
                    Usar esta
                  </Button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{opt.message}</p>
                {opt.evidence && <p className="mt-1.5 text-xs text-muted">Evidência: {opt.evidence}</p>}
              </div>
            ))}
          </div>
        )}

        {latestMessage && (
          <p className="text-xs text-muted">
            Tokens: {latestMessage.input_tokens + latestMessage.output_tokens} · Custo estimado: $
            {latestMessage.estimated_cost_usd.toFixed(5)}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={loading === "generate"} onClick={() => generate(false)}>
            <Sparkles className="h-3.5 w-3.5" />
            {draft ? "Gerar outra versão" : "Gerar mensagem"}
          </Button>
          <Button size="sm" variant="outline" loading={loading === "options"} onClick={generateOptions}>
            <Sparkles className="h-3.5 w-3.5" />
            Gerar 3 opções
          </Button>
          <Button size="sm" variant="outline" loading={loading === "refine"} onClick={() => generate(true)}>
            <Wand2 className="h-3.5 w-3.5" />
            Refinar mensagem
          </Button>
          {draft && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
          {editing && (
            <Button size="sm" variant="secondary" loading={loading === "save"} onClick={saveEdit}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Salvar edição
            </Button>
          )}
          {draft && (
            <Button size="sm" variant="ghost" onClick={copyMessage}>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </Button>
          )}
          {draft && <WhatsAppButton phone={lead.phone} message={draft} />}
          {draft && (
            <Button size="sm" variant="ghost" onClick={markSent}>
              Marcar como enviada
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
