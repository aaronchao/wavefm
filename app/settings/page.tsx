"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/src/data/supabase/client";
import { useSession } from "@/src/state/useSession";

export default function SettingsPage() {
  const { session, loading, configured } = useSession();

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-semibold">Account &amp; sync</h2>
        {!configured ? (
          <p className="text-zinc-500">
            Sync isn&apos;t configured (missing Supabase env vars). Saves stay
            on this device.
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

function SignedIn({ email }: { email: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p>
        Signed in as <span className="font-medium">{email}</span> — saves sync
        across your devices.
      </p>
      <button
        onClick={() => void getSupabase()?.auth.signOut()}
        className="shrink-0 rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
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
        className="w-full rounded-xl border border-zinc-300 px-4 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
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
