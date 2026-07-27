"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import type { WavrCard } from "@/src/core/wavr";
import { CardFace } from "./CardFace";

/**
 * A static behind-card, driven entirely by the TOP card's drag position
 * (§6.3) — the stack breathes as you drag, with zero extra re-renders.
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
  const y = useTransform(away, [0, 1], depth === 1 ? [14, 0] : [28, 14]);
  const opacity = useTransform(away, [0, 1], depth === 1 ? [0.75, 1] : [0.45, 0.75]);

  return (
    <motion.div className="absolute inset-0" style={{ scale, y, opacity }} aria-hidden="true">
      <CardFace card={card} progress={0} playState="paused" variant="compact" />
    </motion.div>
  );
}
