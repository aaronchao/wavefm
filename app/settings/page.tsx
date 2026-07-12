"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { SEED_CLUSTERS } from "@/src/core/recommend";
import {
  getPrefs,
  setInterests,
  setRatingSources,
} from "@/src/data/repos/prefsRepo";
import { getSupabase } from "@/src/data/supabase/client";
import { useSession } from "@/src/state/useSession";
import { Chip } from "@/src/ui";

const EXTRA_TOPICS = ["music culture", "commentary", "business & coaching"];
const RATING_SOURCES = [
  { id: "douban" as const, label: "Douban" },
  { id: "xiaoyuzhou" as const, label: "小宇宙 Xiaoyuzhou" },
];

export default function SettingsPage() {
  const { session, loading, configured } = useSession();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <InterestsSection />
      <RatingSourcesSection />

      <section className="rounded-card border border-surface-border p-4">
        <h2 className="mb-3 font-semibold">Account &amp; sync</h2>
        {!configured ? (
          <p className="text-zinc-500">
            Sync isn&apos;t configured (missing Supabase env vars). Everything
            still works — saves and prefs stay on this device.
          </p>
        ) : loading ? null : session ? (
          <SignedIn email={session.user.email ?? ""} />
        ) : (
          <MagicLinkForm />
        )}
      </section>
    </main>
  );
}

function usePrefs() {
  const { session } = useSession();
  const scope = session?.user.id ?? "local";
  const queryClient = useQueryClient();
  const prefsQ = useQuery({ queryKey: ["prefs", scope], queryFn: getPrefs });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["prefs"] });
  return { prefsQ, invalidate };
}

function InterestsSection() {
  const { prefsQ, invalidate } = usePrefs();
  const [edited, setEdited] = useState<string[] | null>(null);
  const picked = edited ?? prefsQ.data?.interests ?? [];

  const known = new Set([...SEED_CLUSTERS.map((s) => s.label), ...EXTRA_TOPICS]);
  const topics = [
    ...SEED_CLUSTERS.map((s) => s.label),
    ...EXTRA_TOPICS,
    ...picked.filter((t) => !known.has(t)),
  ];

  async function toggle(topic: string) {
    const next = picked.includes(topic)
      ? picked.filter((t) => t !== topic)
      : [...picked, topic];
    setEdited(next);
    await setInterests(next);
    await invalidate();
  }

  return (
    <section className="rounded-card border border-surface-border p-4">
      <h2 className="mb-1 font-semibold">Interests</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Feeds the recommendation engine — same toggles as Topics.
      </p>
      <div className="flex flex-wrap gap-2">
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
    </section>
  );
}

function RatingSourcesSection() {
  const { prefsQ, invalidate } = usePrefs();
  const [edited, setEdited] = useState<Record<string, boolean> | null>(null);
  const sources = edited ?? prefsQ.data?.rating_sources ?? {};

  async function toggle(id: "douban" | "xiaoyuzhou") {
    const next = { ...sources, [id]: !(sources[id] ?? true) };
    setEdited(next);
    await setRatingSources(next);
    await invalidate();
  }

  return (
    <section className="rounded-card border border-surface-border p-4">
      <h2 className="mb-1 font-semibold">Rating badges</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Best-effort external ratings — badges disappear silently when a
        source is off (or unreachable).
      </p>
      <div className="flex flex-wrap gap-2">
        {RATING_SOURCES.map((s) => (
          <Chip
            key={s.id}
            active={sources[s.id] ?? true}
            onClick={() => void toggle(s.id)}
          >
            {s.label} {(sources[s.id] ?? true) ? "on" : "off"}
          </Chip>
        ))}
      </div>
    </section>
  );
}

function SignedIn({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Signed in as <span className="font-medium">{email}</span> — saves and
        prefs sync across your devices.
      </p>
      <button
        onClick={() => void getSupabase()?.auth.signOut()}
        className="shrink-0 self-start rounded-pill bg-surface px-3 py-1.5 text-sm font-medium hover:opacity-80"
      >
        Sign out
      </button>
    </div>
  );
}

function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setStatus("sending");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/settings" },
    });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <p>
        Magic link sent to <span className="font-medium">{email}</span> — open
        it on this device to finish signing in.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-pill border border-surface-border bg-background px-4 py-2 outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="shrink-0 rounded-pill bg-accent px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">
          Couldn&apos;t send the link — try again.
        </p>
      )}
    </form>
  );
}
