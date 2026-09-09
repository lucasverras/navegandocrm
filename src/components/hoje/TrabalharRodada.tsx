"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, X, Check, MapPin, Copy } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { instagramUrl, type QuickActionLead } from "@/components/leads/LeadQuickActions";
import { CONTACT_ROUND_LABELS, type ContactRound } from "@/types/domain";

type RoundLead = QuickActionLead & {
  id: string;
  contact_round: string;
  commercial_status: string | null;
  message: string | null;
  decisor: string | null;
  regionName: string | null;
};

// "Trabalhar rodada" (V7 §26-30): fullscreen one-at-a-time mode for a specific contact round.
// The SDR works through FIRST_CONTACT, FUP_1, FUP_2 or FUP_3 without navigating the CRM.
export function TrabalharRodada({ round }: { round: ContactRound }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<RoundLead[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const label = CONTACT_ROUND_LABELS[round];

  async function loadLeads() {
    setLoading(true);
    const res = await fetch(`/api/leads/round?round=${round}`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setLeads(data.leads ?? []);
    }
    setLoading(false);
  }

  const total = leads.length;
  const current = index < total ? leads[index] : null;

  function next() {
    setIndex((i) => i + 1);
  }

  async function markSentAndAdvance() {
    if (!current || busy) return;
    setBusy(true);
    await fetch(`/api/leads/${current.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "message_sent" }),
    }).catch(() => null);
    setBusy(false);
    toast.success("Mensagem marcada como enviada");
  }

  async function response(kind: string) {
    if (!current || busy) return;
    setBusy(true);
    await fetch(`/api/leads/${current.id}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: kind }),
    }).catch(() => null);
    setBusy(false);
    next();
    router.refresh();
  }

  async function cadence() {
    if (!current || busy) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${current.id}/cadence`, { method: "PATCH" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setBusy(false);
    toast.success(data?.days ? `Próxima rodada em ${data.days} dias` : "Avançado");
    next();
    router.refresh();
  }

  async function copyMessage() {
    if (current?.message) {
      await navigator.clipboard.writeText(current.message);
      toast.success("Mensagem copiada");
    }
  }

  const ig = current ? instagramUrl(current) : null;
  const handle = current ? (current.instagram_handle ?? current.instagram ?? "").replace(/^@/, "") : "";
  const wa = current?.phone ? buildWhatsAppLink(current.phone, current.message ?? "") : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
          loadLeads();
        }}
        className="text-xs font-medium text-accent-2 transition-colors hover:text-accent"
      >
        Trabalhar
      </button>

      {open && (
        <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-accent-2">{label}</span>
              {!loading && (
                <span className="text-sm tabular-nums text-muted">
                  {current ? `${index + 1} / ${total}` : `${total} concluídos`}
                </span>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 items-start justify-center overflow-y-auto p-4">
            {loading ? (
              <p className="mt-[20vh] text-sm text-muted">Carregando rodada…</p>
            ) : !current ? (
              <div className="mt-[15vh] flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-2">
                  <Check className="h-7 w-7" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">Rodada concluída</h2>
                <p className="text-sm text-muted">
                  {total > 0 ? `Você trabalhou ${total} lead${total > 1 ? "s" : ""}.` : "Nenhum lead nesta rodada."}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-accent"
                >
                  Voltar
                </button>
              </div>
            ) : (
              <div className="mt-[4vh] flex w-full max-w-md flex-col gap-5">
                {/* Lead header */}
                <div>
                  <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground">{current.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {[current.decisor, current.regionName].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>

                {/* Contacts */}
                <div className="flex flex-col gap-1.5">
                  {current.phone && (
                    <span className="text-lg font-semibold tabular-nums text-foreground">{current.phone}</span>
                  )}
                  {ig && handle && (
                    <a href={ig} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-2 hover:underline">
                      @{handle}
                    </a>
                  )}
                  {current.maps_url && (
                    <a href={current.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
                      <MapPin className="h-3.5 w-3.5" /> Google Maps
                    </a>
                  )}
                </div>

                {/* Message */}
                {current.message && (
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-muted">Mensagem sugerida</p>
                      <button type="button" onClick={copyMessage} className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{current.message}</p>
                  </div>
                )}

                {/* WhatsApp CTA */}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
                  </a>
                ) : current.phone ? (
                  <p className="text-sm text-muted">Sem mensagem pronta — abra o WhatsApp manualmente.</p>
                ) : (
                  <p className="text-sm text-muted">Sem telefone — use o Instagram.</p>
                )}

                {/* Sent confirmation (§28) */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={markSentAndAdvance}
                    className="flex-1 rounded-md border border-accent bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent-2 transition-colors hover:bg-accent/10 disabled:opacity-50"
                  >
                    Enviado ✓
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={next}
                    className="flex-1 rounded-md border border-border px-3 py-2.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Não enviei
                  </button>
                </div>

                {/* Results (§27) */}
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">O que aconteceu?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ResultBtn onClick={cadence} disabled={busy}>Sem resposta</ResultBtn>
                    <ResultBtn onClick={() => response("respondeu")} disabled={busy}>Respondeu</ResultBtn>
                    <ResultBtn onClick={() => response("interessado")} disabled={busy}>Falando com decisor</ResultBtn>
                    <ResultBtn onClick={() => response("reuniao")} disabled={busy}>Reunião</ResultBtn>
                    <ResultBtn onClick={() => response("apresentacao")} disabled={busy}>Proposta</ResultBtn>
                    <ResultBtn danger onClick={() => response("nao_interessado")} disabled={busy}>Perdido</ResultBtn>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={next}
                    className="mt-3 w-full rounded-md border border-border py-2 text-sm text-muted hover:text-foreground"
                  >
                    Pular →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ResultBtn({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-2.5 text-sm transition-colors disabled:opacity-50 ${
        danger ? "border-border text-muted hover:border-danger hover:text-danger" : "border-border text-foreground hover:border-accent hover:bg-accent-soft"
      }`}
    >
      {children}
    </button>
  );
}
