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

async function stub(page: Page, over: { topPicks?: unknown } = {}) {
  await page.route("**/api/**", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/catalog/search**", (r) => r.fulfill({ json: SEARCH }));
  await page.route("**/api/catalog/similar**", (r) => r.fulfill({ json: SIMILAR }));
  await page.route("**/api/catalog/preview**", (r) => r.fulfill({ json: { episodes: [] } }));
  await page.route("**/api/catalog/top-picks**", (r) =>
    r.fulfill({ json: over.topPicks ?? { picks: [], degraded: true } }),
  );
}

test("live search shows results and a 'More like' section without a click", async ({ page }) => {
  await stub(page);
  await page.goto("/search");
  await page.fill("input", "Psychology");
  await expect(page.getByText("Psychology In Seattle").first()).toBeVisible();
  await expect(page.getByText("More like Psychology In Seattle")).toBeVisible();
});

test("topics lead with trending; personal niche seeds are absent", async ({ page }) => {
  await stub(page);
  await page.goto("/topics");
  await expect(page.getByText("true crime", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Asian gay podcasts")).toHaveCount(0);
});

test("settings offers custom interests, no personal seeds", async ({ page }) => {
  await stub(page);
  await page.goto("/settings");
  await expect(page.getByPlaceholder(/Add an interest/)).toBeVisible();
  await expect(page.getByText("Asian gay podcasts")).toHaveCount(0);
});

test("queue an episode for later, then it appears in the Library", async ({ page }) => {
  await stub(page);
  await page.goto("/search");
  await page.fill("input", "Psychology");
  await page.getByText("More like Psychology In Seattle").waitFor();
  await page.getByRole("button", { name: /Episodes \(1\)/ }).click();
  await page.getByRole("button", { name: "+ Later", exact: true }).click();
  await expect(page.getByRole("button", { name: "Queued ✓", exact: true })).toBeVisible();

  await page.goto("/library");
  await page.getByRole("button", { name: "Listen later" }).click();
  await expect(page.getByText("Ep 12: Attachment styles")).toBeVisible();
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

test("discover ranks recommendations and opens a show's episodes", async ({ page }) => {
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
  // spotlight (#1) and a further pick (#2) are present, in order
  await expect(page.getByRole("heading", { name: "Psychology In Seattle" })).toBeVisible();
  await expect(page.getByText("Where Should We Begin").first()).toBeVisible();
  await expect(page.getByText("Play the talked-about bit")).toBeVisible();

  // opening a show reveals its discussion-first episode ranking
  await page.getByRole("button", { name: /Top episodes/ }).first().click();
  await expect(page.getByText("The one everyone argues about")).toBeVisible();
  await expect(page.getByText("Most discussed · 40 Reddit threads")).toBeVisible();

  // tapping the reason badge expands the real community thread behind it
  await page.getByRole("button", { name: /Talked about on Reddit/ }).first().click();
  await expect(
    page.getByText("Psychology In Seattle changed how I think about relationships"),
  ).toBeVisible();
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

test("discover surfaces the 中文播客榜 chart in the Charts block", async ({ page }) => {
  await stub(page);
  await page.route("**/api/catalog/charts/chinese**", (r) =>
    r.fulfill({
      json: {
        shows: [
          show("900", "故事FM", "寇爱哲", ["Society & Culture"], {
            why: "#1 on 中文播客榜 · 12w subscribers",
          }),
        ],
        degraded: false,
      },
    }),
  );

  await page.goto("/");
  // Charts block is present with the 中文播客榜 tab active by default
  await expect(page.getByRole("heading", { name: "Charts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "中文播客榜" })).toBeVisible();
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
  await page.getByRole("button", { name: "Global" }).click();
  await expect(page.getByText("Radiolab")).toBeVisible();
  await expect(page.getByText("Buzzing on Reddit · 3.4k threads")).toBeVisible();
});

test("library offers OPML import and export", async ({ page }) => {
  await stub(page);
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "Import OPML" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export OPML" })).toBeVisible();
});
