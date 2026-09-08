// Changelog pages that publish no feed still need watching — most vendor
// changelogs are exactly that. We split the page on headings and treat each
// heading + following prose as one dated entry.
import { stripTags, decodeEntities, makeItem, parseDate } from './feed.js';

const HEADING_RE = /<h([2-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const ANCHOR_ID_RE = /\bid\s*=\s*["']([^"']+)["']/i;

// Dates as they appear in changelog headings and prose.
const DATE_PATTERNS = [
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i
];

export function findDate(text) {
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const iso = parseDate(m[0].replace(/(\d)(st|nd|rd|th)/gi, '$1'));
      if (iso) return iso;
    }
  }
  return null;
}

export function extractMainHtml(html) {
  // Strip chrome so navigation links don't become "entries".
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ');
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  return main ? main[1] : body;
}

const MONTH_ONLY = /^(?:january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|20\d\d)[\s,\d-]*$/i;
const NAV_HEADING = /^(?:on this page|table of contents|contents|in this article|related|see also|feedback|was this (?:page )?helpful|search|menu|navigation|overview|introduction|getting started|resources|community|support|documentation|changelog|release notes|archive|older|previous|next|more)$/i;

// Changelog pages are full of headings that are not entries: month dividers,
// "On this page", section labels. Ingesting them produces confident nonsense.
export function isUsefulHeading(title) {
  if (!title) return false;
  const t = title.trim();
  if (t.length < 8 || t.length > 300) return false;
  if (MONTH_ONLY.test(t)) return false;
  if (NAV_HEADING.test(t)) return false;
  if (!/[a-z]{3}/i.test(t)) return false;
  if (t.split(/\s+/).length < 2) return false;
  return true;
}

export function parseChangelogHtml(html, { sourceUrl = '', maxItems = 60 } = {}) {
  const main = extractMainHtml(html || '');
  const headings = [...main.matchAll(HEADING_RE)];
  const items = [];

  if (headings.length >= 2) {
    for (let i = 0; i < headings.length && items.length < maxItems; i++) {
      const h = headings[i];
      const title = stripTags(h[3]).replace(/[\u200b\u200e\u00a0]/g, '').trim();
      if (!isUsefulHeading(title)) continue;
      const start = h.index + h[0].length;
      const end = i + 1 < headings.length ? headings[i + 1].index : Math.min(main.length, start + 8000);
      const body = stripTags(main.slice(start, end)).slice(0, 6000);
      const anchorMatch = h[2].match(ANCHOR_ID_RE);
      const anchor = anchorMatch ? `#${anchorMatch[1]}` : '';
      // A heading with nothing under it is a section divider, not an entry.
      if (body.replace(/\s+/g, ' ').trim().length < 60) continue;
      const published = findDate(title) || findDate(body.slice(0, 400));
      items.push(makeItem({ title, url: sourceUrl + anchor, guid: `${title}|${published || ''}`, published, body }));
    }
  }

  if (items.length === 0) {
    // No usable headings: treat the whole page as one entry so a change in it
    // is still detectable via the content hash.
    const text = stripTags(main).slice(0, 8000);
    const title = decodeEntities((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || sourceUrl).trim());
    if (text.length > 80) items.push(makeItem({ title, url: sourceUrl, guid: sourceUrl, published: findDate(text.slice(0, 400)), body: text }));
  }
  return items;
}

// endoflife.date returns an array of release cycles. Each cycle with a real
// EOL or support date becomes a dated, deadline-bearing item — the cleanest
// deprecation signal on the internet.
export function parseEolJson(text, { productName = '', sourceUrl = '' } = {}) {
  let cycles;
  try { cycles = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(cycles)) cycles = cycles?.result?.releases || cycles?.releases || [];
  if (!Array.isArray(cycles)) return [];
  const now = Date.now();
  const items = [];
  for (const c of cycles.slice(0, 40)) {
    const cycle = String(c.cycle ?? c.name ?? '').trim();
    if (!cycle) continue;
    const eol = typeof c.eol === 'string' ? c.eol : (typeof c.eolFrom === 'string' ? c.eolFrom : null);
    const support = typeof c.support === 'string' ? c.support : (typeof c.supportedUntil === 'string' ? c.supportedUntil : null);
    if (!eol && !support) continue;
    const eolIso = eol ? parseDate(eol) : null;
    const supIso = support ? parseDate(support) : null;
    const deadline = eolIso || supIso;
    if (!deadline) continue;
    // Keep long-dead cycles too: a repo still pinned to one of them is exactly
    // the finding worth raising. Anything older than ~5 years is noise.
    if (new Date(deadline).getTime() < now - 1900 * 86400000) continue;
    const past = new Date(deadline).getTime() < now;
    const title = `${productName} ${cycle} ${past ? 'is past end of life' : 'reaches end of life'} on ${deadline.slice(0, 10)}`;
    const body = [
      `${productName} release cycle ${cycle}.`,
      eolIso ? `End of life: ${eolIso.slice(0, 10)}.` : '',
      supIso ? `Active support ends: ${supIso.slice(0, 10)}.` : '',
      c.latest ? `Latest release in this cycle: ${c.latest}.` : '',
      past ? 'This version no longer receives security updates. Upgrade is required.' : 'Plan the upgrade before this date; after it there are no security fixes.'
    ].filter(Boolean).join(' ');
    items.push({ ...makeItem({ title, url: sourceUrl, guid: `eol:${productName}:${cycle}:${deadline}`, published: null, body }), deadlineAt: deadline });
  }
  return items;
}
