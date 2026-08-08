"use client";

/**
 * The SVG displacement filter behind `.glass-clear` — Liquid Glass with NO
 * blur, where the refraction alone does the work.
 *
 * `.glass-card` frosts: it blurs the backdrop, which reads as glass but
 * hides whatever is behind it. Real glass mostly *bends* light rather than
 * scattering it, so a clear pane stays see-through and only distorts. That's
 * the effect this reproduces, per master.dev's write-up: displacement fully
 * on, frosting reduced to a very light translucent white.
 *
 * How it works: `feImage` loads a displacement map whose red channel encodes
 * horizontal offset and green channel vertical. 128 is neutral, so a map
 * that stays mid-grey in the middle and ramps at the edges leaves the centre
 * untouched and pushes the backdrop outward around the rim — exactly where a
 * real lens bends light hardest. `feDisplacementMap` then samples the
 * backdrop through it.
 *
 * The map is a data-URI SVG rather than a PNG so it stays resolution-free
 * and needs no asset pipeline. `objectBoundingBox` units make one filter
 * serve every card size.
 *
 * Rendered once at the app root; `.glass-clear` references it by id. Chrome
 * supports SVG filters in backdrop-filter, Safari does not — hence the
 * @supports gate in globals.css, which falls back to the frosted card.
 */

// Two crossed linear gradients, masked to a rounded-rect rim. Mid-grey
// (#808080 => 128,128) is "no displacement"; the ramps at each edge push
// the sampled backdrop outward.
const MAP = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="x" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000"/><stop offset="0.5" stop-color="#808080"/><stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <linearGradient id="y" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000"/><stop offset="0.5" stop-color="#808080"/><stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <radialGradient id="rim" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.45" stop-color="#000"/><stop offset="1" stop-color="#fff"/>
    </radialGradient>
    <mask id="edge"><rect width="200" height="200" fill="url(#rim)"/></mask>
  </defs>
  <rect width="200" height="200" fill="#808080"/>
  <g mask="url(#edge)">
    <rect width="200" height="200" fill="url(#x)" style="mix-blend-mode:normal" opacity="0.65"/>
    <rect width="200" height="200" fill="url(#y)" style="mix-blend-mode:green" opacity="0.65"/>
  </g>
</svg>`;

const MAP_URI = `data:image/svg+xml;utf8,${encodeURIComponent(MAP)}`;

export function GlassFilter() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="wavr-glass" x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox">
          <feImage href={MAP_URI} x="0" y="0" width="1" height="1" result="map" preserveAspectRatio="none" />
          {/* scale is in backdrop pixels — gentle: at objectBoundingBox units this is a fraction of the card, and
              card's rim without smearing the content behind into mush. */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="0.022"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
