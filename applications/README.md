# applications/

One folder per job you're actively pursuing, created by
`workflows/prepare-application.md` (scanner-sourced matches) or
`workflows/manual-match.md` (pasted postings from sites jobsmith can't
scan):

```
applications/{company}-{title-slug}/
  posting.md         — full job description (fetched or pasted, verbatim)
  status.json        — company/title/location/url/source + status tracking
  cv.md              — tailored CV (workflows/generate-application.md)
  cover-letter.md    — tailored cover letter (workflows/generate-application.md)
```

Some folders also accumulate an ad hoc `screening-questions.md` (application
form Q&A worth keeping alongside the posting) — not required, just common.

This is the handoff point between discovery (`new-matches.log.tsv`, which
only has title/location/url) and application prep, which needs the full
posting text plus the personal source material in `profile/` (also
gitignored — see `profile/README.md`).

Every other folder here is gitignored (`applications/*/`) — it's personal
application content, kept local-only like `profile/`.

Status flow: `found` → `cv_drafted` → `cover_letter_drafted` → `applied` →
(`interview` | `rejected` | `ghosted`).

## Worked example

`applications/example-acme-platform-engineer/` is tracked in git (a
`.gitignore` exception carved out for this one folder) and shows a fully
completed application — synthetic posting, `status.json`, `cv.md`,
`cover-letter.md`, and the rendered PDFs — using the same `Jane Doe`
example profile from `profile/*.example.md`. It exists purely as a
reference for what a finished folder looks like and how much a CV
template typically gets trimmed for one posting; it's not something to
edit or submit anywhere.
