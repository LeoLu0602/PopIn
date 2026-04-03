import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://activities.osu.edu';
const START_URL = `${BASE_URL}/events.aspx`;
// Pagination URL: increment vp for each additional page
const PAGE_URL = (vp: number) =>
  `${BASE_URL}/events.aspx?y=2026&mo=4&day=2&d=54&vp=${vp}&m=Day&v=Grid`;

const TARGET_COUNT = 50;
const DELAY_MS = 600;

// Only include events on or after April 5, 2026
const FILTER_FROM: { y: number; mo: number; day: number } = {
  y: 2026,
  mo: 4,
  day: 5,
};

interface ScrapedEvent {
  external_id: string;
  title: string;
  description: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  cost: string | null;
  categories: string[];
  organization: string | null;
  url: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract the `e` param from an OSU event URL */
function extractEventId(href: string): string | null {
  const m = href.match(/[?&]e=(\d+)/);
  return m ? m[1] : null;
}

/**
 * Return true if the event URL date params meet or exceed the filter date.
 * Compares y, mo, day URL params.
 */
function isOnOrAfterFilterDate(href: string): boolean {
  const y = parseInt(href.match(/[?&]y=(\d+)/)?.[1] ?? '0');
  const mo = parseInt(href.match(/[?&]mo=(\d+)/)?.[1] ?? '0');
  const day = parseInt(href.match(/[?&]day=(\d+)/)?.[1] ?? '0');
  if (y > FILTER_FROM.y) return true;
  if (y < FILTER_FROM.y) return false;
  if (mo > FILTER_FROM.mo) return true;
  if (mo < FILTER_FROM.mo) return false;
  return day >= FILTER_FROM.day;
}

/** Collect event links from the current list page, filtered by date */
async function collectEventLinks(
  page: import('playwright').Page,
): Promise<Array<{ id: string; url: string }>> {
  const hrefs: string[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((h) => /[?&]e=\d+/.test(h)),
  );

  const seen = new Set<string>();
  const results: Array<{ id: string; url: string }> = [];
  for (const href of hrefs) {
    const id = extractEventId(href);
    if (id && !seen.has(id) && isOnOrAfterFilterDate(href)) {
      seen.add(id);
      results.push({ id, url: href });
    }
  }
  return results;
}

/** Scrape a single event detail page */
async function scrapeDetailPage(
  page: import('playwright').Page,
  url: string,
  id: string,
): Promise<ScrapedEvent> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // ── Title ──────────────────────────────────────────────────────────────────
  // The event title is in an <h1> that is NOT "Student Activities"
  const title: string = await page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll('h1'));
    const found = h1s.find((h) => {
      const t = h.textContent?.trim() ?? '';
      return t.length > 0 && t !== 'Student Activities';
    });
    return found?.textContent?.trim() ?? '(no title)';
  });

  // ── Date / Time ────────────────────────────────────────────────────────────
  // Format: <p><strong>Date:</strong> Sunday, April 5, 2026, 4 p.m. - 6 p.m.</p>
  const rawDate: string | null = await page.evaluate(() => {
    const paras = Array.from(document.querySelectorAll('p'));
    const p = paras.find((el) => el.textContent?.trim().startsWith('Date:'));
    if (!p) return null;
    return p.textContent?.trim().replace(/^Date:\s*/i, '').replace(/\s+/g, ' ').trim() ?? null;
  });

  // Split "Sunday, April 5, 2026, 4 p.m. - 6 p.m." into date and time parts
  // Handles "noon", "midnight", and standard "N a.m./p.m." formats
  let date: string | null = null;
  let time: string | null = null;
  if (rawDate) {
    const TIME_RE =
      /((?:noon|midnight|\d{1,2}(?::\d{2})?\s*[ap]\.m\.)(?:\s*[-–]\s*(?:noon|midnight|\d{1,2}(?::\d{2})?\s*[ap]\.m\.))?)\s*$/i;
    const timeMatch = rawDate.match(TIME_RE);
    if (timeMatch) {
      time = timeMatch[1].trim();
      date = rawDate.slice(0, rawDate.length - timeMatch[0].length).replace(/,\s*$/, '').trim();
    } else {
      date = rawDate;
    }
  }

  // ── Location ───────────────────────────────────────────────────────────────
  const location: string | null = await page.evaluate(() => {
    const paras = Array.from(document.querySelectorAll('p'));
    const p = paras.find((el) => el.textContent?.trim().startsWith('Location:'));
    return p?.textContent?.trim().replace(/^Location:\s*/i, '').trim() ?? null;
  });

  // ── Cost ───────────────────────────────────────────────────────────────────
  const cost: string | null = await page.evaluate(() => {
    const paras = Array.from(document.querySelectorAll('p'));
    const p = paras.find((el) => el.textContent?.trim().startsWith('Cost:'));
    return p?.textContent?.trim().replace(/^Cost:\s*/i, '').trim() ?? null;
  });

  // ── Description ────────────────────────────────────────────────────────────
  // Content paragraphs: skip metadata, nav, accessibility notices
  const SKIP_PATTERNS = [
    /^Date:/i,
    /^Location:/i,
    /^Cost:/i,
    /Ohio State University/,
    /Student Activities/,
    /Office of Student Life/,
    /View as grid/i,
    /View as calendar/i,
    /require an accommodation/i,
    /alternate format/i,
    /Privacy statement/i,
    /Cookie Settings/i,
    // Contact info paragraphs: contain an email address
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i,
    // Cookie consent modal text
    /cookie/i,
  ];
  // Join ALL surviving paragraphs so multi-paragraph descriptions are complete
  const description: string | null = await page.evaluate((patterns) => {
    const paras = Array.from(document.querySelectorAll('p'))
      .map((p) => p.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(
        (t) =>
          t.length > 30 &&
          !patterns.some((re) => new RegExp(re, 'i').test(t)),
      );
    return paras.length > 0 ? paras.join('\n\n') : null;
  }, SKIP_PATTERNS.map((r) => r.source));

  // ── Categories / Tags ──────────────────────────────────────────────────────
  // <h2 class="is-hidden-accessible">Tags</h2>
  // <ul class="c-list"><li class="c-tag"><a class="c-tag__link">…</a></li></ul>
  // The h2 and ul are siblings inside the same parent container.
  const categories: string[] = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const tagsH2 = h2s.find((h) => h.textContent?.trim() === 'Tags');
    if (!tagsH2) return [];
    // Walk next element siblings of the h2 itself (not its parent)
    let sib = tagsH2.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'UL') {
        return Array.from(sib.querySelectorAll('a.c-tag__link'))
          .map((a) => a.textContent?.trim().replace(/^#/, '') ?? '')
          .filter(Boolean);
      }
      sib = sib.nextElementSibling;
    }
    return [];
  });

  // ── Organization ──────────────────────────────────────────────────────────
  // <div class="s-editor"><h2>…Brought to you by…</h2></div>
  // <ul class="c-list"><li class="c-tag"><a href="/involvement/...">Org Name</a></li></ul>
  const organization: string | null = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const orgH2 = h2s.find((h) => h.textContent?.includes('Brought to you by'));
    if (!orgH2) return null;
    const editorDiv = orgH2.closest('.s-editor') ?? orgH2.parentElement;
    if (!editorDiv) return null;
    let sib = editorDiv.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'UL') {
        const names = Array.from(sib.querySelectorAll('a.c-tag__link'))
          .map((a) => a.textContent?.trim() ?? '')
          .filter(Boolean);
        return names.join(', ') || null;
      }
      sib = sib.nextElementSibling;
    }
    return null;
  });

  return {
    external_id: id,
    title,
    description,
    date,
    time,
    location,
    cost,
    categories,
    organization,
    url,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; PopIn-scraper/1.0; +https://pop-in-osu.vercel.app)',
  });
  const page = await context.newPage();

  const allEventLinks: Array<{ id: string; url: string }> = [];
  const seenIds = new Set<string>();

  // ── Step 1: collect event links across pages ──────────────────────────────
  console.log('\nCollecting event links…');
  let vp = 0;

  while (allEventLinks.length < TARGET_COUNT) {
    const url = vp === 0 ? START_URL : PAGE_URL(vp);
    console.log(`  Fetching list page vp=${vp}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const links = await collectEventLinks(page);
    let added = 0;
    for (const link of links) {
      if (!seenIds.has(link.id)) {
        seenIds.add(link.id);
        allEventLinks.push(link);
        added++;
      }
    }
    console.log(`    → ${added} new qualifying links (total: ${allEventLinks.length})`);

    // Check for a next page
    const nextVp = vp + 1;
    const hasNext: boolean = await page.evaluate((nv) =>
      Array.from(document.querySelectorAll('a[href]')).some(
        (a) => (a as HTMLAnchorElement).href.includes(`vp=${nv}`) &&
               (a as HTMLAnchorElement).href.includes('m=Day'),
      ), nextVp);

    if (!hasNext) {
      console.log(`  No more pages.`);
      break;
    }
    vp = nextVp;
    await sleep(DELAY_MS);
  }

  const toScrape = allEventLinks.slice(0, TARGET_COUNT);
  console.log(
    `\nFound ${allEventLinks.length} qualifying events — scraping ${toScrape.length} detail pages…\n`,
  );

  if (toScrape.length === 0) {
    console.log('Nothing to scrape.');
    await browser.close();
    return;
  }

  // ── Step 2: scrape each detail page ───────────────────────────────────────
  const results: ScrapedEvent[] = [];
  for (let i = 0; i < toScrape.length; i++) {
    const { id, url } = toScrape[i];
    try {
      const event = await scrapeDetailPage(page, url, id);
      results.push(event);
      console.log(`  [${i + 1}/${toScrape.length}] ✓ ${event.title}`);
    } catch (err) {
      console.error(`  [${i + 1}/${toScrape.length}] ✗ ${id}: ${err}`);
    }
    await sleep(DELAY_MS);
  }

  await browser.close();

  // ── Step 3: write JSON ─────────────────────────────────────────────────────
  const outPath = join(__dirname, 'events.json');
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nDone! ${results.length} events written to ${outPath}`);
  if (results.length < TARGET_COUNT) {
    console.log(
      `Note: only ${results.length} events found on activities.osu.edu from April 5, 2026 onwards.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
