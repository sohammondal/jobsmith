# Prepare application (from an automated match)

Turn a jobsmith match found by the automated scanners (`scan.mjs` /
`scan-custom.mjs` / the MCP tools — Greenhouse, Lever, Ashby, or Firecrawl
sources) into a local `applications/{company}-{title-slug}/` folder with the
full posting saved, ready for CV/cover-letter generation. Ask your AI
assistant (Claude Code, OpenCode, whatever) to follow this workflow, pointing
it at a specific match (by company+title, or a `new-matches.log.tsv` line).
Tool-agnostic: only assumes the assistant can read/write files, run shell
commands, and fetch a URL.

`new-matches.log.tsv` only holds title/location/url for these sources —
enough to notice a role, not enough to tailor a CV/cover letter against. This
workflow fetches the full description and materializes the folder that
CV/cover-letter generation reads from.

If you're manually pasting a posting from a site jobsmith can't scan (e.g.
LinkedIn), use `workflows/manual-match.md` instead — it does this in one pass
since you already have the full text and don't need a fetch step.

## Input

company, title, url, location, and `source`
(`greenhouse`|`lever`|`ashby`|`firecrawl` — inferred from the id prefix in
`seen-jobs.json` if not given directly).

## Steps

1. Slugify: `{company}-{title}` → lowercase, non-alphanumeric runs collapsed
   to single hyphens, trimmed (e.g. "Polarsteps" / "Senior Frontend
   Engineer" → `polarsteps-senior-frontend-engineer`). If
   `applications/{slug}/` already exists, tell the user and ask whether to
   reuse it or suffix with today's date instead of silently overwriting.
2. Create `applications/{slug}/`.
3. Get the full posting text and save it as `applications/{slug}/posting.md`
   (cleaned to markdown, not paraphrased):
   - `greenhouse`: prefer the job's own API record
     (`https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{jobId}`) — its
     `content` field has the full HTML description, more reliable than
     fetching the rendered page.
   - `lever`/`ashby`/`firecrawl`: fetch the posting `url` directly and pull
     the full description content.

   **Careful with generic web-fetch tools** (e.g. Claude Code's `WebFetch`)
   — many run the page through a small summarizing model before returning
   it, which paraphrases the description instead of returning it verbatim.
   Prefer the board's own JSON API when one exists (Greenhouse/Lever/Ashby
   all have public ones — see `scan.mjs` for the URL shapes) and read the
   raw HTML `content`/`descriptionHtml` field directly, converting it to
   markdown yourself. Verify: skim the output against the live page before
   saving — if it reads like a summary rather than the actual posting text,
   it's wrong.
4. Write `applications/{slug}/status.json`:
   ```json
   {
     "id": "<the seen-jobs.json dedup id for this match, if it has one>",
     "company": "...",
     "title": "...",
     "location": "...",
     "url": "...",
     "source": "greenhouse|lever|ashby|firecrawl|manual",
     "foundAt": "<ISO timestamp — from seen-jobs.json if present, else now>",
     "status": "found",
     "statusUpdatedAt": "<ISO timestamp, now>"
   }
   ```
5. Confirm to the user: folder created, posting saved, ready for CV/cover
   letter generation once that step exists.

## Status values

`found` → `cv_drafted` → `cover_letter_drafted` → `applied` → (`interview` |
`rejected` | `ghosted`). Later steps (CV/CL generation, "mark as applied")
should update `status` and `statusUpdatedAt` in place rather than
duplicating the record.
