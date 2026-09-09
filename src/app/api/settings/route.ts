import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { z } from "zod";

// Settings are key/value rows in `public.settings` (jsonb value). Two keys matter here:
//   - `usage_limits`        → { haiku_analyses_per_day, decision_maker_searches_per_day, sonnet_refinements_per_day }
//     (read/written by src/lib/cost-control.ts — keep this shape intact)
//   - `discovery_blocklist` → { extra_blocked_keywords: string[], extra_blocked_brands: string[] }
//     (global supplement to the hardcoded discovery filter)

const usageLimitsSchema = z.object({
  haiku_analyses_per_day: z.number().int().min(0).max(100000),
  decision_maker_searches_per_day: z.number().int().min(0).max(100000),
  sonnet_refinements_per_day: z.number().int().min(0).max(100000),
});

// Free-form list of short strings; trimmed + de-duped on the way in.
const stringListSchema = z.array(z.string().trim().min(1).max(80)).max(500);

const updateSchema = z
  .object({
    usage_limits: usageLimitsSchema.optional(),
    extra_blocked_keywords: stringListSchema.optional(),
    extra_blocked_brands: stringListSchema.optional(),
  })
  .refine(
    (v) =>
      v.usage_limits !== undefined ||
      v.extra_blocked_keywords !== undefined ||
      v.extra_blocked_brands !== undefined,
    { message: "Nada para atualizar" }
  );

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const rows: { key: string; value: Json }[] = [];

  if (parsed.data.usage_limits) {
    rows.push({ key: "usage_limits", value: parsed.data.usage_limits });
  }

  if (parsed.data.extra_blocked_keywords !== undefined || parsed.data.extra_blocked_brands !== undefined) {
    // Merge onto the current blocklist so a partial PATCH doesn't wipe the other list.
    const { data: currentRaw } = await admin
      .from("settings")
      .select("value")
      .eq("key", "discovery_blocklist")
      .maybeSingle();
    const current = ((currentRaw as { value: unknown } | null)?.value ?? {}) as {
      extra_blocked_keywords?: string[];
      extra_blocked_brands?: string[];
    };
    rows.push({
      key: "discovery_blocklist",
      value: {
        extra_blocked_keywords: dedupe(
          parsed.data.extra_blocked_keywords ?? current.extra_blocked_keywords ?? []
        ),
        extra_blocked_brands: dedupe(parsed.data.extra_blocked_brands ?? current.extra_blocked_brands ?? []),
      },
    });
  }

  // upsert (not update): the `discovery_blocklist` row is not seeded by migrations.
  const { data, error } = await admin.from("settings").upsert(rows, { onConflict: "key" }).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings: data });
}
