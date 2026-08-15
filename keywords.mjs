// Shared title-match filter for scan.mjs, scan-custom.mjs, scan-hn-jobs.mjs,
// and mcp-server.mjs.
//
// Edit KEYWORD_LIST to describe your own job search — plain words/phrases,
// no regex needed. Add every spelling/variant you care about as its own
// entry (e.g. both "frontend" and "front-end" if you want both to match).
// Case-insensitive, matched against job titles only — not the full
// description, deliberately, since full-description keyword matching gets
// noisy fast (see README's "Tuning matches" section).
export const KEYWORD_LIST = [
  'software engineer',
  'backend',
  'back-end',
  'frontend',
  'front-end',
  'front end',
  'full stack',
  'full-stack',
  'fullstack',
  'devops',
];

// Turns KEYWORD_LIST into the regex the scanners actually use — you
// shouldn't need to touch this function, just the list above. Each keyword
// gets wrapped in its own word-boundary so short entries can't match
// mid-word (e.g. 'react' won't match inside "Reactive").
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildKeywordRegex(keywords) {
  const pattern = keywords.map((kw) => `\\b${escapeRegex(kw.trim())}\\b`).join('|');
  return new RegExp(pattern, 'i');
}

export const KEYWORDS = buildKeywordRegex(KEYWORD_LIST);
