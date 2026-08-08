import { test, expect, type Page } from "@playwright/test";

/** Shared catalog stubs — the catch-all is registered first so the
 *  specific routes below take precedence (Playwright matches newest-first). */
const show = (id: string, title: string, author: string, cats: string[], extra = {}) => ({
  id,
  source: "itunes",
  title,
  author,
  appleUrl: `https://podcasts.apple.com/us/podcast/id${id}`,
  categories: cats,
  ...extra,
});

const SEARCH = {
  shows: [show("222", "Psychology In Seattle", "Kirk Honda", ["Mental Health"])],
  degraded: false,
};
const SIMILAR = {
  shows: [],
  episodes: [
    {
      id: "e1",
      title: "Ep 12: Attachment styles",
      showId: "222",
      showTitle: "Psychology In Seattle",
      categories: [],
      appleUrl: "https://podcasts.apple.com/ep12",
      why: "Similar topics · New this week",
    },
  ],
  degraded: false,
};

async function stub(
  page: Page,
  over: { topPicks?: { picks?: unknown[]; degraded?: boolean } } = {},
) {
  await page.route("**/api/**", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/catalog/search**", (r) => r.fulfill({ json: SEARCH }));
  await page.route("**/api/catalog/similar**", (r) => r.fulfill({ json: SIMILAR }));
  await page.route("**/api/catalog/preview**", (r) => r.fulfill({ json: { episodes: [] } }));
  await page.route("**/api/catalog/top-picks**", (r) =>
    r.fulfill({ json: over.topPicks ?? { picks: [], degraded: true } }),
  );
  // cold-start discovery (no saved shows) sources the hero from the
  // community "discussed" chart, so mirror topPicks into it
  await page.route("**/api/catalog/charts/discussed**", (r) =>
    r.fulfill({
      json: over.topPicks
        ? { shows: over.topPicks.picks ?? [], degraded: false }
        : { shows: [], degraded: true },
    }),
  );
}

test("live search shows results without a click", async ({ page }) => {
  await stub(page);
  await page.goto("/search");
  await page.fill("input", "Psychology");
  await expect(page.getByText("Psychology In Seattle").first()).toBeVisible();
});

test("search returns episodes with one-click Later", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/search**", (r) =>
    r.fulfill({
      json: {
        shows: SEARCH.shows,
        episodes: [
          {
            id: "ep99",
            title: "A famous episode",
            showId: "222",
            showTitle: "Psychology In Seattle",
            categories: [],
            appleUrl: "https://podcasts.apple.com/ep99",
          },
        ],
        degraded: false,
      },
    }),
  );
  await page.goto("/search");
  await page.fill("input", "Psychology");
  await expect(page.getByText("A famous episode")).toBeVisible();
  await page.getByRole("button", { name: "+ Later", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Queued ✓", exact: true }).first(),
  ).toBeVisible();
});

test("topics lead with trending; personal niche seeds are absent", async ({ page }) => {
  await stub(page);
  await page.goto("/topics");
  await expect(page.getByText("true crime", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Asian gay podcasts")).toHaveCount(0);
});

test("Discover offers custom interests inline, no personal seeds", async ({ page }) => {
  await stub(page);
  await page.goto("/");
  await expect(page.getByPlaceholder(/Add an interest/)).toBeVisible();
  await expect(page.getByText("Asian gay podcasts")).toHaveCount(0);
});

test("queue an episode for later, then it appears in the Library", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/search**", (r) =>
    r.fulfill({
      json: {
        shows: SEARCH.shows,
        episodes: [
          {
            id: "ep12",
            title: "Ep 12: Attachment styles",
            showId: "222",
            showTitle: "Psychology In Seattle",
            categories: [],
            appleUrl: "https://podcasts.apple.com/ep12",
          },
        ],
        degraded: false,
      },
    }),
  );
  await page.goto("/search");
  await page.fill("input", "Psychology");
  await expect(page.getByText("Ep 12: Attachment styles")).toBeVisible();
  await page.getByRole("button", { name: "+ Later", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Queued ✓", exact: true }).first(),
  ).toBeVisible();

  await page.goto("/library");
  // Right Now stays open — it answers "what do I play?", which is why the
  // Library gets opened — so the saved episode surfaces there immediately.
  const rightNow = page.getByRole("region").filter({ hasText: "Right now" });
  await expect(rightNow.getByText("Ep 12: Attachment styles")).toBeVisible();

  // Saved episodes is open, not collapsed — it's the content, not a tool,
  // so it must be reachable without a tap. The same episode appears there
  // too, this time as a link into its show.
  await expect(
    page.getByRole("link", { name: "Ep 12: Attachment styles" }),
  ).toBeVisible();
});

test("degraded Top Picks hides the section but the home page still renders", async ({ page }) => {
  await stub(page, { topPicks: { picks: [], degraded: true } });
  await page.goto("/home");
  await expect(page.getByText("What next?")).toBeVisible();
  await expect(page.getByText("Top picks for you")).toHaveCount(0);
});

test("the marketing landing (/welcome) greets visitors with a discovery CTA", async ({ page }) => {
  await stub(page);
  await page.goto("/welcome");
  await expect(page.getByText("Just press")).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore discovery →" })).toBeVisible();
  // the interactive metaphor pours out a feed once five shows are "saved"
  await page.getByRole("button", { name: /Radiolab/ }).click();
  await page.getByRole("button", { name: /故事FM/ }).click();
  await page.getByRole("button", { name: /Reply All/ }).click();
  await page.getByRole("button", { name: /忽左忽右/ }).click();
  await page.getByRole("button", { name: /99% Invisible/ }).click();
  await expect(page.getByText("Your feed, poured out")).toBeVisible();
});

test("discover ranks recommendations and surfaces evidence for its picks", async ({ page }) => {
  const RANKED_PICKS = {
    picks: [
      show("222", "Psychology In Seattle", "Kirk Honda", ["Mental Health"], {
        why: "Talked about on Reddit (12 threads)",
        evidence: [
          {
            source: "r/podcasts",
            text: "Psychology In Seattle changed how I think about relationships",
            url: "https://www.reddit.com/r/podcasts/x",
          },
        ],
      }),
      show("333", "Where Should We Begin", "Esther Perel", ["Society & Culture"], {
        why: "Because you saved similar shows",
      }),
    ],
    degraded: false,
  };
  const RANKED_EPS = {
    episodes: [
      {
        id: "https://cdn/ep1.mp3",
        title: "The one everyone argues about",
        audioUrl: "https://cdn/ep1.mp3",
        durationSec: 2400,
        basis: "discussion",
        why: "Most discussed · 40 Reddit threads",
      },
    ],
    degraded: false,
  };
  await stub(page, { topPicks: RANKED_PICKS });
  await page.route("**/api/catalog/episodes-ranked**", (r) => r.fulfill({ json: RANKED_EPS }));

  await page.goto("/");
  // #1 and #2 both land in the ranked list, in order (Today's Pick no
  // longer spotlights #1 separately — this is the only place it appears)
  await expect(page.getByText("Psychology In Seattle").first()).toBeVisible();
  await expect(page.getByText("Where Should We Begin").first()).toBeVisible();
  // its ranked episode surfaces in the "Episodes to try" column
  await expect(page.getByText("The one everyone argues about").first()).toBeVisible();

  // tapping the reason badge expands the real community thread behind it
  await page.getByRole("button", { name: /Talked about on Reddit/ }).first().click();
  await expect(
    page.getByText("Psychology In Seattle changed how I think about relationships"),
  ).toBeVisible();
});

test("Wavr Mini plays a For-You episode and lets you keep it", async ({ page }) => {
  await stub(page);
  // Wavr Mini sources cards from the "For You" interest tags via episode
  // search — one playable episode per swipe, not the ranked-shows list.
  // (Not "Wavr" — that name is reserved for the dedicated /wavr tab.)
  await page.route("**/api/catalog/search**", (r) =>
    r.fulfill({
      json: {
        shows: [],
        episodes: [
          {
            id: "ep-x",
            title: "The one everyone argues about",
            showId: "222",
            showTitle: "Psychology In Seattle",
            coverUrl: "https://cdn/cover.jpg",
            appleUrl: "https://podcasts.apple.com/ep-x",
            audioUrl: "https://cdn/ep1.mp3",
            durationSec: 2400,
            publishedAt: "2026-07-20T00:00:00Z",
            categories: [],
            description: "A deep dive into the argument everyone has.",
          },
        ],
        degraded: false,
      },
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Wavr Mini" }).first().click();
  // the card is a real For-You episode — and it's auto-playing, so its title
  // also shows in the Play bar (two matches confirms the Play-Bar routing)
  const heading = page.getByRole("heading", { name: "The one everyone argues about" });
  await expect(heading).toBeVisible();

  // the bottom row is a minimal X (skip) / + (save) pair, not gesture-only
  await page.getByRole("button", { name: "Save to Library" }).click();
  // keep it -> the header's "♥ 1" badge reflects the save
  await expect(page.getByText("♥ 1")).toBeVisible();
});

test("selecting a For-You tag surfaces episodes for it, not shows", async ({ page }) => {
  await stub(page);
  // the tapped tag drives an episode search; those episodes fill the feed
  await page.route("**/api/catalog/search**", (r) =>
    r.fulfill({
      json: {
        shows: [show("222", "Psychology In Seattle", "Kirk Honda", ["Mental Health"])],
        episodes: [
          {
            id: "ep-topic",
            title: "Latest on this very topic",
            showId: "222",
            showTitle: "Psychology In Seattle",
            audioUrl: "https://cdn/topic.mp3",
            durationSec: 1800,
            publishedAt: "2026-07-21T00:00:00Z",
            categories: [],
          },
        ],
        degraded: false,
      },
    }),
  );

  await page.goto("/");
  // tap the first "For You" interest tag (a fallback lens on a fresh browser)
  await page.getByRole("button", { name: "墨尔本" }).click();
  await expect(page.getByText(/Latest in/)).toBeVisible();
  await expect(page.getByText("Latest on this very topic")).toBeVisible();
});

test("show detail lists the show's own top episodes", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/show**", (r) =>
    r.fulfill({
      json: {
        show: show("222", "Psychology In Seattle", "Kirk Honda", ["Mental Health"], {
          feedUrl: "https://feeds/x",
        }),
      },
    }),
  );
  await page.route("**/api/catalog/episodes-ranked**", (r) =>
    r.fulfill({
      json: {
        episodes: [
          {
            id: "e1",
            title: "Attachment styles deep-dive",
            audioUrl: "https://cdn/e1.mp3",
            durationSec: 2400,
            basis: "discussion",
            why: "Most discussed · 40 Reddit threads",
          },
        ],
        degraded: false,
      },
    }),
  );

  await page.goto("/show/222");
  await expect(page.getByRole("heading", { name: "Psychology In Seattle" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top episodes" })).toBeVisible();
  await expect(page.getByText("Attachment styles deep-dive")).toBeVisible();
});

test("discover surfaces the 中文播客榜 board (xyzrank) with its own tabs", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/charts/xyzrank**", (r) =>
    r.fulfill({
      json: {
        shows: [
          {
            id: "900",
            rank: 1,
            title: "故事FM",
            author: "寇爱哲",
            category: "Society & Culture",
            avgPlays: 12000,
          },
        ],
        episodes: [],
        degraded: false,
      },
    }),
  );

  await page.goto("/");
  // 热门播客 (Popular podcasts) is the default-active tab of the four.
  await expect(page.getByRole("heading", { name: "中文播客榜" })).toBeVisible();
  await expect(page.getByRole("button", { name: "热门播客" })).toBeVisible();
  await expect(page.getByText("故事FM")).toBeVisible();
});

test("discover Global chart tab ranks by community + metrics", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/charts/global**", (r) =>
    r.fulfill({
      json: {
        shows: [
          show("910", "Radiolab", "WNYC", ["Science"], {
            why: "Buzzing on Reddit · 3.4k threads",
          }),
        ],
        degraded: false,
      },
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Hot Buzz" }).click();
  await expect(page.getByText("Radiolab")).toBeVisible();
  await expect(page.getByText("Buzzing on Reddit · 3.4k threads")).toBeVisible();
});

test("show page surfaces community-mined recommendations above Similar", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/show**", (r) =>
    r.fulfill({
      json: {
        show: show("222", "Psychology In Seattle", "Kirk Honda", ["Mental Health"], {
          feedUrl: "https://feeds/x",
        }),
      },
    }),
  );
  await page.route("**/api/recs/community**", (r) =>
    r.fulfill({
      json: {
        shows: [
          show("777", "Where Should We Begin", "Esther Perel", ["Society & Culture"], {
            why: "12 listeners on r/podcasts recommend this",
            evidence: [
              {
                source: "r/podcasts",
                text: "If you like Psychology In Seattle, try Where Should We Begin",
                url: "https://www.reddit.com/r/podcasts/x",
              },
            ],
          }),
        ],
        degraded: false,
      },
    }),
  );

  await page.goto("/show/222");
  await expect(page.getByRole("heading", { name: "Listeners also recommend" })).toBeVisible();
  await expect(page.getByText("Where Should We Begin").first()).toBeVisible();
  // the reason is tappable and opens the real thread quote
  await page.getByRole("button", { name: /12 listeners on r\/podcasts/ }).first().click();
  await expect(
    page.getByText("If you like Psychology In Seattle, try Where Should We Begin"),
  ).toBeVisible();
});

test("the tab bar is Discovery / Wavr / Library, with Search in the header", async ({
  page,
}) => {
  await stub(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveText([/Discovery/, /Wavr/, /Library/]);
  // Search moved out of the bar but must stay reachable from every screen.
  // It opens an overlay in place rather than navigating, so the page you
  // were on survives the search.
  await expect(nav.getByRole("link", { name: /Search/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("textbox", { name: "Search podcasts" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("the Wavr tab opens the route and marks itself current", async ({ page }) => {
  await stub(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Wavr/ }).click();
  await expect(page).toHaveURL(/\/wavr$/);
  // No interests saved yet -> the cold-start state, with the inline picker
  await expect(page.getByText("Wavr needs three things you’re into.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What are you into?" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Wavr/ }),
  ).toHaveAttribute("aria-current", "page");
});

const WAVR_CARDS = [
  {
    id: "s1:e1",
    episodeId: "e1",
    showId: "s1",
    title: "The one about attachment styles",
    showTitle: "Psychology In Seattle",
    quote: { source: "r/podcasts", text: "made me pull over and cry" },
    matchedTags: ["psychology"],
    why: "Matches your interest in psychology — r/podcasts listeners keep bringing it up",
    score: 0.9,
  },
  {
    id: "s2:e1",
    episodeId: "e1",
    showId: "s2",
    title: "Grief, explained",
    showTitle: "Where Should We Begin",
    quote: { source: "V2EX", text: "worth every minute" },
    matchedTags: ["grief"],
    why: "Because you follow grief",
    score: 0.8,
  },
];

test("/wavr renders a real deck: save shows Undo, skip advances, deck exhausts honestly", async ({
  page,
}) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({ json: { cards: WAVR_CARDS, cursor: null, degraded: false } }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");

  await expect(page.getByRole("heading", { name: "The one about attachment styles" })).toBeVisible();
  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page.getByText("Saved · Undo")).toBeVisible();
  // The live region is the unambiguous proof of advancement (peek cards
  // render the next title too, just not as the current, controllable card).
  await expect(page.locator('[aria-live="polite"]')).toHaveText(/Card 2 of 2\. Grief, explained/);

  await page.getByRole("button", { name: "Skip this episode" }).click();
  await expect(page.getByText(/That.s the deck\. 1 saved\./)).toBeVisible();
});

test("/wavr auto-advances to the next card when a clip finishes", async ({ page }) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({
      json: {
        cards: [
          {
            id: "adv0:ep0",
            episodeId: "ep0",
            showId: "adv0",
            title: "First clip",
            showTitle: "Show 0",
            audioUrl: "https://cdn/ep0.mp3",
            matchedTags: ["psychology"],
            why: "Because you follow psychology",
            score: 0.9,
          },
          {
            id: "adv1:ep1",
            episodeId: "ep1",
            showId: "adv1",
            title: "Second clip",
            showTitle: "Show 1",
            audioUrl: "https://cdn/ep1.mp3",
            matchedTags: ["psychology"],
            why: "Because you follow psychology",
            score: 0.8,
          },
        ],
        cursor: null,
        degraded: false,
      },
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "First clip" })).toBeVisible();

  // Simulate the clip running out — the deck should move to the next card on
  // its own, with no save/skip recorded (no Undo toast).
  await page.evaluate(() => document.querySelector("audio")?.dispatchEvent(new Event("ended")));
  await expect(page.getByRole("heading", { name: "Second clip" })).toBeVisible();
  await expect(page.getByText(/Undo/)).toHaveCount(0);
});

test("/wavr: a quick drag decides, a long-press opens the overview to scrub", async ({ page }) => {
  await stub(page);
  const cards = Array.from({ length: 6 }, (_, i) => ({
    id: `sh${i}:ep${i}`,
    episodeId: `ep${i}`,
    showId: `sh${i}`,
    title: `Scrub card ${i}`,
    showTitle: `Show ${i}`,
    matchedTags: ["psychology"],
    why: "Because you follow psychology",
    score: 0.9 - i * 0.02,
  }));
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({ json: { cards, cursor: null, degraded: false } }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "Scrub card 0" })).toBeVisible();

  const deck = page.getByRole("group", { name: "Recommended episodes" });
  const box = (await deck.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // A quick drag decides the card — the overview must never open for this.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 200, cy, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(/Card 2 of 6\. Scrub card 1/);

  // A hold with no meaningful movement opens the overview instead of dragging.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await expect(page.getByRole("listbox")).toBeVisible();

  // Scrubbing right while still held moves the selection, then releasing
  // jumps to the scrubbed card and closes the overview (zooms back in).
  await page.mouse.move(cx + 130, cy, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Scrub card 3" })).toBeVisible();
});

test("/wavr: bottom controls are skip / '?' overview / save, no settings menu", async ({ page }) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({ json: { cards: WAVR_CARDS, cursor: null, degraded: false } }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");

  // "?" reads plainly, and a real accessible label still backs it for a11y —
  // it sits in the bottom row between skip (x) and save (+), thumb-reachable.
  const overviewBtn = page.getByRole("button", { name: "Overview: see the whole deck" });
  await expect(overviewBtn).toHaveText("?");
  await expect(page.getByRole("button", { name: "Skip this episode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save to library" })).toBeVisible();

  // The settings menu is gone (haptics + waveform are always on now), giving
  // the card that space back.
  await expect(page.getByRole("button", { name: "Deck settings" })).toHaveCount(0);
});

test("/wavr: the card exposes a draggable progress slider", async ({ page }) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({
      json: {
        cards: [
          {
            id: "slider1:ep1",
            episodeId: "ep1",
            showId: "slider1",
            title: "Slider test card",
            showTitle: "Show 0",
            audioUrl: "https://cdn/ep1.mp3",
            matchedTags: ["psychology"],
            why: "Because you follow psychology",
            score: 0.9,
          },
        ],
        cursor: null,
        degraded: false,
      },
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "Slider test card" })).toBeVisible();

  // it's a real slider, not a static bar — actual seeking against a live
  // audio URL is verified manually (fake test URLs never establish a seek
  // origin, so a fake-audio e2e assertion here would test nothing real).
  const slider = page.getByRole("slider", { name: "Seek within the clip" });
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute("aria-valuemin", "0");
  await expect(slider).toHaveAttribute("aria-valuemax", "100");

  // A long-press on the deck must open the deck's OWN overview, never the
  // browser's native long-press menus (image "open/copy", text "Search"
  // callout, context menu). The deck cancels the context menu event.
  const prevented = await page.evaluate(() => {
    const deck = document.querySelector('[role="group"][aria-label="Recommended episodes"]');
    const target = deck?.querySelector("img") ?? deck;
    if (!target) return false;
    const evt = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    target.dispatchEvent(evt);
    return evt.defaultPrevented;
  });
  expect(prevented).toBe(true);
});

test("/wavr: the card's show name links to the show's page", async ({ page }) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({
      json: {
        cards: [
          {
            id: "999:ep1",
            episodeId: "ep1",
            showId: "999",
            title: "An episode",
            showTitle: "Psychology In Seattle",
            audioUrl: "https://cdn/ep1.mp3",
            publishedAt: "2026-07-12T00:00:00Z",
            matchedTags: ["psychology"],
            why: "Because you follow psychology",
            score: 0.9,
          },
        ],
        cursor: null,
        degraded: false,
      },
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "An episode" })).toBeVisible();

  // The show name is a real link (a small, clearly-tappable target) to its page.
  await page.getByRole("link", { name: /Psychology In Seattle/ }).click();
  await expect(page).toHaveURL(/\/show\/999$/);
});

test("/wavr: tapping a tag jumps to the next card that matches it", async ({ page }) => {
  await stub(page);
  const cards = [
    { tag: "psychology", i: 0 },
    { tag: "psychology", i: 1 },
    { tag: "storytelling", i: 2 },
    { tag: "psychology", i: 3 },
  ].map(({ tag, i }) => ({
    id: `tagcard${i}:ep${i}`,
    episodeId: `ep${i}`,
    showId: `tagcard${i}`,
    title: `Tag card ${i}`,
    showTitle: `Show ${i}`,
    matchedTags: [tag],
    why: `Because you follow ${tag}`,
    score: 0.9 - i * 0.02,
  }));
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({ json: { cards, cursor: null, degraded: false } }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({
        interests: ["psychology", "storytelling"],
        rating_sources: { douban: true, xiaoyuzhou: true },
      }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "Tag card 0" })).toBeVisible();

  // tapping "storytelling" jumps straight to the next card tagged with it
  await page.getByRole("button", { name: "storytelling", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tag card 2" })).toBeVisible();

  // tapping the SAME tag again just clears the focus — no further jump
  await page.getByRole("button", { name: "storytelling", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tag card 2" })).toBeVisible();
});

test("/wavr: tags are editable at the bottom (add + remove), backed by prefs", async ({ page }) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) =>
    r.fulfill({
      json: {
        cards: [
          {
            id: "e0:ep0",
            episodeId: "ep0",
            showId: "e0",
            title: "A card",
            showTitle: "Show 0",
            audioUrl: "https://cdn/ep0.mp3",
            matchedTags: ["psychology"],
            why: "reason",
            score: 0.9,
          },
        ],
        cursor: null,
        degraded: false,
      },
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({ interests: ["psychology"], rating_sources: { douban: true, xiaoyuzhou: true } }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "A card" })).toBeVisible();

  // add a new interest from the bottom field — the chip appears (same prefs
  // store the Discovery tab reads, so it's synced there too)
  await page.getByRole("textbox", { name: "Add an interest" }).fill("comedy");
  await page.getByRole("textbox", { name: "Add an interest" }).press("Enter");
  await expect(page.getByRole("button", { name: "comedy", exact: true })).toBeVisible();

  // remove it via the × on the chip
  await page.getByRole("button", { name: "Remove comedy" }).click();
  await expect(page.getByRole("button", { name: "comedy", exact: true })).toHaveCount(0);
});

test("/wavr: tapping a tag with no existing match fetches and jumps to fresh cards", async ({
  page,
}) => {
  await stub(page);
  await page.route("**/api/wavr/feed**", (r) => {
    const url = new URL(r.request().url());
    const tags = url.searchParams.get("tags") ?? "";
    if (tags === "comedy") {
      // the boost fetch triggered by tapping a tag with no queued match
      r.fulfill({
        json: {
          cards: [
            {
              id: "fresh:ep1",
              episodeId: "ep1",
              showId: "fresh",
              title: "Freshly fetched comedy card",
              showTitle: "Comedy Hour",
              matchedTags: ["comedy"],
              why: "Because you follow comedy",
              score: 0.5,
            },
          ],
          cursor: null,
          degraded: false,
        },
      });
      return;
    }
    r.fulfill({
      json: {
        cards: [
          {
            id: "start:ep0",
            episodeId: "ep0",
            showId: "start",
            title: "Starting card",
            showTitle: "Show 0",
            matchedTags: ["psychology"],
            why: "Because you follow psychology",
            score: 0.9,
          },
        ],
        cursor: null,
        degraded: false,
      },
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wavr.prefs.v1",
      JSON.stringify({
        interests: ["psychology", "comedy"],
        rating_sources: { douban: true, xiaoyuzhou: true },
      }),
    );
  });
  await page.goto("/wavr");
  await expect(page.getByRole("heading", { name: "Starting card" })).toBeVisible();

  // no "comedy" card is in the queue yet — tapping it should fetch one and land on it
  await page.getByRole("button", { name: "comedy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Freshly fetched comedy card" })).toBeVisible();
});

test("library leads with content; sync is a top-right tool", async ({ page }) => {
  await stub(page);
  await page.goto("/library");

  // Content is open — no tap needed to reach your own stuff.
  await expect(page.getByRole("heading", { name: /Saved episodes/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Your shows/i })).toBeVisible();

  // Sync is a deliberate, occasional tool: top-right, shut by default.
  await expect(page.getByRole("button", { name: "Import OPML" })).toHaveCount(0);
  const sync = page.getByRole("button", { name: /^Sync$/i });
  await expect(sync).toBeVisible();
  await sync.click();
  await expect(page.getByRole("button", { name: "Import OPML" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export OPML" })).toBeVisible();
  // Pocket Casts sits in the Sync panel, asking for credentials only while
  // not yet connected — once a token is stored it shows Connected instead.
  await expect(page.getByText(/Pulls your play history and your subscriptions/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Connect$/ })).toBeVisible();
  // Signing in lives here now, not on Discover.
  await expect(page.getByPlaceholder(/sync your picks/i)).toBeVisible();
});
