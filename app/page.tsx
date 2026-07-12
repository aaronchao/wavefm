"use client";

import Link from "next/link";
import { Feed } from "@/src/features/explore/Feed";
import { InterestPicker } from "@/src/features/explore/InterestPicker";
import { useRecommendations } from "@/src/features/explore/useRecommendations";
import { SavedShows } from "@/src/features/saved/SavedShows";

export default function Home() {
  const { needsOnboarding, isLoading } = useRecommendations();

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">What next?</h1>
      <p className="mb-6 text-zinc-500">
        Shows worth your time, and why —{" "}
        <Link href="/topics" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
          tune your topics
        </Link>
        .
      </p>
      {!isLoading && needsOnboarding ? (
        <InterestPicker onDone={() => {}} />
      ) : (
        <>
          <Feed />
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">Your saved shows</h2>
            <SavedShows />
          </section>
        </>
      )}
    </main>
  );
}
