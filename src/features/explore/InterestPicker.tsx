"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { defaultTopics } from "@/src/core/recommend";
import { setInterests } from "@/src/data/repos/prefsRepo";
import { Chip, SettleIn } from "@/src/ui";

/** First-run onboarding: pick interests so day one already recommends well. */
export function InterestPicker({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const topics = defaultTopics();

  function toggle(topic: string) {
    setPicked((p) =>
      p.includes(topic) ? p.filter((t) => t !== topic) : [...p, topic],
    );
  }

  async function done() {
    setSaving(true);
    await setInterests(picked);
    await queryClient.invalidateQueries({ queryKey: ["prefs"] });
    onDone();
  }

  return (
    <SettleIn>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold">What are you into?</h2>
          <p className="text-zinc-500">
            Pick a few topics — your feed starts here and learns as you go.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <Chip
              key={topic}
              active={picked.includes(topic)}
              onClick={() => toggle(topic)}
            >
              {topic}
            </Chip>
          ))}
        </div>
        <div>
          <Chip
            onClick={() => void done()}
            active={picked.length > 0}
            className={saving ? "opacity-50" : ""}
          >
            {picked.length > 0
              ? `Start exploring (${picked.length})`
              : "Skip for now"}
          </Chip>
        </div>
      </div>
    </SettleIn>
  );
}
