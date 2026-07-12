"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { migrateLocalSaves } from "@/src/data/repos/savedShowsRepo";
import { getSupabase } from "@/src/data/supabase/client";

/**
 * Current Supabase auth session. `configured` is false when Supabase env
 * vars are missing — the app then runs in local-only (signed-out) mode.
 */
export function useSession() {
  const queryClient = useQueryClient();
  const configured = getSupabase() !== null;
  const [session, setSession] = useState<Session | null>(null);
  // nothing to load when Supabase isn't configured
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN") {
        void migrateLocalSaves().then(() =>
          queryClient.invalidateQueries({ queryKey: ["saved"] }),
        );
      }
      if (event === "SIGNED_OUT") {
        queryClient.invalidateQueries({ queryKey: ["saved"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return { session, loading, configured };
}
