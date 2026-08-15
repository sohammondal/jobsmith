---
name: generate-application
description: Generate a tailored cv.md and cover-letter.md (and render both to PDF) for a prepared applications/{slug}/ folder, grounded in the user's real work history and voice. Use when the user asks to draft, write, or update a CV/cover letter/resume for a specific application, or to re-render an application's PDFs.
---

Follow `workflows/generate-application.md` at the root of this repo,
exactly as written. That file is the actual procedure — tool-agnostic on
purpose, so it also works from OpenCode or any other AI CLI — this
SKILL.md just makes it auto-invocable from Claude Code.

Read `workflows/generate-application.md` in full before doing anything,
including its "What not to do" section. It requires reading
`profile/cv-template.md`, `profile/resume.md`, and `profile/work-log.md` —
gitignored personal files that must already exist locally (copied and
filled in from the `.example.md` versions — see `profile/README.md`); if
`profile/` is missing, stop and tell the user rather than reconstructing
or guessing at its content.

The target `applications/{slug}/` folder must already exist (created by the
`prepare-application` or `manual-match` skill) with `posting.md` and
`status.json` in it.
