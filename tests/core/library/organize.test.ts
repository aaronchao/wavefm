import { describe, expect, it } from "vitest";
import {
  categoryOf,
  groupByCategory,
  groupByVibe,
  vibeOf,
  type LibShow,
} from "@/src/core/library/organize";

const show = (title: string, categories: string[], description = ""): LibShow => ({
  title,
  categories,
  description,
});

describe("categoryOf", () => {
  it("collapses genres into canonical topics", () => {
    expect(categoryOf(show("A", ["TV & Film"]))).toBe("TV & Film");
    expect(categoryOf(show("B", ["Technology"]))).toBe("Technology");
    expect(categoryOf(show("C", ["Investing", "Business"]))).toBe("Business");
    expect(categoryOf(show("D", ["True Crime"]))).toBe("True Crime");
  });

  it("falls back to the first category, else Uncategorized", () => {
    expect(categoryOf(show("E", ["Wizardry"]))).toBe("Wizardry");
    expect(categoryOf(show("F", []))).toBe("Uncategorized");
  });
});

describe("vibeOf", () => {
  it("reads a vibe from category + title + description", () => {
    expect(vibeOf(show("Casefile", ["True Crime"])).id).toBe("edge");
    expect(vibeOf(show("科技早知道", ["科技"])).id).toBe("mind");
    expect(vibeOf(show("段子来了", ["Comedy"], "搞笑脱口秀")).id).toBe("laughs");
    expect(vibeOf(show("读书会", ["Education"], "历史与商业")).id).toBe("brain");
  });

  it("falls back to On rotation when nothing matches", () => {
    expect(vibeOf(show("Untitled", [])).id).toBe("rotation");
  });

  it("is deterministic for the same input", () => {
    const s = show("故事FM", ["Society & Culture"], "真实故事");
    expect(vibeOf(s).id).toBe(vibeOf(s).id);
  });
});

describe("groupByCategory", () => {
  it("groups CJK shows by language and the rest by topic, biggest first", () => {
    const groups = groupByCategory([
      show("故事FM", ["Society & Culture"], "真实故事"),
      show("忽左忽右", ["Society & Culture"], "文化访谈"),
      show("Radiolab", ["Science"]),
    ]);
    expect(groups[0].key).toBe("中文");
    expect(groups[0].items).toHaveLength(2);
    expect(groups.map((g) => g.key)).toContain("Science");
  });
});

describe("groupByVibe", () => {
  it("buckets shows into vibes and drops empty ones", () => {
    const groups = groupByVibe([
      show("Casefile", ["True Crime"]),
      show("Murder Book", ["True Crime"]),
      show("科技早知道", ["科技"]),
    ]);
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("On edge");
    expect(keys).toContain("Mind-benders");
    expect(keys).not.toContain("Cozy corner");
    expect(groups.find((g) => g.key === "On edge")!.items).toHaveLength(2);
  });
});
