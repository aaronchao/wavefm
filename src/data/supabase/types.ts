import type { EngagementType } from "@/src/core/engagement";

/** Row shapes for the Supabase tables in supabase/schema.sql. */

export type ShowRow = {
  id: string;
  itunes_id: string | null;
  feed_url: string | null;
  title: string;
  author: string | null;
  description: string | null;
  categories: string[];
  language: string | null;
  cover_url: string | null;
  cluster_tags: string[];
  platform_links: {
    apple?: string;
    spotify?: string;
    youtubeMusic?: string;
    xiaoyuzhou?: string;
  };
  updated_at: string;
};

export type SavedShowRow = {
  user_id: string;
  show_id: string;
  created_at: string;
};

export type EngagementRow = {
  id: number;
  user_id: string;
  show_id: string;
  type: EngagementType;
  weight: number;
  created_at: string;
};

export type PrefsRow = {
  user_id: string;
  interests: string[];
  rating_sources: { apple?: boolean; douban?: boolean; xiaoyuzhou?: boolean };
  /** One-tap default for the primary "Listen" action — REFINEMENTS.md #4. */
  preferred_player?: "apple" | "spotify" | "youtubeMusic" | "pocketCasts" | "xiaoyuzhou" | null;
  /** Opaque token for the personal Listen-Later feed URL — REFINEMENTS.md #2. */
  feed_token?: string;
  /** Opaque token for the public "share your Queue" page. Opt-in — null
   *  until the user explicitly enables sharing (unlike feed_token, which
   *  defaults to always-present since that feed is private-by-obscurity). */
  share_token?: string | null;
  updated_at: string;
};

export type RatingsCacheRow = {
  show_id: string;
  source: string;
  rating: number | null;
  fetched_at: string;
};
