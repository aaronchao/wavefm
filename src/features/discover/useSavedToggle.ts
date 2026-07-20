"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { SimilarShow } from "@/src/data/catalog/types";
import { isSaved, saveShow, unsaveShow } from "@/src/data/repos/savedShowsRepo";

/** Shared one-click optimistic save toggle for discovery cards. */
export function useSavedToggle(pick: SimilarShow) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void isSaved(pick.id).then((v) => !cancelled && setSaved(v));
    return () => {
      cancelled = true;
    };
  }, [pick.id]);
  function toggle() {
    const next = !saved;
    setSaved(next);
    void (next ? saveShow(pick) : unsaveShow(pick.id)).then(() =>
      queryClient.invalidateQueries({ queryKey: ["saved"] }),
    );
  }
  return { saved, toggle };
}
