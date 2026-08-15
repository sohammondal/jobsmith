#!/usr/bin/env node
// render-pdfs.mjs
//
// Renders an applications/{slug}/ folder's cv.md and cover-letter.md to
// ATS-friendly PDFs (real text layer, single column, no images) via
// md-to-pdf, using the shared styling/margins pinned in
// templates/*.config.json. Run this after workflows/generate-application.md
// drafts the markdown, or any time after hand-editing cv.md/cover-letter.md.
//
// Callable standalone:
//   node render-pdfs.mjs <slug>
//   e.g. node render-pdfs.mjs polarsteps-senior-frontend-engineer
//
// Also imported by mcp-server.mjs as the render_pdfs tool.
//
// Requires: `md-to-pdf` resolvable via npx (installs once, then runs fully
// offline — no upload, no external API call per render).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGETS = [
  { file: 'cv.md', config: 'templates/cv.config.json' },
  { file: 'cover-letter.md', config: 'templates/cover-letter.config.json' },
];

export function renderPdfs(slug) {
  const dir = path.join(__dirname, 'applications', slug);
  if (!fs.existsSync(dir)) {
    throw new Error(`No such application folder: applications/${slug}`);
  }

  return TARGETS.map(({ file, config }) => {
    const mdPath = path.join(dir, file);
    if (!fs.existsSync(mdPath)) {
      return { file, status: 'skipped', reason: 'not found' };
    }
    try {
      execFileSync(
        'npx',
        ['md-to-pdf', mdPath, '--config-file', path.join(__dirname, config)],
        { cwd: __dirname, stdio: 'pipe' }
      );
      return { file, status: 'rendered', pdf: mdPath.replace(/\.md$/, '.pdf') };
    } catch (err) {
      return { file, status: 'error', reason: err.message };
    }
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node render-pdfs.mjs <applications-slug>');
    process.exit(1);
  }
  try {
    for (const r of renderPdfs(slug)) {
      if (r.status === 'rendered') console.log(`✅ ${r.pdf}`);
      else if (r.status === 'skipped') console.log(`⏭️  ${r.file} — ${r.reason}`);
      else console.error(`❌ ${r.file} — ${r.reason}`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
