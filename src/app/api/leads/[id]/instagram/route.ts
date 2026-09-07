import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { instagramEnrichSchema } from "@/lib/schemas";
import { buildInstagramUrl, fetchInstagramHandleFromWebsite } from "@/lib/instagram";

// Handle-only Instagram enrichment. Zero scraping of instagram.com, zero AI. We read
// the handle from the business's OWN website (lead.website) — either because that field
// already is an instagram.com URL, or by scanning the site's HTML for its Instagram link.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  // Body is optional; `?force` (querystring) or `{ force: true }` (body) both re-run.
  const body = await req.json().catch(() => null);
  const parsedBody = instagramEnrichSchema.safeParse(body ?? {});
  const forceFromQuery = req.nextUrl.searchParams.has("force");
  const force = forceFromQuery || (parsedBody.success && parsedBody.data.force === true);

  const admin = createAdminClient();

  const { data: lead, error: loadError } = await admin
    .from("leads")
    .select("id, name, website, instagram_handle")
    .eq("id", id)
    .single();

  if (loadError || !lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Already enriched and not forced — return the cached handle without any network call.
  if (lead.instagram_handle && !force) {
    return NextResponse.json({
      found: true,
      handle: lead.instagram_handle,
      url: buildInstagramUrl(lead.instagram_handle),
      cached: true,
    });
  }

  const now = new Date().toISOString();

  // No website — nothing to read from. Do not touch the row (we didn't actually try).
  if (!lead.website) {
    return NextResponse.json({ found: false, reason: "no_website" });
  }

  const result = await fetchInstagramHandleFromWebsite(lead.website);

  if (!result) {
    // Record that we tried so callers don't retry endlessly.
    const { error: updateError } = await admin
      .from("leads")
      .update({ instagram_confirmed: false, instagram_checked_at: now })
      .eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ found: false });
  }

  const { handle, method } = result;
  const url = buildInstagramUrl(handle);

  const { error: updateError } = await admin
    .from("leads")
    .update({
      instagram_handle: handle,
      instagram_url: url,
      instagram: handle, // legacy column used for display
      instagram_confirmed: true,
      instagram_confirmation_method: method,
      instagram_checked_at: now,
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from("outreach_events").insert({
    lead_id: id,
    event_type: "instagram_found",
    channel: "system",
    metadata: { handle, method },
  });

  return NextResponse.json({ found: true, handle, url, method });
}
