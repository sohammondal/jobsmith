// hn-jobs-adapter.mjs
//
// Adapter for Hacker News' official Jobs feed (https://news.ycombinator.com/jobs)
// — YC-company postings, submitted as HN "job" type items. Uses the public
// Firebase-backed HN API (free, no key) rather than scraping the HTML page:
// same job stories, and hn.firebaseio.com isn't subject to the HTML site's
// rate limiting.
//
// Titles are auto-templated ("{Company} (YC {Batch}) Is hiring {role}") but
// otherwise wordy and rarely state location or the exact role precisely —
// same "titles only, gets noisy" tradeoff scan.mjs already accepts for ATS
// sources, just more so. `location` is always '' here (unlike Greenhouse/
// Lever/Ashby/Firecrawl, which do provide it) — matches from this source
// need a manual glance at the linked posting to confirm fit.
//
// Requires: Node 18+ (global fetch)

const JOB_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/jobstories.json';
const ITEM_URL = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

async function safeFetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'jobsmith/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parseCompany(title) {
  const match = title.match(/^(.+?)\s*\(YC\b/i);
  return match ? match[1].trim() : title;
}

// Returns normalized job objects: { id, company, title, location, url, postedAt }.
export async function fetchHnJobs() {
  const ids = await safeFetchJson(JOB_STORIES_URL);
  if (!Array.isArray(ids)) return [];

  const items = await Promise.all(ids.map((id) => safeFetchJson(ITEM_URL(id))));
  return items
    .filter((item) => item?.title && item?.url)
    .map((item) => ({
      id: `hn:${item.id}`,
      company: parseCompany(item.title),
      title: item.title,
      location: '',
      url: item.url,
      postedAt: item.time ? new Date(item.time * 1000).toISOString() : '',
    }));
}
