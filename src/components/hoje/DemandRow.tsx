import Link from "next/link";
import { MessageCircle, Video } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { BRL } from "@/lib/finance";
import { actionLine, demandHandle, demandInstagramUrl, type Demand } from "./demand";

const TONE_CLASS = {
  danger: "font-medium text-danger",
  warning: "font-medium text-warning",
  muted: "text-muted",
} as const;

// Compact post-it row: two lines, no card, no badges. Name → what to do → contacts, with
// WhatsApp one click away (pre-filled when a message exists).
export function DemandRow({ demand, todayStart, message }: { demand: Demand; todayStart: Date; message?: string | null }) {
  const line = actionLine(demand, todayStart);
  const handle = demandHandle(demand);
  const igUrl = demandInstagramUrl(demand);
  const wa = demand.phone ? buildWhatsAppLink(demand.phone, message ?? "") : null;

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/70 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <Link href={`/leads/${demand.id}`} className="truncate text-sm font-semibold text-foreground transition-colors hover:text-accent-2">
            {demand.name}
          </Link>
          {demand.next_action_type === "chase_proposal" && demand.proposal_value != null && (
            <span className="shrink-0 text-xs tabular-nums text-muted">{BRL.format(demand.proposal_value)}/mês</span>
          )}
        </div>
        <p className="truncate text-xs">
          <span className={TONE_CLASS[line.tone]}>{line.text}</span>
          {demand.phone && <span className="text-muted"> · {demand.phone}</span>}
          {handle && igUrl && (
            <>
              <span className="text-muted"> · </span>
              <a href={igUrl} target="_blank" rel="noreferrer" className="text-accent-2 hover:underline">
                @{handle}
              </a>
            </>
          )}
          {demand.region?.neighborhood && <span className="text-muted"> · {demand.region.neighborhood}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {demand.meeting_link && demand.next_action_type === "meeting" && (
          <a
            href={demand.meeting_link}
            target="_blank"
            rel="noreferrer"
            title="Abrir Meet"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent-2 transition-colors hover:bg-accent/20"
          >
            <Video className="h-4 w-4" />
          </a>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            title="Abrir WhatsApp"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#25D366]/10 text-[#1da851] transition-colors hover:bg-[#25D366]/20"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
      </div>
    </li>
  );
}
