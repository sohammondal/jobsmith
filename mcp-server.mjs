#!/usr/bin/env node
// mcp-server.mjs
//
// Exposes five tools over MCP (stdio transport), callable from OpenCode,
// Claude Code, Claude Desktop, or any other MCP-capable AI CLI:
//
//   resolve_companies  — probes Greenhouse/Lever/Ashby for each company in
//                        companies.json, records which ATS+slug matched
//   scan_jobs          — fetches current jobs from resolved companies,
//                        filters by keyword, returns only new postings
//   scan_custom_pages  — for companies with a custom ATS (careerPageUrl in
//                        companies.json), pulls structured job data via
//                        Firecrawl's Extract endpoint, same keyword filter
//                        and dedup as scan_jobs
//   scan_hn_jobs       — scans Hacker News' Jobs feed (YC-company postings),
//                        deep-checking role-less titles via Firecrawl (see
//                        hn-jobs-adapter.mjs / scan-hn-jobs.mjs)
//   render_pdfs        — renders an applications/{slug}/ folder's cv.md and
//                        cover-letter.md to ATS-friendly PDFs (see
//                        render-pdfs.mjs)
//
// $0 cost for resolve_companies/scan_jobs/render_pdfs: no paid API involved
// (render_pdfs runs md-to-pdf fully locally). scan_custom_pages and
// scan_hn_jobs use Firecrawl's free tier (1,000 credits/month, no card) for
// deep-checking — scan_custom_pages requires FIRECRAWL_API_KEY (that's its
// only mechanism), scan_hn_jobs works without it too but falls back to
// (much noisier) title-only matching.
//
// Setup:
//   npm install @modelcontextprotocol/sdk zod
//   export FIRECRAWL_API_KEY=fc-...   (only needed for scan_custom_pages)
//   node mcp-server.mjs   (normally launched by your MCP client, not by hand)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCompanyJobs, requireApiKey } from './firecrawl-adapter.mjs';
import { renderPdfs } from './render-pdfs.mjs';
import { fetchHnJobs } from './hn-jobs-adapter.mjs';
import { KEYWORDS as DEFAULT_KEYWORDS } from './keywords.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const paths = {
  companies: path.join(__dirname, 'companies.json'),
  resolved: path.join(__dirname, 'resolved-companies.json'),
  seen: path.join(__dirname, 'seen-jobs.json'),
  log: path.join(__dirname, 'new-matches.log.tsv'),
  hnChecked: path.join(__dirname, 'hn-checked.json'),
};

async function loadJSON(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function safeFetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'jobsmith-mcp/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- ATS adapters (Greenhouse / Lever / Ashby) ----

async function tryGreenhouse(slug) {
  const data = await safeFetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  if (!data?.jobs?.length) return null;
  return { ats: 'greenhouse', slug, jobs: data.jobs.map((j) => ({
    id: `greenhouse:${slug}:${j.id}`, title: j.title, location: j.location?.name ?? '', url: j.absolute_url,
  })) };
}

async function tryLever(slug) {
  const data = await safeFetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(data) || !data.length) return null;
  return { ats: 'lever', slug, jobs: data.map((j) => ({
    id: `lever:${slug}:${j.id}`, title: j.text, location: j.categories?.location ?? '', url: j.hostedUrl,
  })) };
}

async function tryAshby(slug) {
  const data = await safeFetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!data?.jobs?.length) return null;
  return { ats: 'ashby', slug, jobs: data.jobs.map((j) => ({
    id: `ashby:${slug}:${j.id}`, title: j.title, location: j.location ?? '', url: j.jobUrl,
  })) };
}

const FETCHERS = { greenhouse: tryGreenhouse, lever: tryLever, ashby: tryAshby };

function slugCandidates(company) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domainRoot = company.domain?.split('.')[0] ?? '';
  return [...new Set([clean(company.name), clean(domainRoot), company.name.toLowerCase().replace(/\s+/g, '-')])].filter(Boolean);
}

// ---- MCP server ----

const server = new McpServer({ name: 'jobsmith', version: '0.1.0' });

server.registerTool(
  'resolve_companies',
  {
    title: 'Resolve target companies to their ATS',
    description:
      'Probes Greenhouse/Lever/Ashby public APIs for each company in companies.json and records which one (if any) matches. Run once, and again after adding companies.',
    inputSchema: {},
  },
  async () => {
    const companies = await loadJSON(paths.companies, []);
    const results = [];
    for (const company of companies) {
      let hit = null;
      for (const slug of slugCandidates(company)) {
        for (const fn of [tryGreenhouse, tryLever, tryAshby]) {
          hit = await fn(slug);
          if (hit) break;
        }
        if (hit) break;
        await sleep(150);
      }
      results.push({ name: company.name, domain: company.domain, ats: hit?.ats ?? null, slug: hit?.slug ?? null });
    }
    await fs.writeFile(paths.resolved, JSON.stringify(results, null, 2));
    const lines = results.map((r) => (r.ats ? `✅ ${r.name} → ${r.ats}/${r.slug}` : `❌ ${r.name} — no match (custom ATS, check manually)`));
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

server.registerTool(
  'scan_jobs',
  {
    title: 'Scan resolved companies for new matching roles',
    description:
      'Fetches current jobs from every resolved company, filters titles against a keyword pattern (default: KEYWORD_LIST in keywords.mjs), and returns only postings not seen in a previous scan.',
    inputSchema: {
      keywords: z.string().optional().describe('Optional regex (as a string) to override the default keyword filter'),
    },
  },
  async ({ keywords }) => {
    const companies = await loadJSON(paths.resolved, null);
    if (!companies) {
      return { content: [{ type: 'text', text: 'No resolved-companies.json yet — run resolve_companies first.' }] };
    }
    const pattern = keywords ? new RegExp(keywords, 'i') : DEFAULT_KEYWORDS;
    const seen = await loadJSON(paths.seen, {});
    const newMatches = [];

    for (const company of companies) {
      if (!company.ats) continue;
      const fetcher = FETCHERS[company.ats];
      const hit = await fetcher(company.slug);
      if (!hit) continue;
      for (const job of hit.jobs) {
        if (!pattern.test(job.title)) continue;
        if (seen[job.id]) continue;
        newMatches.push({ company: company.name, ...job });
        seen[job.id] = new Date().toISOString();
      }
    }

    await fs.writeFile(paths.seen, JSON.stringify(seen, null, 2));
    if (newMatches.length) {
      const logLines = newMatches.map((m) => `${new Date().toISOString()}\t${m.company}\t${m.title}\t${m.location}\t${m.url}`).join('\n') + '\n';
      await fs.appendFile(paths.log, logLines);
    }

    const text = newMatches.length
      ? newMatches.map((m) => `- [${m.company}] ${m.title} (${m.location})\n  ${m.url}`).join('\n')
      : 'No new matches this run.';
    return { content: [{ type: 'text', text }] };
  }
);

server.registerTool(
  'scan_custom_pages',
  {
    title: 'Scan custom-ATS career pages via Firecrawl',
    description:
      'For each company in companies.json with a careerPageUrl (custom ATS, not covered by resolve_companies/scan_jobs — typically larger companies on Workday/SmartRecruiters/etc.), calls Firecrawl\'s Extract endpoint once to pull structured job listings, filters titles against a keyword pattern, and returns only postings not seen in a previous scan. Requires FIRECRAWL_API_KEY (free tier, no card — https://firecrawl.dev).',
    inputSchema: {
      keywords: z.string().optional().describe('Optional regex (as a string) to override the default keyword filter'),
    },
  },
  async ({ keywords }) => {
    let apiKey;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
    }

    const companies = await loadJSON(paths.companies, []);
    const targets = companies.filter((c) => c.careerPageUrl);
    if (!targets.length) {
      return { content: [{ type: 'text', text: 'No companies with a careerPageUrl in companies.json — nothing to scan.' }] };
    }

    const pattern = keywords ? new RegExp(keywords, 'i') : DEFAULT_KEYWORDS;
    const seen = await loadJSON(paths.seen, {});
    const newMatches = [];
    const errors = [];

    for (const company of targets) {
      let jobs;
      try {
        jobs = await extractCompanyJobs(company, apiKey);
      } catch (err) {
        errors.push(`${company.name}: ${err.message}`);
        continue;
      }
      for (const job of jobs) {
        if (!pattern.test(job.title)) continue;
        if (seen[job.id]) continue;
        newMatches.push({ company: company.name, ...job });
        seen[job.id] = new Date().toISOString();
      }
    }

    await fs.writeFile(paths.seen, JSON.stringify(seen, null, 2));
    if (newMatches.length) {
      const logLines = newMatches.map((m) => `${new Date().toISOString()}\t${m.company}\t${m.title}\t${m.location}\t${m.url}`).join('\n') + '\n';
      await fs.appendFile(paths.log, logLines);
    }

    const lines = newMatches.length
      ? newMatches.map((m) => `- [${m.company}] ${m.title} (${m.location})\n  ${m.url}`)
      : ['No new matches this run.'];
    if (errors.length) {
      lines.push('', 'Errors:', ...errors.map((e) => `⚠️  ${e}`));
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

server.registerTool(
  'scan_hn_jobs',
  {
    title: "Scan Hacker News' Jobs feed",
    description:
      "Scans news.ycombinator.com/jobs (YC-company postings, via HN's free public API) for roles matching a keyword pattern. Titles are often role-less (\"Company Is Hiring\", no \"Engineer\"/\"Frontend\" stated) — for any title that doesn't match on its own, this does one Firecrawl Extract call against that story's own linked page to check the actual role/location (needs FIRECRAWL_API_KEY; falls back to title-only matching with a warning if unset). Each story is only ever deep-checked once (cached in hn-checked.json), so re-running doesn't re-spend credits on the same non-matching postings.",
    inputSchema: {
      keywords: z.string().optional().describe('Optional regex (as a string) to override the default keyword filter'),
    },
  },
  async ({ keywords }) => {
    const pattern = keywords ? new RegExp(keywords, 'i') : DEFAULT_KEYWORDS;
    const seen = await loadJSON(paths.seen, {});
    const checkedCache = await loadJSON(paths.hnChecked, {});

    let apiKey;
    try {
      apiKey = requireApiKey();
    } catch {
      // fall back to title-only matching below
    }

    const jobs = await fetchHnJobs();
    const newMatches = [];

    for (const job of jobs) {
      if (seen[job.id]) continue;

      let matched = pattern.test(job.title);
      let location = job.location;
      let displayTitle = job.title;

      if (!matched && apiKey && !checkedCache[job.id]) {
        try {
          const extracted = await extractCompanyJobs({ name: job.company, careerPageUrl: job.url }, apiKey);
          checkedCache[job.id] = new Date().toISOString();
          const role = extracted[0]?.title ?? null;
          if (role && pattern.test(role)) {
            matched = true;
            location = extracted[0]?.location ?? '';
            displayTitle = `${job.title} — actual role: ${role}`;
          }
        } catch {
          checkedCache[job.id] = new Date().toISOString();
        }
      }

      if (!matched) continue;
      newMatches.push({ ...job, title: displayTitle, location });
      seen[job.id] = new Date().toISOString();
    }

    await fs.writeFile(paths.seen, JSON.stringify(seen, null, 2));
    await fs.writeFile(paths.hnChecked, JSON.stringify(checkedCache, null, 2));
    if (newMatches.length) {
      const logLines = newMatches.map((m) => `${new Date().toISOString()}\t${m.company}\t${m.title}\t${m.location}\t${m.url}`).join('\n') + '\n';
      await fs.appendFile(paths.log, logLines);
    }

    const lines = newMatches.length
      ? newMatches.map((m) => `- [${m.company}] ${m.title}\n  ${m.url}`)
      : ['No new matches this run.'];
    if (!apiKey) {
      lines.push('', '⚠️  FIRECRAWL_API_KEY not set — used title-only matching, which under-catches on this source (many titles have no role info at all).');
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

server.registerTool(
  'render_pdfs',
  {
    title: "Render an application's CV/cover letter to PDF",
    description:
      "Renders applications/{slug}/cv.md and cover-letter.md to ATS-friendly PDFs (real text layer, single column, no images) via md-to-pdf, styled with templates/cv.config.json and templates/cover-letter.config.json. Run after workflows/generate-application.md drafts the markdown, or after hand-editing it.",
    inputSchema: {
      slug: z
        .string()
        .describe('The applications/{slug} folder name, e.g. figma-senior-frontend-engineer'),
    },
  },
  async ({ slug }) => {
    try {
      const results = renderPdfs(slug);
      const lines = results.map((r) =>
        r.status === 'rendered'
          ? `✅ ${r.pdf}`
          : r.status === 'skipped'
            ? `⏭️  ${r.file} — ${r.reason}`
            : `❌ ${r.file} — ${r.reason}`
      );
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
