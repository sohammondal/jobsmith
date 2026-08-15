# Generate application (CV + cover letter)

Turns a prepared `applications/{company}-{title-slug}/` folder (created by
`workflows/prepare-application.md` or `workflows/manual-match.md`, so it
already has `posting.md` and `status.json`) into a tailored `cv.md` and
`cover-letter.md`, grounded in real work history and written in the user's
actual voice — not generic AI resume-speak. Ask your AI assistant (Claude
Code, OpenCode, whatever) to run this against a specific application folder.
Tool-agnostic: only assumes the assistant can read/write files in this repo.

## Inputs

- `applications/{slug}/posting.md` — the target job description
- `applications/{slug}/status.json` — company/title/location for that job
- `profile/cv-template.md` — the drafting base for `cv.md`. Comprehensive
  (every role, every bullet, Summary/Projects/Education/Languages sections)
  and already in the render-ready markup `templates/cv.css` expects — start
  here, don't reconstruct the format from scratch or copy `resume.md`'s
  plain-prose formatting.
- `profile/resume.md` — same content as `cv-template.md` in plain prose.
  The authoritative source for career history, especially roles further
  back or less-detailed elsewhere in `profile/`.
- `profile/work-log.md` — granular, evidence-backed log of recent work,
  usually your current or most recent role. **Section 1 is the voice/tone
  spec — read it in full and follow it exactly for the cover letter.**
  Section 2 is a theme index to find relevant clusters fast; Section 3 has
  the full detail and direct quotes to ground specific claims.

If `profile/` doesn't exist, stop and tell the user — it's gitignored
personal material, not something to reconstruct or guess at (see
`profile/README.md` for how to set it up).

## Steps

1. **Read the posting.** Pull out the actual requirements: must-have skills,
   nice-to-haves, seniority signals, domain, and anything the posting
   emphasizes repeatedly (that's usually what they screen for first).

2. **Match against the profile.** For each requirement, find grounding
   evidence:
   - Broader career history, or roles/periods `work-log.md` doesn't cover
     in detail → `profile/resume.md`
   - Recent, specific work → `profile/work-log.md` Section 2 (find the
     relevant theme cluster) → Section 3 (pull the specific entry's
     intent + any quoted voice notes for concrete detail)
   Prefer one concrete, specific example per claim over three vague
   virtues. Never invent a metric, title, or bullet that isn't grounded in
   one of these two files — if the posting wants something with no real
   backing in the profile, leave it out rather than fabricate it.

3. **Draft `applications/{slug}/cv.md`, starting from
   `profile/cv-template.md`** (copy it, then edit — don't rebuild the
   markup from scratch, don't invent facts, but do cut hard). Target
   **1–2 pages, less is better**:
   - **Summary** — this is the one section that must be rewritten, not
     just trimmed. Replace the template's default 2–3 sentences with ones
     angled at what this specific posting asks for. A Summary that reads
     the same across applications is a failure of this step. Delete the
     template's italic instruction-note underneath it.
   - **Work Experience** — reorder/re-emphasize bullets so the most
     relevant ones (per step 2) lead; where `work-log.md` has a sharper,
     more specific example than the template's existing bullet for the
     same area, swap it in — one line, not a chat summary. Cut
     bullets/roles that don't support this posting rather than reordering
     everything in — condense older/less-relevant roles into one "Earlier
     Experience" line if space is tight.
   - **Skills** — trim to what's relevant to this posting, but keep skills
     that are true daily-driver facts even off-topic for this posting —
     don't add anything the profile doesn't actually support just because
     the posting mentions the term.
   - **Individual Projects & Blogs** — keep by default. If space is
     genuinely tight, this is the *second* thing to compress (down to the
     1–2 strongest links) or cut — after trimming Work Experience, not
     before. It's the only place a reader sees actual shipped code/writing
     without leaving the CV.
   - **Education / Languages & Interests** — keep as-is unless the posting's
     region has a different convention (e.g. US resumes typically drop the
     personal-interests line; EU CVs often keep it).

   Look at an existing `applications/*/cv.md` for a worked example of how
   much a template typically gets cut down for one posting, once you have
   one.

4. **Draft `applications/{slug}/cover-letter.md`**, following
   `profile/work-log.md` Section 1 exactly:
   - Voice: short, first-person, informal but precise; no corporate fluff,
     no fake humility, no adjective piles
   - Structure every real claim as **problem → constraint → decision →
     outcome**, using the specific examples pulled in step 2
   - Name the tradeoff where relevant (that's what makes it sound like an
     engineer, not a template)
   - Use the "words to use" list, avoid everything in "words to avoid"
     (corporate sludge, LinkedIn theater, empty superlatives, softener
     stacks, buzzword architecture, agent/tool-name residue)
   - Tie it explicitly to what this specific posting is asking for — a
     cover letter that could be sent to any company is a failure of this
     step
   - Length: tight. This is a cover letter, not the work log — one page,
     3–4 short paragraphs max.

5. **Update `applications/{slug}/status.json`**: set `status` to
   `"cv_drafted"` once `cv.md` is written, then `"cover_letter_drafted"`
   once `cover-letter.md` is written, updating `statusUpdatedAt` each time.

6. **Render both to PDF** via the shared script (also exposed as the
   `render_pdfs` MCP tool):
   ```bash
   node render-pdfs.mjs {slug}
   ```
   This runs `md-to-pdf` against both files using `templates/cv.config.json`
   / `templates/cover-letter.config.json` (stylesheet + explicit tight PDF
   page margins — installs `md-to-pdf` on first use via `npx`, then fully
   offline, no upload). Output is ATS-friendly: real text layer, single
   column, no images.

   Check the CV fits 1–2 pages — `mdls -name kMDItemNumberOfPages
   applications/{slug}/cv.pdf` on macOS, or open it. If it overflows past
   that, tighten `templates/cv.css` spacing (it's shared across all
   applications, so tweaks there benefit every future one) before cutting
   more content; if it's noticeably under 1 page, spacing can be loosened
   for readability instead — 1–2 pages is the target, not "as short as
   possible."

7. **Hand both drafts back to the user for review.** Don't submit or send
   anything — this step produces drafts, applying stays human-in-the-loop
   (see main README's "What this deliberately doesn't do"). Flag anything
   in step 2 where the posting wanted evidence the profile didn't have, so
   the user knows what's a genuine gap vs. what you chose not to fabricate.

## What not to do

- Don't write a cover letter that reads like it was written by an AI about
  someone else's career — every claim needs to trace back to
  `profile/cv-template.md`, `profile/resume.md`, or `profile/work-log.md`.
- Don't leave the Summary section's default template wording (or its
  italic instruction-note) in a sent CV — it must be rewritten per
  application, not just carried over.
- Don't reuse the same cover letter across postings — regenerate per
  application so it's actually tailored.
- Don't mention Cursor, Claude, chat IDs, or any tooling residue from how
  the source material was generated — that's explicitly called out as
  "agent/chat residue" to avoid in the voice guide.
