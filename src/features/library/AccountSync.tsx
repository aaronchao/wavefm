"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/src/data/supabase/client";
import { useSession } from "@/src/state/useSession";

/**
 * Magic-link account sign-in / "Synced as <you>".
 *
 * Lived on Discover, which is the browsing surface — but signing in is about
 * your own library syncing across devices, so it belongs next to the other
 * sync controls rather than above a feed of recommendations. Moved to the
 * Library's Sync panel; behaviour is unchanged.
 */
export function AccountSync() {
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (session) {
    return (
      <button
        type="button"
        onClick={() => void getSupabase()?.auth.signOut()}
        className="font-brand rounded-pill border border-surface-border px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-500 hover:text-foreground"
      >
        Synced as {session.user.email} · Sign out
      </button>
    );
  }
  if (status === "sent") {
    return (
      <span className="text-xs text-zinc-500">Check {email} for your link ✓</span>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setStatus("sending");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1.5">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com — sync your picks"
        className="font-brand w-48 rounded-pill border border-surface-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="nothing-toggle px-3 py-1.5 text-[11px]"
      >
        {status === "sending" ? "…" : "Sync"}
      </button>
      {status === "error" && <span className="text-xs text-red-500">Failed</span>}
    </form>
  );
}
