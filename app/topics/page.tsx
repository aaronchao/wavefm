"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SEED_CLUSTERS } from "@/src/core/recommend";
import { getPrefs, setInterests } from "@/src/data/repos/prefsRepo";
import { useSession } from "@/src/state/useSession";
import { Card, Chip, CoverTile } from "@/src/ui";
import { useRecommendations } from "@/src/features/explore/useRecommendations";

const EXTRA_TOPICS = ["music culture", "commentary", "business & coaching"];

export default function TopicsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const scope = session?.user.id ?? "local";
  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });
  const { clusters, showsById } = useRecommendations();

  // local edits win until saved prefs round-trip; null = untouched
  const [edited, setEdited] = useState<string[] | null>(null);
  const picked = edited ?? prefsQ.data?.interests ?? [];

  async function toggle(topic: string) {
    const next = picked.includes(topic)
      ? picked.filter((t) => t !== topic)
      : [...picked, topic];
    setEdited(next); // optimistic — one click, no confirm
    await setInterests(next);
    await queryClient.invalidateQueries({ queryKey: ["prefs"] });
  }

  const known = new Set([...SEED_CLUSTERS.map((s) => s.label), ...EXTRA_TOPICS]);
  const topics = [
    ...SEED_CLUSTERS.map((s) => s.label),
    ...EXTRA_TOPICS,
    ...picked.filter((t) => !known.has(t)),
  ];

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">Topics</h1>
      <p className="mb-4 text-zinc-500">
        Toggle what you care about — the feed retunes instantly.
      </p>
      <div className="mb-8 flex flex-wrap gap-2">
        {topics.map((topic) => (
          <Chip
            key={topic}
            active={picked.includes(topic)}
            onClick={() => void toggle(topic)}
          >
            {topic}
          </Chip>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Your clusters</h2>
      <div className="flex flex-col gap-6">
        {clusters.length === 0 && (
          <p className="text-zinc-500">
            No clusters yet — pick topics above or save shows in Search.
          </p>
        )}
        {clusters.map((c) => (
          <section key={c.id}>
            <p className="mb-2 text-sm font-medium text-accent">{c.why}</p>
            <div className="flex flex-wrap gap-3">
              {c.items.map((item) => {
                const show = showsById.get(item.show.id);
                return (
                  <Card key={item.show.id} className="flex w-40 flex-col gap-2">
                    <CoverTile src={show?.coverUrl} size={144} className="w-full" />
                    <p className="line-clamp-2 text-sm font-medium">
                      {item.show.title}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
