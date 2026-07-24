import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { regionCreateSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const limit = rateLimit(`regions:create:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em instantes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = regionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regions")
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single();

  if (error) {
    const isDuplicate = error.code === "23505";
    return NextResponse.json(
      { error: isDuplicate ? "Essa região já foi cadastrada." : error.message },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ region: data }, { status: 201 });
}
