import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

// Proxies a Google Places photo without exposing the API key in the browser. The photo
// resource name is stable, so the resolved googleusercontent URL is safe to cache hard.
const NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!NAME_RE.test(name)) return NextResponse.json({ error: "Foto inválida" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY não configurada" }, { status: 503 });

  const res = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": apiKey } }
  );
  if (!res.ok) return NextResponse.json({ error: "Foto indisponível" }, { status: 404 });

  const data = (await res.json()) as { photoUri?: string };
  if (!data.photoUri) return NextResponse.json({ error: "Foto indisponível" }, { status: 404 });

  return NextResponse.redirect(data.photoUri, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}
