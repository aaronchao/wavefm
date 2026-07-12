import { SavedShows } from "@/src/features/saved/SavedShows";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">What next?</h1>
      <p className="mb-6 text-zinc-500">
        Recommendations land in M5 — for now, here&apos;s what you&apos;ve
        saved.
      </p>
      <SavedShows />
    </main>
  );
}
