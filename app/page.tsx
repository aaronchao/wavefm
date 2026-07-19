"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Landing } from "@/src/features/landing/Landing";
import { useSession } from "@/src/state/useSession";

/**
 * Front door. Signed-out visitors get the landing page; signed-in users go
 * straight to their discovery feed. While the session is resolving we render
 * the landing (it's the safe, no-flash default for the common case).
 */
export default function Root() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/discover");
  }, [loading, session, router]);

  if (!loading && session) return null; // redirecting
  return <Landing />;
}
