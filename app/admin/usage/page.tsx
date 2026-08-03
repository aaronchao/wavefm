"use client";

import { useState } from "react";
import type { UsageSnapshot } from "@/src/data/health/usageSnapshot";

/**
 * Cost/quotas dashboard (REFINEMENTS.md #30) — an internal ops page, not
 * part of the discovery product. Gated by the same ADMIN_HEALTH_TOKEN as
 * /admin/health; deliberately not linked from anywhere in the main nav.
 */
export default function UsagePage() {
  const [token, setToken] = useState("");
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function check() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/usage?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setSnapshot((await res.json()) as UsageSnapshot);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-2 text-xl font-bold">Cost / quotas</h1>
      <p className="mb-4 text-sm text-zinc-500">
        {"Supabase row counts per table, and this month's Listen Notes call count. "}
        {"Vercel bandwidth/function usage is not included here — check the Vercel "}
        {"dashboard directly for that number."}
      </p>

      <div className="mb-6 flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_HEALTH_TOKEN"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={() => void check()}
          disabled={!token || status === "loading"}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {status === "loading" ? "Checking…" : "Check now"}
        </button>
      </div>

      {status === "error" && (
        <p className="mb-4 text-sm text-red-600">
          {"Request failed — wrong token, or ADMIN_HEALTH_TOKEN is not set on the server."}
        </p>
      )}

      {snapshot && (
        <>
          <p className="mb-4 text-sm">
            Listen Notes calls this month:{" "}
            <span className="font-semibold">{snapshot.listenNotesThisMonth}</span>
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2">Table</th>
                <th className="py-2">Rows</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.tables.map((t) => (
                <tr key={t.table} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2">{t.table}</td>
                  <td className="py-2">{t.rows ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
