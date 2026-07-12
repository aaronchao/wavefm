"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSaved, unsaveShow } from "@/src/data/repos/savedShowsRepo";
import { useSession } from "@/src/state/useSession";
import { Card, Chip, CoverTile } from "@/src/ui";

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
        <li key={show.id}>
          <Card className="flex items-center gap-4">
            <CoverTile src={show.coverUrl} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{show.title}</p>
              <p className="truncate text-sm text-zinc-500">{show.author}</p>
            </div>
            <Chip onClick={() => onUnsave(show.id)} className="shrink-0">
              Remove
            </Chip>
          </Card>
        </li>
      ))}
    </ul>
  );
}
