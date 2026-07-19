import type { Metadata } from "next";
import { Landing } from "@/src/features/landing/Landing";

export const metadata: Metadata = {
  title: "Wavr — stop researching, just press play",
  description:
    "Wavr ranks podcasts by the real human discussion behind them — Reddit, 豆瓣, 小宇宙, the charts — so you get what to listen to next, and why.",
};

export default function Welcome() {
  return <Landing />;
}
