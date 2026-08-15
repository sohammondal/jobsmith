Dear Acme Example Co Hiring Team,

I'm applying for the Platform Engineer role. I've spent the last few years
owning the shared backend services other engineers build on top of, which
is exactly the scope this role describes.

At Acme Corp, our nightly reconciliation job was a 4-hour cron batch that
paged on-call at 2am when it ran long — the constraint was that
reconciliation had to stay incremental, not batch, without losing
correctness guarantees. I rewrote it as an event-driven pipeline; that cut
end-of-day reconciliation time to 20 minutes and stopped being an on-call
liability.

I also inherited an on-call rotation averaging 12 pages a week with maybe
2 real incidents. The problem wasn't alert volume, it was signal-to-noise:
I tightened thresholds and removed redundant checks, cutting weekly pages
by roughly 70%. Both of these are the kind of platform-reliability work
your posting calls out directly — cutting alert noise, migrating brittle
batch jobs to something more resilient.

I'd welcome the chance to talk about the ledger and job-queue platform
and where I could contribute.

Best,
Jane Doe
