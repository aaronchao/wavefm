"use client";

import type { SimilarShow } from "@/src/data/catalog/types";
import { RatingBadges } from "@/src/features/show/RatingBadges";

/**
 * Why-this-pick evidence — the reworked "rating badge" concept. A star
 * rating is only there sometimes; the *reason* always is. So we lead with
 * the human reason (discussion / chart / rating phrase the ranker chose)
 * as a first-class badge, and show the star rating beside it when a source
 * actually has one. Every card now carries a plain-language "why".
 */
export function Evidence({
  show,
  className = "",
}: {
  show: SimilarShow;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
        <span aria-hidden className="text-[10px]">
          ◆
        </span>
        {show.why}
      </span>
      <RatingBadges showId={show.id} title={show.title} />
    </div>
  );
}
