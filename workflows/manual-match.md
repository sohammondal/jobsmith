# Manual job match

For any posting you find on a site jobsmith doesn't/can't scan automatically
(LinkedIn, a company career page behind a login, a job board with no API,
etc.) — paste the full posting text plus its URL to your AI assistant
(Claude Code, OpenCode, whatever) and ask it to follow this workflow.
Tool-agnostic: only assumes the assistant can read/write files in this repo
and run shell commands.

Since you're pasting the full description yourself, this workflow does both
the logging step (`scan.mjs` does automatically for ATS sources) and the
folder-prep step (`workflows/prepare-application.md` does for ATS sources) in
one pass — no separate fetch needed, you already have the text.

## What to extract from the paste

- `company` — the hiring company's name
- `title` — the job title
- `location` — city/remote info if present, else empty string
- `url` — required (dedup key + clickable reference)
- the full description text itself

If a field is ambiguous or missing and can't be reasonably inferred, ask
before guessing.

## Steps

1. Read `seen-jobs.json` and `new-matches.log.tsv` in the project root.
2. Compute the dedup id: `manual:{company}:{first 12 hex chars of
   sha1(url)}` — same scheme as `firecrawl:{company}:{hash}` in
   `firecrawl-adapter.mjs`, with a source-neutral `manual:` prefix so it
   can't collide with the greenhouse/lever/ashby/firecrawl keys already in
   `seen-jobs.json`:

   ```bash
   node -e "console.log(require('crypto').createHash('sha1').update(process.argv[1]).digest('hex').slice(0,12))" "<url>"
   ```

3. If that id already exists in `seen-jobs.json`, tell the user it's a
   duplicate and stop — don't touch either file or the applications folder.
4. Otherwise:
   - Append one line to `new-matches.log.tsv`:
     `{ISO timestamp}\t{company}\t{title}\t{location}\t{url}`
   - Add `"{id}": "{ISO timestamp}"` to `seen-jobs.json`, written back with
     `JSON.stringify(seen, null, 2)`.
   - Slugify `{company}-{title}` the same way
     `workflows/prepare-application.md` does, create
     `applications/{slug}/`, and write:
     - `posting.md` — the pasted description, lightly cleaned to markdown
       (strip nav/boilerplate), not paraphrased or summarized
     - `status.json` (see schema in `workflows/prepare-application.md`),
       with `"source": "manual"` and `"status": "found"`
5. Confirm to the user what was logged and that the application folder is
   ready for CV/cover-letter generation.

## Optional sanity check

Test the title against `KEYWORD_LIST` in `keywords.mjs` and mention if it
doesn't match any entry — a heads-up only, not a blocker, since you're
manually curating.
