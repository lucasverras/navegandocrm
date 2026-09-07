import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card, CardContent } from "@/components/ui/Card";
import { SettingsForm, type UsageLimitsValue } from "@/components/settings/SettingsForm";
import { Compass, MapPin } from "lucide-react";

const DEFAULT_LIMITS: UsageLimitsValue = {
  haiku_analyses_per_day: 100,
  decision_maker_searches_per_day: 20,
  sonnet_refinements_per_day: 10,
};

const ITEMS = [
  { href: "/descobrir", title: "Campanhas de descoberta", desc: "Buscar novos estabelecimentos por região e categoria.", icon: Compass },
  { href: "/regioes", title: "Regiões", desc: "Bairros e cidades usados nas buscas.", icon: MapPin },
];

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("settings").select("key, value");
  const byKey = new Map(((rows ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));

  const usageLimits = {
    ...DEFAULT_LIMITS,
    ...((byKey.get("usage_limits") as Partial<UsageLimitsValue> | undefined) ?? {}),
  };
  const blocklist = (byKey.get("discovery_blocklist") as
    | { extra_blocked_keywords?: string[]; extra_blocked_brands?: string[] }
    | undefined) ?? {};

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Ajustes"
        title="Configurações"
        subtitle="Limites de uso da IA e filtros globais de descoberta em um só lugar."
      />

      <SettingsForm
        initialUsageLimits={usageLimits}
        initialBlockedKeywords={blocklist.extra_blocked_keywords ?? []}
        initialBlockedBrands={blocklist.extra_blocked_brands ?? []}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Campanhas e regiões</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ITEMS.map(({ href, title, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-accent-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">{title}</div>
                    <p className="text-sm text-muted">{desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
