"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { PRESS_SCALE, springs } from "./tokens";

/** A div that springs in and settles with a slight overshoot. */
export function SettleIn(props: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.settle}
      {...props}
    />
  );
}

/** A button with tactile press feedback (scale + spring). */
export function Pressable(props: HTMLMotionProps<"button">) {
  return (
    <motion.button
      whileTap={{ scale: PRESS_SCALE }}
      whileHover={{ scale: 1.02 }}
      transition={springs.press}
      {...props}
    />
  );
}

/** Small element that pops in — for chips and badges appearing lazily. */
export function PopIn(props: HTMLMotionProps<"span">) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.pop}
      {...props}
    />
  );
}
