import { NextResponse } from "next/server";
import { getUsageSnapshot } from "@/src/data/health/usageSnapshot";

/**
 * Proxy: cost/quotas snapshot (REFINEMENTS.md #30). Gated by the same
 * shared secret as /api/admin/source-health — one token, two internal
 * ops pages; no admin role exists in this app to gate on instead.
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

  const snapshot = await getUsageSnapshot();
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
