"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { useSession } from "@/src/state/useSession";

/** Saved-shows list (Home placeholder until the M5 recommendation feed). */
export function SavedShows() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["saved", session?.user.id ?? "local"],
    queryFn: listSaved,
  });

  async function onUnsave(showId: string) {
    await unsaveShow(showId);
    queryClient.invalidateQueries({ queryKey: ["saved"] });
  }

  if (isLoading) return null;
  if (!data || data.length === 0) {
    return (
      <p className="text-zinc-500">
        Nothing saved yet — find your first show in Search.
      </p>
    );
  }

  return (
    <ul className="flex w-full flex-col gap-3">
      {data.map(({ show }) => (
        <li
          key={show.id}
          className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800"
        >
          {show.coverUrl ? (
            // arbitrary external art hosts; skip Vercel image optimization
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={show.coverUrl}
              alt=""
              width={56}
              height={56}
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{show.title}</p>
            <p className="truncate text-sm text-zinc-500">{show.author}</p>
          </div>
          <button
            onClick={() => onUnsave(show.id)}
            className="shrink-0 rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
