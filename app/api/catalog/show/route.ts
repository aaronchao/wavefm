import { NextResponse } from "next/server";
import { lookupShowEnriched } from "@/src/data/catalog/lookup";

// Proxy: show lookup by id — iTunes collectionId, or `pi-<feedId>` for
// Podcast-Index-only shows. Missing/unreachable -> { show: null }, never 5xx.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const show = await lookupShowEnriched(id);

  return NextResponse.json(
    { show },
    {
      status: show ? 200 : 404,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    },
  );
}
