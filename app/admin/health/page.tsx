"use client";

import { useState } from "react";
import type { SourceHealthResult } from "@/src/data/health/sourceHealth";

const TOKEN_KEY = "wavr.adminHealthToken";

/**
 * Source health dashboard (REFINEMENTS.md #14) — an internal ops page, not
 * part of the discovery product. Gated by the same shared-secret token the
 * API route checks; there's no admin role in this app, so this is
 * deliberately not linked from anywhere in the main nav. The token isn't
 * restored on load (avoids a hydration mismatch for a one-input ops page
 * that isn't worth the ceremony) — the browser's own password manager
 * covers repeat visits.
 */
export default function SourceHealthPage() {
  const [token, setToken] = useState("");
  const [results, setResults] = useState<SourceHealthResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function check() {
    setStatus("loading");
    window.localStorage.setItem(TOKEN_KEY, token);
    try {
      const res = await fetch(`/api/admin/source-health?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const json = (await res.json()) as { results: SourceHealthResult[] };
      setResults(json.results);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-2 text-xl font-bold">Source health</h1>
      <p className="mb-4 text-sm text-zinc-500">
        {"Live probe against every rating/buzz scraper with one fixed test title per language. "}
        {'"Not ok" can mean genuinely down, or that title just did not match on that source — '}
        {'treat it as "investigate", not "confirmed broken". Sources with an unset env key show '}
        {'as "not configured" (expected, not a failure).'}
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

      {results && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700">
              <th className="py-2">Source</th>
              <th className="py-2">Lang</th>
              <th className="py-2">Status</th>
              <th className="py-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-zinc-500">{r.lang}</td>
                <td className="py-2">
                  {!r.configured ? (
                    <span className="text-muted-foreground">not configured</span>
                  ) : r.ok ? (
                    <span className="text-green-600">ok</span>
                  ) : (
                    <span className="font-semibold text-red-600">not ok</span>
                  )}
                </td>
                <td className="py-2 text-muted-foreground">{r.configured ? r.durationMs : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
