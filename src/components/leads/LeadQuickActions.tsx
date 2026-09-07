"use client";

import { MessageCircle, MapPin, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// Real Instagram glyph — lucide-react in this project does not ship an `Instagram` export.
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export interface QuickActionLead {
  name: string;
  phone?: string | null;
  website?: string | null;
  maps_url?: string | null;
  instagram?: string | null;
  instagram_url?: string | null;
  instagram_handle?: string | null;
}

// Builds a canonical instagram.com profile URL from whatever IG signal a lead has.
export function instagramUrl(lead: QuickActionLead): string | null {
  if (lead.instagram_url) return lead.instagram_url;
  const handle = lead.instagram_handle ?? lead.instagram;
  if (!handle) return null;
  const clean = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  if (!clean) return null;
  return `https://instagram.com/${clean}`;
}

// Compact row of channel actions (Instagram / WhatsApp / Maps / site) surfaced on every
// card and table row so the operator never has to open the lead just to reach a channel.
// `stopNavigation` marks the links so a parent card's click/drag handlers ignore them.
export function LeadQuickActions({
  lead,
  stopNavigation = false,
  className,
}: {
  lead: QuickActionLead;
  stopNavigation?: boolean;
  className?: string;
}) {
  const ig = instagramUrl(lead);
  const wa = lead.phone ? buildWhatsAppLink(lead.phone, "") : null;
  const guard = stopNavigation ? { "data-no-navigate": "" } : {};
  const stop = stopNavigation ? (e: React.MouseEvent) => e.stopPropagation() : undefined;

  const base =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover";

  return (
    <div className={cn("flex items-center gap-0.5", className)} {...guard}>
      {ig ? (
        <a
          href={ig}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          title="Abrir Instagram"
          aria-label="Abrir Instagram"
          className={cn(base, "hover:text-[#E1306C]")}
          {...guard}
        >
          <InstagramIcon className="h-4 w-4" />
        </a>
      ) : (
        <span
          title="Instagram não encontrado"
          aria-label="Instagram não encontrado"
          className={cn(base, "cursor-default opacity-30")}
          {...guard}
        >
          <InstagramIcon className="h-4 w-4" />
        </span>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          title="Abrir WhatsApp"
          aria-label="Abrir WhatsApp"
          className={cn(base, "hover:text-[#25D366]")}
          {...guard}
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      )}

      {lead.maps_url && (
        <a
          href={lead.maps_url}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          title="Ver no Google Maps"
          aria-label="Ver no Google Maps"
          className={cn(base, "hover:text-accent-2")}
          {...guard}
        >
          <MapPin className="h-4 w-4" />
        </a>
      )}

      {lead.website && (
        <a
          href={lead.website}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          title="Abrir site"
          aria-label="Abrir site"
          className={cn(base, "hover:text-foreground")}
          {...guard}
        >
          <Globe className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
