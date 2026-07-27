"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { toast } from "sonner";
import { Compass } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }

    toast.success("Bem-vindo de volta");
    const redirectTo = searchParams.get("redirect") || "/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* Editorial hero — mirrors the agency's own site voice */}
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-8 py-16 sm:px-14 lg:px-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 500px at 15% 20%, rgba(200,96,31,0.16), transparent), radial-gradient(600px 400px at 85% 80%, rgba(228,128,47,0.10), transparent)",
          }}
        />
        <div className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-accent-2">
            <Compass className="h-4 w-4" />
          </div>
          <span className="eyebrow">Navegando MKT · Sistema interno</span>
        </div>
        <h1 className="font-display relative mt-6 max-w-2xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-foreground sm:text-6xl">
          A gente não cria conteúdo.
          <br />
          <span className="text-accent-2">A gente cria desejo.</span>
        </h1>
        <p className="relative mt-6 max-w-md text-sm leading-relaxed text-muted">
          Radar Navegando é o painel de prospecção da nossa própria equipe: encontra restaurantes, mede oportunidade
          e transforma atenção em movimento real para os clientes.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center border-t border-border px-6 py-16 lg:border-l lg:border-t-0">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Entrar</h2>
            <p className="mt-1 text-sm text-muted">Acesso restrito à equipe.</p>
          </div>

          <Card className="animate-fade-in">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@navegandomkt.com.br"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" loading={loading} className="mt-2 w-full">
                  Entrar
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted">
            Sem cadastro público. Peça ao administrador para criar seu acesso no Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
