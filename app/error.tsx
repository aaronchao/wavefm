"use client";

import Link from "next/link";

/**
 * App-wide error boundary. Any uncaught render/runtime error in a route
 * degrades to this friendly retry instead of Next's bare fallback.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Something hiccuped</h1>
      <p className="text-zinc-500">
        This page ran into a problem. Your saved shows and library are safe.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl bg-surface px-4 py-2 font-medium hover:opacity-80"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
