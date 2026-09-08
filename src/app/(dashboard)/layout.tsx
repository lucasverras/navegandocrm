import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { CommandPalette, SearchTrigger } from "@/components/CommandPalette";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { NewLeadDialog } from "@/components/NewLeadDialog";
import { Compass } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  const [{ count: overdueCount }, { count: pendingReviewCount }, { data: regionsRaw }] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .lt("next_action_at", nowIso)
      .or("pipeline_stage.is.null,pipeline_stage.neq.closed")
      .is("archived_at", null),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("triage_status", "pending_review"),
    supabase.from("regions").select("id, neighborhood, city").order("neighborhood", { ascending: true }),
  ]);
  const regions = (regionsRaw ?? []) as { id: string; neighborhood: string; city: string }[];

  const navItems: NavItem[] = [
    { href: "/hoje", label: "Hoje", icon: "CalendarClock", badge: overdueCount ?? 0 },
    { href: "/prospeccao", label: "Prospecção", icon: "Compass", badge: pendingReviewCount ?? 0 },
    { href: "/pipeline", label: "Pipeline", icon: "KanbanSquare" },
    { href: "/resultados", label: "Resultados", icon: "Wallet" },
    { href: "/historico", label: "Histórico", icon: "History" },
    { href: "/configuracoes", label: "Configurações", icon: "MapPin" },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <CommandPalette />
      <LeadDrawer />
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-accent-2">
            <Compass className="h-4 w-4" />
          </div>
          <span className="font-display text-sm font-extrabold uppercase tracking-wide">Radar Navegando</span>
        </div>
        <div className="mb-3 flex flex-col gap-2">
          <NewLeadDialog regions={regions} />
          <SearchTrigger className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:text-foreground" />
        </div>
        <NavLinks items={navItems} />
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          <p className="truncate px-2 text-xs text-muted">{user.email}</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-accent-2">
            <Compass className="h-3.5 w-3.5" />
          </div>
          <span className="font-display text-sm font-extrabold uppercase tracking-wide">Radar Navegando</span>
        </div>
        <LogoutButton />
      </div>
      <div className="overflow-x-auto border-b border-border bg-surface/40 px-2 py-2 md:hidden">
        <div className="flex w-max gap-1">
          <NavLinks items={navItems} orientation="horizontal" />
        </div>
      </div>

      <main className="min-h-screen flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
