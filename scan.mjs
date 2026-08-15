#!/usr/bin/env node
// scan.mjs
//
// Pulls current open jobs from every resolved company (resolved-companies.json),
// filters titles against KEYWORDS, diffs against seen-jobs.json so you only see
// what's genuinely new since the last run, and logs new matches.
//
// Run manually: node scan.mjs
// Run on a schedule: add to cron, e.g.
//   0 8 * * * cd /path/to/jobsmith && /usr/bin/node scan.mjs >> scan.log 2>&1
//
// Requires: Node 18+ (uses global fetch)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEYWORDS } from './keywords.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadJSON(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function safeFetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'jobsmith/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchGreenhouse(slug) {
  const data = await safeFetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
  if (!data?.jobs) return [];
  return data.jobs.map((j) => ({
    id: `greenhouse:${slug}:${j.id}`,
    title: j.title,
    location: j.location?.name ?? '',
    url: j.absolute_url,
    postedAt: j.updated_at,
  }));
}

async function fetchLever(slug) {
  const data = await safeFetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(data)) return [];
  return data.map((j) => ({
    id: `lever:${slug}:${j.id}`,
    title: j.text,
    location: j.categories?.location ?? '',
    url: j.hostedUrl,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : '',
  }));
}

async function fetchAshby(slug) {
  const data = await safeFetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!data?.jobs) return [];
  return data.jobs.map((j) => ({
    id: `ashby:${slug}:${j.id}`,
    title: j.title,
    location: j.location ?? '',
    url: j.jobUrl,
    postedAt: j.publishedAt ?? '',
  }));
}

const FETCHERS = { greenhouse: fetchGreenhouse, lever: fetchLever, ashby: fetchAshby };

async function main() {
  const companiesPath = path.join(__dirname, 'resolved-companies.json');
  const seenPath = path.join(__dirname, 'seen-jobs.json');
  const logPath = path.join(__dirname, 'new-matches.log.tsv');

  const companies = await loadJSON(companiesPath, null);
  if (!companies) {
    console.error('resolved-companies.json not found — run `node resolve-ats.mjs` first.');
    process.exit(1);
  }

  const seen = await loadJSON(seenPath, {});
  const newMatches = [];

  for (const company of companies) {
    if (!company.ats) continue; // unresolved — needs manual ATS lookup
    const fetcher = FETCHERS[company.ats];
    const jobs = await fetcher(company.slug);

    for (const job of jobs) {
      if (!KEYWORDS.test(job.title)) continue;
      if (seen[job.id]) continue;
      newMatches.push({ company: company.name, ...job });
      seen[job.id] = new Date().toISOString();
    }
  }

  if (newMatches.length) {
    console.log(`\n🎯 ${newMatches.length} new matching role(s):\n`);
    for (const m of newMatches) {
      console.log(`- [${m.company}] ${m.title} (${m.location})`);
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
}

main();
