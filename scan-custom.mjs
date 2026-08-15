#!/usr/bin/env node
// scan-custom.mjs
//
// Companion to scan.mjs for companies whose careers page isn't backed by
// Greenhouse/Lever/Ashby (ats: null — usually larger companies running a
// custom or enterprise ATS). Reads companies.json entries that have a
// `careerPageUrl`, pulls structured job data via Firecrawl's Extract
// endpoint (firecrawl-adapter.mjs, one Extract call per company per run),
// filters titles against the same KEYWORDS pattern scan.mjs uses, diffs
// against the shared seen-jobs.json (distinct "firecrawl:" key prefix so
// it can't collide with the greenhouse/lever/ashby entries scan.mjs
// writes), and logs new matches.
//
// Run manually: FIRECRAWL_API_KEY=fc-... node scan-custom.mjs
// Run on a schedule: add to cron alongside scan.mjs, e.g.
//   0 8 * * * cd /path/to/jobsmith && FIRECRAWL_API_KEY=fc-... /usr/bin/node scan-custom.mjs >> scan.log 2>&1
//
// Requires: Node 18+ (uses global fetch), a free Firecrawl API key (firecrawl.dev)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

async function main() {
  const apiKey = requireApiKey(); // fails loudly here if FIRECRAWL_API_KEY is unset

  const companiesPath = path.join(__dirname, 'companies.json');
  const seenPath = path.join(__dirname, 'seen-jobs.json');
  const logPath = path.join(__dirname, 'new-matches.log.tsv');

  const companies = await loadJSON(companiesPath, []);
  const targets = companies.filter((c) => c.careerPageUrl);
  if (!targets.length) {
    console.log('No companies with a careerPageUrl in companies.json — nothing to scan.');
    return;
  }

  const seen = await loadJSON(seenPath, {});
  const newMatches = [];

  for (const company of targets) {
    let jobs;
    try {
      jobs = await extractCompanyJobs(company, apiKey);
      console.log(`✅ ${company.name} — ${jobs.length} posting(s) via Firecrawl`);
    } catch (err) {
      console.error(`⚠️  ${company.name}: ${err.message}`);
      continue;
    }

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

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
