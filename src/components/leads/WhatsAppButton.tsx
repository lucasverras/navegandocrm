"use client";

import { Button } from "@/components/ui/Button";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export function WhatsAppButton({ phone, message }: { phone: string | null; message: string }) {
  function handleClick() {
    if (!phone) {
      toast.error("Este lead não tem telefone cadastrado.");
      return;
    }
    const link = buildWhatsAppLink(phone, message);
    if (!link) {
      toast.error("Número de telefone inválido.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <Button variant="secondary" onClick={handleClick}>
      <MessageCircle className="h-4 w-4" />
      Abrir no WhatsApp
    </Button>
  );
}
