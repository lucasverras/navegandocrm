"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, X, Check } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { instagramUrl, type QuickActionLead } from "@/components/leads/LeadQuickActions";

export type FilaDemand = QuickActionLead & {
  id: string;
  reason: string;
  region: string | null;
  decisor: string | null;
  message: string | null;
};

// "Trabalhar fila": one demand at a time. Register a result and advance instantly — the SDR
// works the whole day without leaving this view. Reuses the response + follow-up endpoints.
export function TrabalharFila({ demands }: { demands: FilaDemand[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const total = demands.length;
  const current = demands[index];

  function next() {
    setIndex((i) => i + 1);
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
    // No refresh while the fullscreen modal is open — the index already advanced.
  }

  async function cadence() {
    if (!current || busy) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${current.id}/cadence`, { method: "PATCH" }).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => null) : null;
    setBusy(false);
    toast.success(data?.days ? `Follow-up em ${data.days} dias (cadência)` : "Follow-up agendado");
    next();
    // No refresh while the fullscreen modal is open — the index already advanced.
  }

  async function followUp(days: number, label: string) {
    if (!current || busy) return;
    setBusy(true);
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    await fetch(`/api/leads/${current.id}/follow-up`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_follow_up_at: d.toISOString() }),
    }).catch(() => null);
    setBusy(false);
    toast.success(label);
    next();
    // No refresh while the fullscreen modal is open — the index already advanced.
  }

  if (total === 0) {
    return <span className="text-sm text-muted">Nada na fila 🎉</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-2"
      >
        Trabalhar fila
        <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs tabular-nums">{total}</span>
      </button>

      {open && (
        <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="text-sm tabular-nums text-muted">
              {Math.min(index + 1, total)} / {total}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 items-start justify-center overflow-y-auto p-4">
            {!current ? (
              <div className="mt-[15vh] flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-2">
                  <Check className="h-7 w-7" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">Fila concluída</h2>
                <p className="text-sm text-muted">Você trabalhou todas as {total} demandas. Bom trabalho.</p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/hoje?f=todas");
                  }}
                  className="mt-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-accent"
                >
                  Ver todas as demandas
                </button>
              </div>
            ) : (
              <div className="mt-[4vh] flex w-full max-w-md flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-2">{current.reason}</p>
                  <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">{current.name}</h2>
                  {(current.decisor || current.region) && (
                    <p className="mt-1 text-sm text-muted">{[current.decisor, current.region].filter(Boolean).join(" · ")}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 tabular-nums">
                  {current.phone && <span className="text-lg font-semibold text-foreground">{current.phone}</span>}
                  {instagramUrl(current) && (
                    <a href={instagramUrl(current)!} target="_blank" rel="noreferrer" className="text-sm text-accent-2 hover:underline">
                      @{(current.instagram_handle ?? current.instagram ?? "").replace(/^@/, "")}
                    </a>
                  )}
                </div>

                {current.message && (
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted">Mensagem recomendada</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{current.message}</p>
                  </div>
                )}

                {current.phone ? (
                  <a
                    href={buildWhatsAppLink(current.phone, current.message ?? "") ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <MessageCircle className="h-5 w-5" /> WhatsApp
                  </a>
                ) : (
                  <p className="text-sm text-muted">Sem telefone — abra o Instagram para contatar.</p>
                )}

                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Resultado</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ResultBtn onClick={cadence} disabled={busy}>
                      Sem resposta
                    </ResultBtn>
                    <ResultBtn onClick={() => response("respondeu")} disabled={busy}>
                      Respondeu
                    </ResultBtn>
                    <ResultBtn onClick={() => followUp(3, "Chamar em 3 dias")} disabled={busy}>
                      Chamar depois
                    </ResultBtn>
                    <ResultBtn onClick={() => response("reuniao")} disabled={busy}>
                      Reunião
                    </ResultBtn>
                    <ResultBtn onClick={() => response("interessado")} disabled={busy}>
                      Interessado
                    </ResultBtn>
                    <ResultBtn danger onClick={() => response("nao_interessado")} disabled={busy}>
                      Negativa
                    </ResultBtn>
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
