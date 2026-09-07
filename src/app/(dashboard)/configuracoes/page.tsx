import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card, CardContent } from "@/components/ui/Card";
import { Compass, MapPin } from "lucide-react";

const ITEMS = [
  { href: "/descobrir", title: "Campanhas de descoberta", desc: "Buscar novos estabelecimentos por região e categoria.", icon: Compass },
  { href: "/regioes", title: "Regiões", desc: "Bairros e cidades usados nas buscas.", icon: MapPin },
];

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Ajustes" title="Configurações" />
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
  );
}
