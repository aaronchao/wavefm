import type { EngagementInput, ShowInput } from "@/src/core/recommend";

/** Deterministic fixture catalog loosely modeled on the PRD examples. */

export const savedShows: ShowInput[] = [
  {
    id: "s-therapist",
    title: "Dear Therapist",
    description: "A therapist works through real psychological case studies.",
    categories: ["Mental Health", "Society & Culture"],
  },
  {
    id: "s-zhouxiaola",
    title: "周小辣",
    description: "Candid personal storytelling and life talk.",
    categories: ["Personal Journals"],
  },
];

export const candidates: ShowInput[] = [
  {
    id: "c-psychseattle",
    title: "Psychology In Seattle",
    description:
      "Deep dives into psychology, therapy and psychological case studies.",
    categories: ["Mental Health"],
    lastEpisodeAt: "2026-07-05T00:00:00Z",
  },
  {
    id: "c-coaching",
    title: "Coaching Real Leaders",
    description: "Case studies in coaching, psychology and leadership.",
    categories: ["Business", "Mental Health"],
  },
  {
    id: "c-sono",
    title: "Sono",
    description: "Candid storytelling, personal life talk, 真实故事.",
    categories: ["Personal Journals"],
  },
  {
    id: "c-gaytravel",
    title: "Out Abroad",
    description: "Gay travel stories from queer travelers around the world.",
    categories: ["Places & Travel"],
  },
  {
    id: "c-books",
    title: "Between Covers",
    description: "Book discussions with authors about novels and literature.",
    categories: ["Books"],
  },
  {
    id: "c-zane",
    title: "The Zane Lowe Show",
    description: "Music culture interviews with artists.",
    categories: ["Music"],
    lastEpisodeAt: "2026-07-10T00:00:00Z",
  },
  {
    id: "c-highlyrated",
    title: "声东击西",
    description: "Reporting and conversations from a global perspective.",
    categories: ["News"],
  },
  {
    id: "c-blocked",
    title: "Blocked Politics Daily",
    description: "Political commentary.",
    categories: ["News"],
  },
];

export const engagements: EngagementInput[] = [
  { showId: "s-therapist", type: "save" },
  { showId: "s-zhouxiaola", type: "save" },
  { showId: "c-blocked", type: "block" },
];

export const NOW = new Date("2026-07-12T00:00:00Z");
