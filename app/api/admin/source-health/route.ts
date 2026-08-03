import { NextResponse } from "next/server";
import { checkSourceHealth } from "@/src/data/health/sourceHealth";

/**
 * Proxy: live health probe across every rating/buzz scraper (REFINEMENTS.md
 * #14). Gated by a shared secret rather than user auth (there's no admin
 * role in this app yet) — locked entirely until ADMIN_HEALTH_TOKEN is set,
 * since this endpoint fans out to every scraper on each call and shouldn't
 * be publicly hittable.
 */
export async function GET(request: Request) {
  const configured = process.env.ADMIN_HEALTH_TOKEN;
  if (!configured) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("token");
  if (token !== configured) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await checkSourceHealth();
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
