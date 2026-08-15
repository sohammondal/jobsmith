#!/usr/bin/env node
// scan-hn-jobs.mjs
//
// Scans Hacker News' Jobs feed (YC-company postings, see hn-jobs-adapter.mjs)
// for roles matching KEYWORDS, dedups against seen-jobs.json (ids prefixed
// `hn:`, can't collide with greenhouse/lever/ashby/firecrawl/manual keys),
// and logs new matches to the same new-matches.log.tsv the other scanners
// write to.
//
// HN Jobs titles are auto-templated and often role-less ("Company Is
// Hiring", no "Engineer"/"Frontend" anywhere) — title-only keyword
// matching under-catches badly on this source specifically. So: for any
// title that doesn't match on its own, and FIRECRAWL_API_KEY is set, this
// does one Extract call (reusing the same adapter used for any
// custom-ATS company in companies.json) against that story's own linked
// page to check the actual role/location. Each story only ever gets
// checked once — results (matched or not) are cached in hn-checked.json —
// so re-running doesn't re-spend credits on the same non-matching
// postings every time. Without FIRECRAWL_API_KEY set, this falls back to
// title-only matching (a warning is printed, not a silent skip).
//
// Run manually: node scan-hn-jobs.mjs
// Run on a schedule: add to cron, e.g.
//   10 8 * * * cd /path/to/jobsmith && FIRECRAWL_API_KEY=fc-... /usr/bin/node scan-hn-jobs.mjs >> scan.log 2>&1
//
// Requires: Node 18+ (global fetch)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchHnJobs } from './hn-jobs-adapter.mjs';
import { extractCompanyJobs, requireApiKey } from './firecrawl-adapter.mjs';
import { KEYWORDS } from './keywords.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadJSON(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

// One Extract call against the HN story's own linked page — treats it the
// same as any single-company careers page (extractCompanyJobs asks for
// "every job posting on this page"; a job-detail page yields just the one).
async function checkRoleViaFirecrawl(job, apiKey) {
  try {
    const extracted = await extractCompanyJobs({ name: job.company, careerPageUrl: job.url }, apiKey);
    const role = extracted[0]?.title ?? null;
    const location = extracted[0]?.location ?? '';
    return { role, location, matched: role ? KEYWORDS.test(role) : false };
  } catch (err) {
    return { role: null, location: '', matched: false, error: err.message };
  }
}

async function main() {
  const seenPath = path.join(__dirname, 'seen-jobs.json');
  const checkedPath = path.join(__dirname, 'hn-checked.json');
  const logPath = path.join(__dirname, 'new-matches.log.tsv');

  const seen = await loadJSON(seenPath, {});
  const checked = await loadJSON(checkedPath, {});

  let apiKey;
  try {
    apiKey = requireApiKey();
  } catch {
    console.warn(
      "⚠️  FIRECRAWL_API_KEY not set — falling back to title-only matching. " +
        'Many HN Jobs titles have no role info at all ("Company Is Hiring"), ' +
        'so this will under-catch. Set FIRECRAWL_API_KEY to check each ' +
        "role-less title's linked posting instead."
    );
  }

  const jobs = await fetchHnJobs();
  const newMatches = [];

  for (const job of jobs) {
    if (seen[job.id]) continue;

    let matched = KEYWORDS.test(job.title);
    let location = job.location;
    let displayTitle = job.title;

    if (!matched && apiKey && !checked[job.id]) {
      const result = await checkRoleViaFirecrawl(job, apiKey);
      checked[job.id] = new Date().toISOString();
      if (result.matched) {
        matched = true;
        location = result.location;
        displayTitle = `${job.title} — actual role: ${result.role}`;
      }
    }

    if (!matched) continue;
    newMatches.push({ ...job, title: displayTitle, location });
    seen[job.id] = new Date().toISOString();
  }

  if (newMatches.length) {
    console.log(`\n🎯 ${newMatches.length} new matching role(s) on HN Jobs — verify location before applying:\n`);
    for (const m of newMatches) {
      console.log(`- [${m.company}] ${m.title}`);
      console.log(`  ${m.url}`);
    }
    const logLines =
      newMatches
        .map((m) => `${new Date().toISOString()}\t${m.company}\t${m.title}\t${m.location}\t${m.url}`)
        .join('\n') + '\n';
    await fs.appendFile(logPath, logLines);
  } else {
    console.log('No new matches this run.');
  }

  await fs.writeFile(seenPath, JSON.stringify(seen, null, 2));
  await fs.writeFile(checkedPath, JSON.stringify(checked, null, 2));
}

main();
