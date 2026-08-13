"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import type { WavrCard } from "@/src/core/wavr";
import { CardFace } from "./CardFace";

/**
 * A behind-card, fanned out at an angle rather than stacked straight
 * behind — cards cascade down-and-right, each one progressively smaller,
 * more offset, and more rotated by depth, so the next couple of episodes
 * visibly peek out from behind the current one (the Dribbble reference
 * this was rebuilt from: a hand of cards, not a flat pile).
 *
 * Driven entirely by the TOP card's drag position (§6.3) — the whole fan
 * un-furls toward centred/upright as you drag the front card away, so the
 * card underneath visibly straightens up to take over, then settles back
 * into its fanned resting position if the drag is released uncommitted.
 * Zero extra re-renders; it's all motion-value transforms.
 */
export function PeekCard({
  card,
  depth,
  topX,
}: {
  card: WavrCard;
  depth: 1 | 2;
  topX: MotionValue<number>;
}) {
  const away = useTransform(topX, (v) => Math.min(Math.abs(v) / 160, 1));
  const scale = useTransform(away, [0, 1], depth === 1 ? [0.94, 1] : [0.88, 0.94]);
  const x = useTransform(away, [0, 1], depth === 1 ? [20, 0] : [36, 20]);
  const y = useTransform(away, [0, 1], depth === 1 ? [16, 0] : [30, 16]);
  const rotate = useTransform(away, [0, 1], depth === 1 ? [5, 0] : [9, 5]);
  const opacity = useTransform(away, [0, 1], depth === 1 ? [0.85, 1] : [0.55, 0.85]);

  return (
    <motion.div
      className="absolute inset-0"
      style={{ scale, x, y, rotate, opacity, transformOrigin: "50% 100%" }}
      aria-hidden="true"
    >
      <CardFace card={card} progress={0} playState="paused" variant="compact" />
    </motion.div>
  );
}
