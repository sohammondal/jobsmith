# profile/

Your personal source material for CV/cover-letter generation. The three
`.example.md` files here are tracked in git and show the exact structure
`workflows/generate-application.md` expects — copy each to its real
filename and fill in your own information. The real filenames are
gitignored (see repo `.gitignore`) so your personal data never gets
committed, even though this repo may have a public `origin` configured.

```bash
cp profile/cv-template.example.md profile/cv-template.md
cp profile/resume.example.md profile/resume.md
cp profile/work-log.example.md profile/work-log.md
```

Then edit each with your own details. Some hints for filling them in with
AI assistance (see the README's Getting Started section for the full
version):

- **`resume.md`** and **`cv-template.md`**: paste your existing
  resume/CV text (exported from Google Docs, Word, LinkedIn, wherever) to
  your AI assistant and ask it to reformat into each file following the
  structure already shown in `resume.example.md`/`cv-template.example.md`.
- **`work-log.md`**: the highest-leverage one to get AI help with. Point
  your AI coding assistant at your recent repos (`git log --author=you
  --stat`, or just open a repo) and ask it to summarize notable technical
  work into Sections 2 and 3 of this file. **Section 1 (voice/tone) should
  be written or edited by hand** — it's about sounding like you, which an
  AI can't infer from commit history alone.

## What each file is

- **`cv-template.md`** — the constant, comprehensive CV: every role, every
  bullet, plus Summary / Individual Projects & Blogs / Education /
  Languages & Interests, in the render-ready markup `templates/cv.css`
  expects. This is the drafting base every `applications/{slug}/cv.md`
  starts from and trims down.
- **`resume.md`** — same content as `cv-template.md`, in plain prose. Full
  career history, skills, projects, education — the authoritative source
  for anything `work-log.md`'s more recent window doesn't cover.
- **`work-log.md`** — granular, evidence-backed log of your most recent
  role(s). Section 1 is a cover-letter voice/tone spec (do/don't word
  lists, a "problem → constraint → decision → outcome" structure recipe);
  Section 2 is a theme index of high-signal work clusters; Section 3 is
  the full chronological log with per-entry intent and direct quotes,
  useful for grounding specific bullets in real examples. Keep it as
  short or long as you like — the 3-section structure is what
  `workflows/generate-application.md` relies on, not the length.

Used by `workflows/generate-application.md`.
