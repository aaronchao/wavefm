import { ENGAGEMENT_WEIGHTS, type EngagementType } from "@/src/core/engagement";
import type { CatalogShow } from "@/src/data/catalog/types";
import { getSupabase } from "@/src/data/supabase/client";
import type { EngagementRow, ShowRow } from "@/src/data/supabase/types";
import { rowToCatalogShow, upsertShow } from "./showRepo";

/**
 * Engagement events — the recommendation engine's input signal.
 * Signed in -> Supabase; signed out -> localStorage (with show snapshots
 * so taste can still be computed), migrated on sign-in. Never throws.
 */

const LOCAL_KEY = "wavr.engagement.v1";

type LocalEngagement = {
  showId: string;
  type: EngagementType;
  createdAt: string;
  show: CatalogShow;
};

export type EngagementLog = {
  engagements: { showId: string; type: EngagementType }[];
  shows: CatalogShow[];
};

function readLocal(): LocalEngagement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalEngagement[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: LocalEngagement[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // storage full/blocked — silently drop rather than crash
  }
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function recordEngagement(
  show: CatalogShow,
  type: EngagementType,
): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) {
    writeLocal([
      ...readLocal(),
      { showId: show.id, type, createdAt: new Date().toISOString(), show },
    ]);
    return;
  }
  await upsertShow(show); // keep the shared catalog cache warm
  await sb.from("engagement").insert({
    user_id: userId,
    show_id: show.id,
    type,
    weight: ENGAGEMENT_WEIGHTS[type],
  });
}

/** Full engagement history + metadata for every show referenced by it. */
export async function listEngagements(): Promise<EngagementLog> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) {
    const local = readLocal();
    const byId = new Map(local.map((e) => [e.show.id, e.show]));
    return {
      engagements: local.map((e) => ({ showId: e.showId, type: e.type })),
      shows: [...byId.values()],
    };
  }
  const { data: rows } = await sb
    .from("engagement")
    .select("show_id, type")
    .order("created_at", { ascending: true });
  const engagements = (rows ?? []).map((r) => ({
    showId: (r as Pick<EngagementRow, "show_id" | "type">).show_id,
    type: (r as Pick<EngagementRow, "show_id" | "type">).type,
  }));
  const ids = [...new Set(engagements.map((e) => e.showId))];
  let shows: CatalogShow[] = [];
  if (ids.length > 0) {
    const { data: showRows } = await sb.from("shows").select("*").in("id", ids);
    shows = ((showRows ?? []) as ShowRow[]).map(rowToCatalogShow);
  }
  return { engagements, shows };
}

/** Pushes signed-out engagement to Supabase after sign-in. */
export async function migrateLocalEngagements(): Promise<void> {
  const sb = getSupabase();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const local = readLocal();
  if (local.length === 0) return;
  for (const e of local) {
    await upsertShow(e.show);
    await sb.from("engagement").insert({
      user_id: userId,
      show_id: e.showId,
      type: e.type,
      weight: ENGAGEMENT_WEIGHTS[e.type],
      created_at: e.createdAt,
    });
  }
  writeLocal([]);
}
