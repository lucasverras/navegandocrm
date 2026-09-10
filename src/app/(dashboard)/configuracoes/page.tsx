import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { SettingsForm, type UsageLimitsValue } from "@/components/settings/SettingsForm";
import { Compass, MapPin } from "lucide-react";

const DEFAULT_LIMITS: UsageLimitsValue = {
  ai_analyses_per_day: 100,
  decision_maker_searches_per_day: 20,
  ai_refinements_per_day: 10,
};

const ITEMS = [
  { href: "/descobrir", title: "Campanhas de descoberta", desc: "Buscar novos estabelecimentos por região e categoria.", icon: Compass },
  { href: "/regioes", title: "Regiões", desc: "Bairros e cidades usados nas buscas.", icon: MapPin },
];

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("settings").select("key, value");
  const byKey = new Map(((rows ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));

  const stored = (byKey.get("usage_limits") as Record<string, number> | undefined) ?? {};
  const usageLimits: UsageLimitsValue = {
    ai_analyses_per_day: stored.ai_analyses_per_day ?? stored.haiku_analyses_per_day ?? DEFAULT_LIMITS.ai_analyses_per_day,
    decision_maker_searches_per_day: stored.decision_maker_searches_per_day ?? DEFAULT_LIMITS.decision_maker_searches_per_day,
    ai_refinements_per_day: stored.ai_refinements_per_day ?? stored.sonnet_refinements_per_day ?? DEFAULT_LIMITS.ai_refinements_per_day,
  };
  const blocklist = (byKey.get("discovery_blocklist") as
    | { extra_blocked_keywords?: string[]; extra_blocked_brands?: string[] }
    | undefined) ?? {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Ajustes"
        title="Configurações"
        subtitle="Limites de IA, filtros de descoberta e acesso rápido a campanhas e regiões."
      />

      <SettingsForm
        initialUsageLimits={usageLimits}
        initialBlockedKeywords={blocklist.extra_blocked_keywords ?? []}
        initialBlockedBrands={blocklist.extra_blocked_brands ?? []}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Campanhas e regiões</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ITEMS.map(({ href, title, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40 hover:shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent-2">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{title}</div>
                  <p className="truncate text-xs text-muted">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
