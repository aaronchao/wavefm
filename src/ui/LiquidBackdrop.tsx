/**
 * The vibrant, multi-color blurred wash behind every "Liquid Glass" page
 * (Discover, Library) — a `.glass-panel` card is just a blur, and a blur
 * over a flat single-color page background barely tints at all. Fixed
 * (not absolute) so it stays put while the page scrolls past it, `-z-10`
 * so it always sits behind real content, and `aria-hidden` since it's
 * pure decoration. Dark-mode opacities run much higher than light-mode's
 * — the same light color alpha-blended over near-black reads as barely-
 * there gray, where over white it's already vivid at a fraction of the
 * opacity.
 */
export function LiquidBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="liquid-blob absolute -left-32 -top-32 h-[38rem] w-[38rem] rounded-full bg-[#ff3b30]/40 blur-[110px] dark:bg-[#ff453a]/70"
        style={{ animationDelay: "-2s" }}
      />
      <div
        className="liquid-blob absolute -right-24 top-1/4 h-[34rem] w-[34rem] rounded-full bg-sky-400/35 blur-[110px] dark:bg-sky-400/65"
        style={{ animationDelay: "-9s" }}
      />
      <div
        className="liquid-blob absolute bottom-[-10rem] left-1/4 h-[32rem] w-[32rem] rounded-full bg-fuchsia-400/30 blur-[110px] dark:bg-fuchsia-500/60"
        style={{ animationDelay: "-15s" }}
      />
      <div
        className="liquid-blob absolute bottom-10 right-10 h-80 w-80 rounded-full bg-amber-300/35 blur-[100px] dark:bg-amber-400/60"
        style={{ animationDelay: "-5s" }}
      />
    </div>
  );
}
