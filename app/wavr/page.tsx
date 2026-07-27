import type { Metadata } from "next";
import { WavrPage } from "@/src/features/wavr/WavrPage";

export const metadata: Metadata = {
  title: "Wavr — one swipe at a time",
  description:
    "Episodes worth your next 30 seconds, picked from what listeners actually say about them.",
};

export default function Page() {
  return <WavrPage />;
}
