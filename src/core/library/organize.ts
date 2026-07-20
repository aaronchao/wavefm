import { detectLang, type Lang } from "@/src/core/recommend/language";

/**
 * Library auto-organization (PURE — no React/Next/DB imports). Turns a flat
 * pile of saved shows into two human groupings the Library UI renders:
 *   • Categories — CJK shows grouped by language (中文 / 日本語 / 한국어), the
 *     rest by a canonical topic. Literal, predictable.
 *   • Vibes — each show assigned a playful "personality" from its words, so a
 *     big library sorts itself into 🕳️ Rabbit holes / ☕ Cozy corner / … .
 * Deterministic and keyword-driven, so it works instantly on existing saves
 * with zero per-view API cost. Fully unit-tested.
 */

/** The minimal shape either grouping needs — a subset of CatalogShow. */
export type LibShow = {
  title: string;
  description?: string;
  categories: string[];
};

export type Vibe = { id: string; emoji: string; label: string };

/**
 * The vibe taxonomy, in tie-break priority order (an earlier vibe wins when
 * two score equally). "On rotation" is the catch-all when nothing matches.
 */
export const VIBES: Vibe[] = [
  { id: "edge", emoji: "🔪", label: "On edge" },
  { id: "mind", emoji: "🤯", label: "Mind-benders" },
  { id: "feels", emoji: "🫀", label: "In your feels" },
  { id: "laughs", emoji: "😂", label: "Good laughs" },
  { id: "brain", emoji: "📚", label: "Brain food" },
  { id: "cozy", emoji: "☕", label: "Cozy corner" },
  { id: "rabbit", emoji: "🕳️", label: "Rabbit holes" },
  { id: "rotation", emoji: "🎧", label: "On rotation" },
];

const VIBE_KEYWORDS: Record<string, string[]> = {
  edge: ["true crime", "crime", "thriller", "mystery", "murder", "悬疑", "犯罪", "恐怖", "horror", "侦探"],
  mind: ["science", "technology", "tech", "physics", "space", " ai ", "philosophy", "脑洞", "科技", "科学", "未来", "宇宙"],
  feels: ["relationship", "emotional", "mental health", "therapy", "情感", "治愈", "心理", "恋爱", "memoir", "personal"],
  laughs: ["comedy", "humor", "humour", "funny", "improv", "搞笑", "喜剧", "脱口秀", "相声"],
  brain: ["education", "history", "business", "learning", "finance", "economics", "读书", "历史", "商业", "财经", "知识", "教育"],
  cozy: ["lifestyle", "daily", "food", "travel", "wellness", "生活", "旅行", "美食", "日常", "陪伴"],
  rabbit: ["documentary", "investigation", "deep dive", "culture", "society", "storytelling", "interview", "文化", "故事", "社会", "深度", "访谈", "纪实"],
};

/** Assign a show its single best-fitting vibe (deterministic). */
export function vibeOf(show: LibShow): Vibe {
  const hay = ` ${show.title} ${show.description ?? ""} ${show.categories.join(" ")} `.toLowerCase();
  let best = VIBES[VIBES.length - 1]; // "On rotation" catch-all
  let bestScore = 0;
  for (const vibe of VIBES) {
    const kws = VIBE_KEYWORDS[vibe.id];
    if (!kws) continue;
    let score = 0;
    for (const kw of kws) if (hay.includes(kw)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = vibe;
    }
  }
  return best;
}

const LANG_LABEL: Record<Lang, string> = {
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  en: "English",
  other: "Other",
};

/** Canonical topic buckets — collapse the long tail of iTunes genres. */
const CANON: [RegExp, string][] = [
  [/true crime|crime|murder/i, "True Crime"],
  [/tech/i, "Technology"],
  [/science/i, "Science"],
  [/business|entrepreneur|finance|econ|invest/i, "Business"],
  [/comed|humor|humour/i, "Comedy"],
  [/news|politic|government/i, "News & Politics"],
  [/history/i, "History"],
  [/health|fitness|medic|wellness/i, "Health"],
  [/society|culture|philosoph/i, "Society & Culture"],
  [/education|learning|language|course/i, "Education"],
  [/art|design|book|fiction|literature|writing/i, "Arts & Books"],
  [/sport/i, "Sports"],
  [/music/i, "Music"],
  [/tv|film|movie|entertain/i, "TV & Film"],
  [/religion|spiritual|faith/i, "Religion"],
  [/kids|family|child/i, "Kids & Family"],
  [/travel|leisure|food|hobby|game/i, "Leisure"],
];

/** The canonical topic for a show, from its first recognizable category. */
export function categoryOf(show: LibShow): string {
  for (const c of show.categories) {
    for (const [re, label] of CANON) if (re.test(c)) return label;
  }
  const first = show.categories.find((c) => c.trim());
  return first?.trim() ?? "Uncategorized";
}

export type Group<T> = { key: string; emoji?: string; items: T[] };

function push<T>(map: Map<string, T[]>, key: string, item: T): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(item);
  else map.set(key, [item]);
}

/**
 * Categories grouping: CJK shows by language, everything else by topic.
 * Ordered biggest-group-first (a `localeCompare` tie-break keeps it stable).
 */
export function groupByCategory<T extends LibShow>(shows: T[]): Group<T>[] {
  const map = new Map<string, T[]>();
  for (const s of shows) {
    const lang = detectLang(`${s.title} ${s.description ?? ""}`);
    const key = lang === "zh" || lang === "ja" || lang === "ko" ? LANG_LABEL[lang] : categoryOf(s);
    push(map, key, s);
  }
  return [...map.entries()]
    .map(([key, items]) => ({ key, items }))
    .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
}

/** Vibes grouping, ordered by the fixed VIBES priority (empty vibes dropped). */
export function groupByVibe<T extends LibShow>(shows: T[]): Group<T>[] {
  const byId = new Map<string, T[]>();
  for (const s of shows) push(byId, vibeOf(s).id, s);
  return VIBES.filter((v) => byId.has(v.id)).map((v) => ({
    key: v.label,
    emoji: v.emoji,
    items: byId.get(v.id)!,
  }));
}
