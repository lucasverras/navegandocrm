"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { CalendarClock, FileText, X } from "lucide-react";

// Structured Reunião + Proposta capture (simple, per brief). Lives in the lead header actions.
export function MeetingProposalActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "meeting" | "proposal">(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");

  async function saveMeeting() {
    if (!date || !time) return toast.error("Data e hora são obrigatórias");
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_at: new Date(`${date}T${time}`).toISOString(), meeting_link: link.trim() || undefined, note: note.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Erro ao marcar reunião");
    toast.success("Reunião marcada");
    setDialog(null);
    router.refresh();
  }

  async function saveProposal() {
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/proposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: value.trim() ? Number(value.replace(",", ".")) : null, note: note.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Erro ao registrar proposta");
    toast.success("Proposta registrada");
    setDialog(null);
    router.refresh();
  }

  const input = "h-9 w-full rounded-md border border-border bg-surface-2 px-2 text-sm text-foreground outline-none focus:border-accent";

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { setNote(""); setDialog("meeting"); }}>
        <CalendarClock className="h-3.5 w-3.5" /> Reunião
      </Button>
      <Button size="sm" variant="secondary" onClick={() => { setNote(""); setValue(""); setDialog("proposal"); }}>
        <FileText className="h-3.5 w-3.5" /> Proposta
      </Button>

      {dialog && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDialog(null)}>
          <div className="animate-scale-in w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">{dialog === "meeting" ? "Marcar reunião" : "Registrar proposta"}</h2>
              <button type="button" onClick={() => setDialog(null)} aria-label="Fechar" className="text-muted hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {dialog === "meeting" ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-muted">Data<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
                  <label className="flex flex-col gap-1 text-xs text-muted">Hora<input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} /></label>
                </div>
                <label className="flex flex-col gap-1 text-xs text-muted">Link do Meet<input className={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." /></label>
                <label className="flex flex-col gap-1 text-xs text-muted">Observação<input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></label>
                <div className="mt-1 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
                  <Button size="sm" loading={busy} onClick={saveMeeting}>Marcar</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted">Valor mensal enviado (R$)<input className={input} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="4000" /></label>
                <label className="flex flex-col gap-1 text-xs text-muted">Observação<input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: 8 vídeos + gestão de redes" /></label>
                <div className="mt-1 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
                  <Button size="sm" loading={busy} onClick={saveProposal}>Registrar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
