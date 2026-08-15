// firecrawl-adapter.mjs
//
// Adapter for companies whose careers page isn't backed by Greenhouse/Lever/
// Ashby (ats: null in resolved-companies.json — e.g. Adyen, Booking.com,
// Coolblue run custom/enterprise ATS). Those companies get a `careerPageUrl`
// in companies.json instead of an `ats`/`slug` pair; this module hits that
// URL through Firecrawl's Extract endpoint and asks for structured
// { title, location, url } job data — not a raw scrape/crawl, so it stays
// cheap on the free tier (one page per call, not a whole-site crawl).
//
// Requires: FIRECRAWL_API_KEY env var — free tier, no card, 1,000
// credits/month: https://firecrawl.dev
//
// Not meant to be run directly — see scan-custom.mjs (CLI) or the
// scan_custom_pages MCP tool in mcp-server.mjs for callers.
//
// Requires: Node 18+ (global fetch, node:crypto)

import crypto from 'node:crypto';

const EXTRACT_URL = 'https://api.firecrawl.dev/v1/extract';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

// Extract wants an object schema (not a bare array) — the array of postings
// lives under `jobs`.
const JOB_SCHEMA = {
  type: 'object',
  properties: {
    jobs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          location: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['title', 'url'],
      },
    },
  },
  required: ['jobs'],
};

const EXTRACT_PROMPT =
  'Extract every currently open job posting listed on this page. For each one, ' +
  'return its title, its location if shown (empty string if not shown), and the ' +
  'direct URL to that job posting\'s detail page.';

function requireApiKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error(
      'FIRECRAWL_API_KEY is not set. Get a free key (no card required) at ' +
        'https://firecrawl.dev, then export FIRECRAWL_API_KEY=fc-... before running this.'
    );
  }
  return key;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
}

// Kicks off exactly one Extract job against a single URL. This is the only
// network call that spends credits — callers must not loop this per-company
// more than once per run.
async function startExtract(url, apiKey) {
  const res = await fetch(EXTRACT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls: [url],
      prompt: EXTRACT_PROMPT,
      schema: JOB_SCHEMA,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const detail = body?.error ?? `HTTP ${res.status}`;
    throw new Error(`Firecrawl extract request failed for ${url}: ${detail}`);
  }
  return body.id;
}

async function pollExtract(id, apiKey) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${EXTRACT_URL}/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      const detail = body?.error ?? `HTTP ${res.status}`;
      throw new Error(`Firecrawl extract poll failed for job ${id}: ${detail}`);
    }
    if (body.status === 'completed') return body.data ?? {};
    if (body.status === 'failed' || body.status === 'cancelled') {
      throw new Error(`Firecrawl extract job ${id} ended with status "${body.status}"`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Firecrawl extract job ${id} timed out after ${POLL_TIMEOUT_MS}ms`);
}

// Runs one Extract call against a company's careers page and returns
// normalized job objects: { id, title, location, url }. `id` is namespaced
// as "firecrawl:{companyName}:{hash of job url}" so it can't collide with
// the "greenhouse:{slug}:{jobId}" / "lever:..." / "ashby:..." keys already
// in seen-jobs.json.
export async function extractCompanyJobs(company, apiKey = requireApiKey()) {
  if (!company.careerPageUrl) return [];
  const id = await startExtract(company.careerPageUrl, apiKey);
  const data = await pollExtract(id, apiKey);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs
    .filter((j) => j?.title && j?.url)
    .map((j) => ({
      id: `firecrawl:${company.name}:${hashUrl(j.url)}`,
      title: j.title,
      location: j.location ?? '',
      url: j.url,
    }));
}

export { requireApiKey };
