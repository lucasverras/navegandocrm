"use client";

import { MessageCircle, MapPin } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { instagramUrl, type QuickActionLead } from "@/components/leads/LeadQuickActions";

// Sticky bottom action bar on mobile — the most frequent channels one thumb-tap away.
export function LeadMobileBar({ lead, whatsappMessage }: { lead: QuickActionLead; whatsappMessage?: string | null }) {
  const wa = lead.phone ? buildWhatsAppLink(lead.phone, whatsappMessage ?? "") : null;
  const ig = instagramUrl(lead);

  const cell = "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
      {wa ? (
        <a href={wa} target="_blank" rel="noreferrer" className={`${cell} text-[#25D366]`}>
          <MessageCircle className="h-5 w-5" />
          WhatsApp
        </a>
      ) : (
        <span className={`${cell} opacity-30`}>
          <MessageCircle className="h-5 w-5" />
          WhatsApp
        </span>
      )}
      {ig && (
        <a href={ig} target="_blank" rel="noreferrer" className={`${cell} text-[#E1306C]`}>
          <IgGlyph />
          Instagram
        </a>
      )}
      {lead.maps_url && (
        <a href={lead.maps_url} target="_blank" rel="noreferrer" className={cell}>
          <MapPin className="h-5 w-5" />
          Maps
        </a>
      )}
    </div>
  );
}

function IgGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
