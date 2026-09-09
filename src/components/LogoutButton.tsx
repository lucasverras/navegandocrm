"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" aria-label="Sair" className={compact ? "h-11 w-11 px-0" : "justify-start"} onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
      {compact ? <span className="sr-only">Sair</span> : "Sair"}
    </Button>
  );
}
