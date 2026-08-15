#!/usr/bin/env node
// resolve-ats.mjs
//
// For each company in companies.json, tries a handful of likely slugs against
// the three major public ATS job-board APIs (Greenhouse, Lever, Ashby) and
// records which one (if any) responds with real job data.
//
// Why this exists: guessing a company's ATS slug from web search is
// unreliable (slugs collide across unrelated companies with the same name).
// Querying the actual APIs directly is cheap, fast, and definitive.
//
// Run: node resolve-ats.mjs
// Requires: Node 18+ (uses global fetch)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugCandidates(company) {
  const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = company.name;
  const domainRoot = company.domain?.split('.')[0] ?? '';
  const variants = new Set([
    clean(name),
    clean(domainRoot),
    name.toLowerCase().replace(/\s+/g, '-'),
  ]);
  return [...variants].filter(Boolean);
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

async function tryGreenhouse(slug) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  const data = await safeFetchJson(url);
  if (!data?.jobs?.length) return null;
  return {
    ats: 'greenhouse',
    slug,
    sample: data.jobs.slice(0, 2).map((j) => `${j.title} — ${j.location?.name ?? '?'}`),
  };
}

async function tryLever(slug) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const data = await safeFetchJson(url);
  if (!Array.isArray(data) || !data.length) return null;
  return {
    ats: 'lever',
    slug,
    sample: data.slice(0, 2).map((j) => `${j.text} — ${j.categories?.location ?? '?'}`),
  };
}

async function tryAshby(slug) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  const data = await safeFetchJson(url);
  if (!data?.jobs?.length) return null;
  return {
    ats: 'ashby',
    slug,
    sample: data.jobs.slice(0, 2).map((j) => `${j.title} — ${j.location ?? '?'}`),
  };
}

async function resolveCompany(company) {
  for (const slug of slugCandidates(company)) {
    const hit =
      (await tryGreenhouse(slug)) ||
      (await tryLever(slug)) ||
      (await tryAshby(slug));
    if (hit) return hit;
    await sleep(150); // be polite between guesses
  }
  return null;
}

async function main() {
  const companies = JSON.parse(
    await fs.readFile(path.join(__dirname, 'companies.json'), 'utf-8')
  );

  const results = [];
  for (const company of companies) {
    const hit = await resolveCompany(company);
    if (hit) {
      console.log(`✅ ${company.name} → ${hit.ats}/${hit.slug}`);
      console.log(`   sample: ${hit.sample.join('  |  ')}`);
      results.push({ ...company, ats: hit.ats, slug: hit.slug });
    } else {
      console.log(`❌ ${company.name} — no Greenhouse/Lever/Ashby match (likely custom ATS — check careers page manually)`);
      results.push({ ...company, ats: null, slug: null });
    }
  }

  const outPath = path.join(__dirname, 'resolved-companies.json');
  await fs.writeFile(outPath, JSON.stringify(results, null, 2));

  const resolvedCount = results.filter((r) => r.ats).length;
  console.log(`\nResolved ${resolvedCount}/${companies.length} companies → resolved-companies.json`);
  console.log('⚠️  Sanity-check each match: slugs are a global namespace, so confirm the sample');
  console.log('   locations actually look like this company (e.g. mentions NL/Amsterdam) before trusting it.');
}

main();
