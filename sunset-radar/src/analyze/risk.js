// Risk scoring. Vendors announce hundreds of things a year; almost all of it
// is noise. These signals are the vocabulary vendors actually use when
// something is going to break, weighted by how reliably each word predicts
// real work for the reader.
export const SIGNALS = [
  // Removal / sunset — the expensive ones.
  { id: 'removal', category: 'removal', weight: 30, re: /\b(will be removed|has been removed|we are removing|is being removed|removal of|no longer (?:be )?(?:available|supported|accepted)|discontinu(?:e|ed|ing)|shut(?:ting)? down|shutdown|turn(?:ed|ing)? off|retire(?:d|ment|s)?|sunset(?:ting|s|ted)?|end[- ]of[- ](?:life|support)|EOL\b)/i },
  { id: 'deprecation', category: 'deprecation', weight: 24, re: /\bdeprecat(?:e|ed|ing|ion|ions)\b/i },
  { id: 'breaking', category: 'breaking', weight: 28, re: /\bbreaking[- ]change|\bbreaking\b|\bnot backwards[- ]compatible|\bincompatible\b|\bmajor version\b/i },
  { id: 'required_action', category: 'migration', weight: 22, re: /\b(you (?:must|will need to|need to)|action required|required (?:update|upgrade|migration|action)|customers must|developers must|before this date|to avoid (?:disruption|interruption|downtime|errors))\b/i },
  { id: 'migration', category: 'migration', weight: 14, re: /\b(migrat(?:e|ion|ing)|upgrade guide|migration guide|move to the new|switch to)\b/i },
  { id: 'mandatory', category: 'migration', weight: 16, re: /\b(mandatory|enforced|enforcement|will be enforced|now required|becomes required)\b/i },

  // Auth / security — silent breakage in production.
  { id: 'auth_change', category: 'auth', weight: 20, re: /\b(api key|access token|refresh token|oauth|scopes?|authentication|authorization|credential)s?\b.{0,60}\b(chang|rotat|revok|expir|requir|deprecat|migrat|remov)/i },
  { id: 'tls', category: 'security', weight: 20, re: /\b(TLS ?1\.[0-3]|SSL ?v?[23]|cipher suite|certificate authority|root certificate|SHA-1)\b/i },
  { id: 'security_fix', category: 'security', weight: 18, re: /\b(CVE-\d{4}-\d+|security (?:advisory|vulnerability|fix|patch)|critical vulnerability|remote code execution|privilege escalation)\b/i },
  { id: 'webhook', category: 'breaking', weight: 12, re: /\b(webhook|callback url|event payload|signature verification)\b.{0,60}\b(chang|new format|deprecat|remov|requir)/i },

  // Limits and money.
  { id: 'rate_limit', category: 'rate_limit', weight: 16, re: /\b(rate[- ]limit|quota|throttl(?:e|ing)|requests? per (?:second|minute|day)|concurrency limit|usage cap)\b/i },
  { id: 'pricing', category: 'pricing', weight: 18, re: /\b(pric(?:e|ing) (?:change|update|increase)|new pricing|price increase|billing change|cost (?:increase|change)|per[- ](?:request|token|seat) (?:price|cost)|free tier|paid plan required|now costs)\b/i },

  // Version mechanics.
  { id: 'api_version', category: 'version', weight: 14, re: /\b(api version|version \d{4}-\d{2}-\d{2}|v\d+ (?:api|endpoint)|new api version|version pinning)\b/i },
  { id: 'runtime_eol', category: 'eol', weight: 22, re: /\b(node(?:\.js)? \d+|python 3\.\d+|php \d\.\d|ruby \d\.\d|java \d+)\b.{0,40}\b(end of life|eol|no longer supported|deprecat|drop(?:ped|ping)? support)/i },
  { id: 'drop_support', category: 'eol', weight: 24, re: /\bdrop(?:s|ped|ping)? support\b|\bsupport (?:for|of) .{0,40} (?:ends|ended|will end)\b|\bminimum (?:required )?version\b/i },
  { id: 'schema', category: 'breaking', weight: 12, re: /\b(response (?:shape|format|schema)|field .{0,30}(?:removed|renamed)|new required (?:field|parameter)|parameter .{0,20}(?:removed|renamed|required))\b/i },

  // Dampeners: vendors are loud about harmless things.
  { id: 'no_action', category: 'info', weight: -18, re: /\b(no action (?:is )?(?:required|needed)|nothing (?:to do|changes for you)|fully backwards[- ]compatible|backward[s]?[- ]compatible|opt[- ]in only|does not affect existing)\b/i },
  { id: 'additive', category: 'info', weight: -10, re: /\b(new(?:ly)? (?:added|available)|now supports|we(?:'ve| have) added|introducing|general availability|now in beta|early access|preview)\b/i },
  { id: 'cosmetic', category: 'info', weight: -8, re: /\b(bug ?fix|typo|docs? (?:update|fix)|improved (?:performance|reliability)|ui (?:tweak|update)|minor improvement)\b/i }
];

/**
 * Score one announcement. Title hits count double: vendors put the important
 * word in the headline when they mean it.
 */
export function scoreItem({ title = '', body = '' }) {
  const t = title.slice(0, 500);
  const b = body.slice(0, 12000);
  let score = 0;
  const hits = [];
  const categories = new Set();

  for (const sig of SIGNALS) {
    const inTitle = sig.re.test(t);
    const inBody = sig.re.test(b);
    if (!inTitle && !inBody) continue;
    const weight = inTitle ? sig.weight * 2 : sig.weight;
    score += weight;
    hits.push({ id: sig.id, category: sig.category, weight, where: inTitle ? 'title' : 'body' });
    if (sig.weight > 0) categories.add(sig.category);
  }

  // A release note that only says "v1.2.3" with no signal is not news.
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, signals: hits, categories: [...categories] };
}

const DAY = 86400000;

/**
 * Pull the date a change takes effect out of the prose. Vendors phrase this a
 * dozen ways; we only trust dates that sit next to a deadline word.
 */
export function extractDeadline(text, { now = Date.now() } = {}) {
  const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec';
  const CUE = '(?:on|after|by|from|starting|beginning|effective(?: on)?|as of|until|no later than|before|until at least|deadline of|scheduled for)';
  const patterns = [
    new RegExp(`\\b${CUE}\\s+(\\d{4}-\\d{2}-\\d{2})\\b`, 'gi'),
    new RegExp(`\\b${CUE}\\s+((?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})\\b`, 'gi'),
    new RegExp(`\\b${CUE}\\s+(\\d{1,2}\\s+(?:${MONTHS})\\.?,?\\s+\\d{4})\\b`, 'gi'),
    new RegExp(`\\b((?:${MONTHS})\\.?\\s+\\d{1,2},?\\s+\\d{4})\\b(?=[^.]{0,60}\\b(?:removed|deprecated|disabled|sunset|retired|end of life|no longer)\\b)`, 'gi')
  ];
  const found = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const iso = normalizeDate(m[1]);
      if (iso) found.push(iso);
    }
  }
  if (!found.length) return null;
  // Prefer the soonest date that is still ahead of us; otherwise the latest
  // past one (an already-passed deadline is itself urgent news).
  const future = found.filter((d) => new Date(d).getTime() >= now - 2 * DAY).sort();
  if (future.length) return future[0];
  return found.sort().at(-1);
}

function normalizeDate(raw) {
  const cleaned = String(raw).replace(/(\d)(st|nd|rd|th)/gi, '$1').replace(/\./g, '');
  const d = new Date(cleaned + (/^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? 'T00:00:00Z' : ' 00:00:00 UTC'));
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return d.toISOString();
}

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];
const lower = (a, b) => (severityRank(a) > severityRank(b) ? b : a);
export const severityRank = (s) => Math.max(0, SEVERITIES.indexOf(s));

/**
 * Final severity blends three things: how breaking the announcement sounds,
 * whether it touches code this project actually has, and how soon the clock
 * runs out. Impact is what turns vendor noise into "this is yours".
 */
export function severityFor({ score, matchedFiles = 0, deadlineAt = null, now = Date.now() }) {
  let total = score;
  if (matchedFiles > 0) total += 25 + Math.min(matchedFiles, 10);
  if (deadlineAt) {
    const days = (new Date(deadlineAt).getTime() - now) / DAY;
    if (days < 0) total += matchedFiles > 0 ? 30 : 5;      // already past due
    else if (days <= 30) total += 25;
    else if (days <= 90) total += 15;
    else if (days <= 180) total += 8;
  }
  total = Math.max(0, Math.min(140, Math.round(total)));
  let severity =
    total >= 95 ? 'critical' :
    total >= 70 ? 'high' :
    total >= 40 ? 'medium' :
    total >= 20 ? 'low' : 'info';

  // Critical means "stop what you are doing". Reserve it for changes we can
  // tie to this codebase, or whose clock runs out within six weeks. Without
  // one of those it is still important, but it is not an emergency.
  const daysLeft = deadlineAt ? (new Date(deadlineAt).getTime() - now) / DAY : Infinity;
  if (severity === 'critical' && matchedFiles === 0 && daysLeft > 45) severity = 'high';

  // A deadline that passed months ago and still matches nothing in the code is
  // history, not news: the pin it would have hit is not there.
  if (matchedFiles === 0 && daysLeft < -60) severity = lower(severity, 'low');

  // Urgency decays with distance. Version lifecycle feeds publish every future
  // cycle at once, so without this a single vendor floods the list with dates
  // three and four years out. Only a stated deadline decays: "no date given"
  // means it could land any time, which is not the same as far away.
  if (deadlineAt) {
    if (daysLeft > 730) severity = lower(severity, matchedFiles ? 'low' : 'info');
    else if (daysLeft > 365) severity = lower(severity, matchedFiles ? 'medium' : 'low');
  }

  return { severity, total };
}
