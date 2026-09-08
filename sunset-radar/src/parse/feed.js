// Tolerant RSS/Atom/JSON-feed parsing. Real-world feeds are malformed often
// enough that a strict XML parser is a liability; this only needs the five
// fields we actually use.
import crypto from 'node:crypto';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

export function decodeEntities(s = '') {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m);
}
const safeChar = (code) => (Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '');

const stripOnce = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

// Feeds routinely double-escape markup (<content type="html">&lt;p&gt;…), so
// strip, decode, then strip once more if tags reappeared.
export const stripTags = (html = '') => {
  let out = decodeEntities(stripOnce(html));
  if (/<[a-z/][^>]*>/i.test(out)) out = decodeEntities(stripOnce(out));
  return out.replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
};

const unwrapCdata = (s = '') => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

function tagContent(block, ...names) {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
    const m = block.match(re);
    if (m) return unwrapCdata(m[1]).trim();
  }
  return '';
}

function atomLink(block) {
  // <link rel="alternate" href="..."/> — prefer alternate, fall back to first.
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  const attrs = (s) => Object.fromEntries([...s.matchAll(/([a-z:]+)\s*=\s*"([^"]*)"/gi)].map((m) => [m[1].toLowerCase(), m[2]]));
  const parsed = links.map(attrs).filter((a) => a.href);
  const alt = parsed.find((a) => !a.rel || a.rel === 'alternate');
  return decodeEntities((alt || parsed[0] || {}).href || '');
}

export function parseFeed(text, { sourceUrl = '' } = {}) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJsonFeed(trimmed, sourceUrl);

  const blocks = [...trimmed.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const items = [];
  for (const block of blocks) {
    const title = stripTags(tagContent(block, 'title')) || '(untitled)';
    const link = decodeEntities(tagContent(block, 'link')) || atomLink(block) || sourceUrl;
    const guidRaw = tagContent(block, 'guid', 'id') || link || title;
    const dateRaw = tagContent(block, 'pubDate', 'published', 'updated', 'dc:date', 'date');
    const bodyRaw = tagContent(block, 'content:encoded', 'content', 'description', 'summary');
    items.push(makeItem({ title, url: link, guid: guidRaw, published: dateRaw, body: stripTags(bodyRaw) }));
  }
  return items;
}

function parseJsonFeed(text, sourceUrl) {
  let json;
  try { json = JSON.parse(text); } catch { return []; }
  const arr = Array.isArray(json) ? json : json.items || json.entries || json.results || json.data || [];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 200).map((it) =>
    makeItem({
      title: String(it.title || it.name || it.summary || it.headline || '(untitled)'),
      url: it.url || it.link || it.html_url || sourceUrl,
      guid: String(it.id || it.guid || it.url || it.title || ''),
      published: it.date_published || it.published_at || it.published || it.created_at || it.date || '',
      body: stripTags(String(it.content_html || it.content_text || it.body || it.description || it.summary || it.notes || ''))
    })
  );
}

export function makeItem({ title, url, guid, published, body }) {
  const t = (title || '').trim().slice(0, 500);
  const b = (body || '').trim().slice(0, 20000);
  return {
    title: t,
    url: (url || '').trim().slice(0, 1000),
    guid: (guid || t).trim().slice(0, 500),
    publishedAt: parseDate(published),
    body: b,
    hash: crypto.createHash('sha256').update(`${t}\n${b.slice(0, 4000)}`).digest('hex').slice(0, 32)
  };
}

export function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d2 = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}
