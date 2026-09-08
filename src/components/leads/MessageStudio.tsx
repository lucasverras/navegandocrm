"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { WhatsAppButton } from "@/components/leads/WhatsAppButton";
import { NAVEGANDO_CASES } from "@/lib/cases";
import type { OutreachMessageRow, LeadRow } from "@/types/database";
import { Sparkles, Copy, RefreshCcw, Wand2, CornerDownLeft } from "lucide-react";

type MessageOption = { strategy: string; message: string; evidence: string; variant?: string };
type Rationale = {
  case?: string | null;
  decisor?: string | null;
  observation?: string | null;
  instruction?: string | null;
  picked?: boolean;
};

const STRATEGY_LABEL: Record<string, string> = {
  observacao: "Observação",
  case: "Case",
  direta: "Direta",
};

// MESSAGE STUDIO (V6 §28-31): a mensagem recomendada, POR QUE ela foi criada, ajustes de um
// clique (mais direta / mais curta / outro case) e refino em linguagem natural — sem virar chat.
export function MessageStudio({ lead, latestMessage }: { lead: LeadRow; latestMessage: OutreachMessageRow | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latestMessage?.content ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [options, setOptions] = useState<MessageOption[] | null>(null);
  const [brief, setBrief] = useState<{ specific_observation?: string; unknowns?: string[] } | null>(null);
  const [wish, setWish] = useState("");

  const rationale = (latestMessage?.rationale ?? null) as Rationale | null;

  async function post(body: Record<string, unknown>, loadKey: string, successMsg: string) {
    setLoading(loadKey);
    const res = await fetch(`/api/leads/${lead.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao gerar mensagem");
      return false;
    }
    if (data.message?.content) setDraft(data.message.content);
    setOptions(null);
    setBrief(null);
    toast.success(successMsg);
    router.refresh();
    return true;
  }

  async function generateOptions() {
    setLoading("options");
    setOptions(null);
    setBrief(null);
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
    setBrief(data.brief ?? null);
  }

  async function applyOption(opt: MessageOption) {
    await post({ content: opt.message, variant: opt.variant ?? "diagnosis" }, "generate", "Mensagem escolhida");
  }

  async function applyWish() {
    const text = wish.trim();
    if (text.length < 2) return;
    const ok = await post({ instruction: text }, "wish", "Nova versão gerada");
    if (ok) setWish("");
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

  const whyParts = [
    rationale?.observation ? { label: "Observação", value: rationale.observation } : null,
    rationale?.decisor ? { label: "Decisor", value: rationale.decisor } : null,
    rationale?.case ? { label: "Case", value: rationale.case } : null,
    rationale?.instruction ? { label: "Ajuste aplicado", value: rationale.instruction } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mensagem</CardTitle>
        {latestMessage && <Badge tone="accent">{latestMessage.variant}</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {draft ? (
          editing ? (
            <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-4 text-sm leading-relaxed">{draft}</p>
          )
        ) : (
          <p className="text-sm text-muted">Nenhuma mensagem gerada ainda.</p>
        )}

        {/* Por que essa mensagem (§29) — persistido com a mensagem, não some no refresh. */}
        {whyParts.length > 0 && !options && (
          <div className="rounded-md border border-border bg-surface-2/60 p-3 text-xs leading-relaxed">
            <p className="mb-1 font-semibold uppercase tracking-wide text-muted">Por que essa mensagem</p>
            {whyParts.map((p) => (
              <p key={p.label}>
                <span className="text-muted">{p.label}: </span>
                <span className="text-foreground">{p.value}</span>
              </p>
            ))}
          </div>
        )}

        {brief?.specific_observation && (
          <div className="rounded-md border border-border bg-surface-2/60 p-3 text-xs">
            <span className="text-muted">Observação usada: </span>
            <span className="text-foreground">{brief.specific_observation}</span>
            {brief.unknowns && brief.unknowns.length > 0 && (
              <p className="mt-1 text-muted">Não confirmado: {brief.unknowns.join(" · ")}</p>
            )}
          </div>
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

        {/* Ações principais */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={loading === "generate"} onClick={() => post({}, "generate", "Mensagem gerada")}>
            <Sparkles className="h-3.5 w-3.5" />
            {draft ? "Gerar outra" : "Gerar mensagem"}
          </Button>
          <Button size="sm" variant="outline" loading={loading === "options"} onClick={generateOptions}>
            <Sparkles className="h-3.5 w-3.5" />3 opções
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

        {/* Ajustes de um clique + refino em linguagem natural (§29-30) */}
        {draft && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <QuickTweak
                label="Mais direta"
                busy={loading === "tweak-direta"}
                onClick={() => post({ instruction: "Mais direta e objetiva, sem rodeios." }, "tweak-direta", "Versão mais direta")}
              />
              <QuickTweak
                label="Mais curta"
                busy={loading === "tweak-curta"}
                onClick={() => post({ instruction: "Mais curta: no máximo 2 linhas, mantendo a observação específica." }, "tweak-curta", "Versão mais curta")}
              />
              <select
                className="h-7 rounded-full border border-border bg-surface px-2 text-xs text-muted outline-none transition-colors hover:text-foreground focus:border-accent"
                value=""
                disabled={loading != null}
                onChange={(e) => {
                  if (e.target.value) post({ case_name: e.target.value }, "case", `Nova versão com o case ${e.target.value}`);
                }}
              >
                <option value="">Usar outro case…</option>
                {NAVEGANDO_CASES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} — {c.niche}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyWish()}
                placeholder="O que quer mudar? (ex.: mais informal, não fala do perfil, fala primeiro do Instagram)"
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
              />
              <Button size="sm" variant="outline" loading={loading === "wish"} disabled={wish.trim().length < 2} onClick={applyWish}>
                <Wand2 className="h-3.5 w-3.5" />
                Aplicar
              </Button>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-muted">
              <CornerDownLeft className="h-3 w-3" /> Enter aplica · a IA reescreve a mensagem atual mantendo o que funciona
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickTweak({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent-2 disabled:opacity-50"
    >
      {busy ? "Gerando…" : label}
    </button>
  );
}
