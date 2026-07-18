import type { Metadata } from "next";
import { DiscoverPage } from "@/src/features/discover/DiscoverPage";

export const metadata: Metadata = {
  title: "Discover · Wavr",
  description:
    "Ranked podcast recommendations with the real discussion behind them — one click to hear the middle of the episode people actually talk about.",
};

export default function Discover() {
  return <DiscoverPage />;
}
