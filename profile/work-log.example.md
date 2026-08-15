# Work log — CV source material

Generated from your own notes, chat transcripts, or git history — whatever
source you use to track recent work in enough detail to ground specific CV
bullets and cover-letter claims. See `profile/README.md` for a hint on
using an AI assistant to help produce Sections 2 and 3 from your git log.

- **Range:** 2026-01 → 2026-06
- **How to use:** Section 1 = voice for cover letters (write by hand);
  Section 2 = theme index (skim to find a relevant cluster); Section 3 =
  every entry's detail (pull the specific quote/example you need)

---

# Voice, personality & cover-letter signals

## How I sound (tone)

- **Direct and specific** — names the actual problem, not a vague virtue.
  *"This endpoint was doing 5 DB round-trips for one read — flattened it
  to one."*
- Confident about real wins, plain about real constraints — no false
  modesty, no overselling.

## Words / patterns to USE

- Short, direct first person: *"I investigated…"*, *"I owned…"*
- Concrete nouns over abstractions: "the reconciliation job," not "the
  process."

## Words / patterns to AVOID

- Corporate sludge: *"synergize"*, *"leverage"*, *"utilize"*
- Empty superlatives: *"world-class"*, *"best-in-class"*
- Tool/agent residue: don't name the AI assistant or chat tooling used to
  produce this log — that's process, not a claim about your work.

## Cover letter voice recipe (for downstream AI)

> Write in first person, short sentences, informal but precise. Structure
> every claim as: problem → constraint → decision → outcome. Prefer one
> concrete example over three vague virtues. Name the tradeoff where
> relevant — that's what makes it sound like an engineer, not a template.

---

# Theme index (for CV bullets)

## Backend reliability (2 entries)
- Reconciliation pipeline rewrite (2026-01)
- On-call rotation redesign (2026-02)

## API performance (1 entry)
- p95 latency work on the admin dashboard (2026-03)

---

# Full log (chronological)

## 2026-01

### Reconciliation pipeline rewrite
Intent: replace the nightly cron batch job with an event-driven pipeline
so reconciliation lag stops paging on-call at 2am.
Quote: *"This 4-hour job is the reason our on-call gets paged at 2am —
let's make it incremental instead of batch."*
Outcome: end-of-day reconciliation time dropped from 4 hours to 20
minutes.

## 2026-02

### On-call rotation redesign
Intent: cut alert noise so real incidents don't get missed among false
positives.
Quote: *"We were averaging 12 pages a week and maybe 2 were real — that's
how you get alert fatigue."*
Outcome: reduced weekly page volume by roughly 70% by tightening alert
thresholds and removing redundant checks.

## 2026-03

### Admin dashboard p95 latency
Intent: the three hottest endpoints on the internal admin dashboard were
dominating p95 latency complaints from support staff.
Quote: *"Support was refreshing this page 40 times a day — a 40%
improvement here is a 40% improvement to their actual workday."*
Outcome: added targeted caching, cut p95 latency by 40% on those
endpoints.
