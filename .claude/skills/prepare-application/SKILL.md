---
name: prepare-application
description: Turn a jobsmith match found by the automated scanners (Greenhouse, Lever, Ashby, Firecrawl, or Hacker News Jobs) into a local applications/{slug}/ folder with the full posting saved, ready for CV/cover-letter generation. Use when the user points at a match from new-matches.log.tsv, seen-jobs.json, or an MCP scan result and asks to prepare/pull/fetch the posting.
---

Follow `workflows/prepare-application.md` at the root of this repo, exactly
as written. That file is the actual procedure — tool-agnostic on purpose, so
it also works from OpenCode or any other AI CLI — this SKILL.md just makes
it auto-invocable from Claude Code.

Read `workflows/prepare-application.md` in full before doing anything. Pay
particular attention to its warning about generic web-fetch tools
paraphrasing job descriptions instead of returning them verbatim — prefer
each board's raw JSON API.

If the user is instead pasting a full posting by hand (LinkedIn, or
anything with no API), use the `manual-match` skill instead.
