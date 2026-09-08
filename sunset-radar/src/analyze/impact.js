// Impact mapping — the part that turns a vendor announcement into "this is
// yours, in these files". Everything else in this product is table stakes;
// this is the reason it exists.
//
// The approach: pull identifiers out of the announcement (endpoint paths,
// pinned API versions, SDK symbols, package names, runtime versions), then
// look for those same identifiers in the project's scanned inventory.

// Ordinary hyphenated English that would otherwise look like an identifier.
const ENGLISH_HYPHENATED = /^(?:[a-z]+-(?:by|to|for|and|or|the|of|in|on|at|per|up|down|off|side|time|term|party|based|only|wide|level|specific|related|facing|driven|friendly|scale|through|out)|(?:non|pre|post|re|sub|multi|cross|self|well|long|short|high|low|full|half|semi|end|third|first|second|real|open|closed|built|day|week|month|year|opt|check|field|step|line|read|write|use|user|back|front|left|right|top|new|old)-[a-z]+)(?:-[a-z]+)*$/i;

const STOP_PATHS = new Set(['/docs', '/blog', '/api', '/changelog', '/en', '/support', '/help', '/pricing', '/guides', '/reference', '/index.html']);

export function extractIdentifiers(text = '') {
  const t = text.slice(0, 20000);
  const out = { endpoints: new Set(), versions: new Set(), symbols: new Set(), packages: new Set(), runtimes: new Set() };

  // Endpoint paths: /v1/charges, /admin/api/2026-01/orders.json, /rest/api/3/issue
  for (const m of t.matchAll(/(?<![\w:])\/(?:v\d+[\w.-]*|api|rest|admin|services|graph|[a-z][a-z0-9_-]{2,})(?:\/[A-Za-z0-9_.{}$:-]+){0,5}/g)) {
    const p = m[0].replace(/[.,;:)\]"']+$/, '');
    if (p.length < 4 || p.length > 120) continue;
    if (STOP_PATHS.has(p.toLowerCase())) continue;
    if (/\.(?:html|md|png|jpg|css|js)$/i.test(p)) continue;
    out.endpoints.add(p);
  }

  // Dated API versions (Stripe, Notion, Shopify, Azure) and semver-ish pins.
  for (const m of t.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) out.versions.add(m[1]);
  for (const m of t.matchAll(/\b(20\d{2}-\d{2})\b(?!-)/g)) out.versions.add(m[1]);
  for (const m of t.matchAll(/\bv(\d+(?:\.\d+)?)\b/g)) out.versions.add(`v${m[1]}`);

  // SDK symbols: foo.bar / foo.barBaz(
  for (const m of t.matchAll(/\b([a-z][A-Za-z0-9]{2,})\.([a-zA-Z][A-Za-z0-9_]{2,})(?:\.([a-zA-Z][A-Za-z0-9_]{2,}))?\s*\(?/g)) {
    const sym = [m[1], m[2], m[3]].filter(Boolean).join('.');
    if (/^(?:e\.g|i\.e|www\.|http|node\.js|etc)/i.test(sym)) continue;
    out.symbols.add(sym);
  }
  // Backticked or quoted identifiers are the strongest hint a vendor gives.
  for (const m of t.matchAll(/[`"']([A-Za-z_][A-Za-z0-9_.\-]{3,60})[`"']/g)) out.symbols.add(m[1]);

  // Hyphenated identifiers: model names (text-embedding-ada-002, gpt-4-turbo),
  // image tags, feature flags. Vendors write these bare, without quotes.
  for (const m of t.matchAll(/\b([a-z][a-z0-9]*(?:[-.][a-z0-9]+){1,6})\b/gi)) {
    const tok = m[1];
    if (tok.length < 6 || tok.length > 60) continue;
    if (ENGLISH_HYPHENATED.test(tok)) continue;
    // Needs at least one digit or a known identifier shape to be worth it.
    if (!/\d/.test(tok) && !/(sdk|api|js|py|client|token|auth|node|beta|alpha|v\d)/i.test(tok)) continue;
    out.symbols.add(tok);
  }

  // Pinned third-party actions and images: actions/checkout@v3, node:18-alpine
  for (const m of t.matchAll(/\b([a-z0-9][\w.-]*\/[\w.-]+@[\w.-]+)/gi)) out.symbols.add(m[1]);
  for (const m of t.matchAll(/\b([a-z0-9][\w.-]*:[a-z0-9][\w.-]*(?:-[a-z0-9]+)?)\b/gi)) {
    if (/^(https?|ftp|mailto|note|warning|example)$/i.test(m[1].split(':')[0])) continue;
    if (/\d/.test(m[1])) out.symbols.add(m[1]);
  }

  // Package names.
  for (const m of t.matchAll(/\b((?:@[a-z0-9-]+\/)?[a-z][a-z0-9-]{2,}(?:\.[a-z]{2,})?)\b(?=\s+(?:package|library|sdk|module|gem|npm))/gi)) out.packages.add(m[1].toLowerCase());
  for (const m of t.matchAll(/\b(?:npm install|pip install|go get|gem install|yarn add|pnpm add)\s+([@\w./-]+)/gi)) out.packages.add(m[1].toLowerCase());

  // Runtime versions: "Node 18", "Python 3.8", "PHP 8.1"
  for (const m of t.matchAll(/\b(node(?:\.js)?|python|php|ruby|java|go|dotnet|\.net)\s*v?(\d+(?:\.\d+)?)/gi)) {
    out.runtimes.add(`${m[1].toLowerCase().replace('.js', '')} ${m[2]}`);
    out.versions.add(m[2]);
  }

  return {
    endpoints: [...out.endpoints],
    versions: [...out.versions],
    symbols: [...out.symbols],
    packages: [...out.packages],
    runtimes: [...out.runtimes]
  };
}

const norm = (s) => String(s || '').trim().toLowerCase();
const pathSegments = (p) => norm(p).split('/').filter(Boolean);

/**
 * Does an inventory row match something the announcement talks about?
 * Returns a confidence in [0,1], or 0 for no match.
 */
export function matchRow(row, ids) {
  const value = norm(row.value);
  if (!value) return { score: 0 };

  switch (row.kind) {
    case 'endpoint': {
      const rowSegs = pathSegments(value);
      if (!rowSegs.length) return { score: 0 };
      for (const ep of ids.endpoints) {
        const segs = pathSegments(ep);
        if (!segs.length) continue;
        if (norm(ep) === value) return { score: 1, via: 'endpoint', hint: ep };
        // A shared, distinctive path segment is a real signal: /v1/charges vs
        // /v1/charges/{id}. Ignore generic leading segments.
        const shared = segs.filter((s) => rowSegs.includes(s) && s.length > 3 && !/^(v\d+|api|rest|admin|en|us)$/.test(s));
        if (shared.length >= 1 && (segs.length <= 4 || shared.length >= 2)) {
          return { score: shared.length >= 2 ? 0.9 : 0.7, via: 'endpoint', hint: ep };
        }
      }
      return { score: 0 };
    }
    case 'api_version': {
      for (const v of ids.versions) {
        const vn = norm(v);
        if (vn === value) return { score: 1, via: 'version', hint: v };
        if (value.startsWith(vn) || vn.startsWith(value)) {
          if (Math.min(vn.length, value.length) >= 4) return { score: 0.8, via: 'version', hint: v };
        }
      }
      for (const r of ids.runtimes) {
        const [, num] = r.split(' ');
        if (num && (value === num || value.startsWith(num + '.'))) return { score: 0.85, via: 'runtime', hint: r };
      }
      return { score: 0 };
    }
    case 'symbol': {
      for (const s of ids.symbols) {
        const sn = norm(s);
        if (sn.length < 4) continue;
        if (sn === value) return { score: 1, via: 'symbol', hint: s };
        const tail = value.split('.').slice(-2).join('.');
        if (tail.length >= 6 && sn.endsWith(tail)) return { score: 0.8, via: 'symbol', hint: s };
        if (value.includes(sn) && sn.length >= 8) return { score: 0.7, via: 'symbol', hint: s };
      }
      return { score: 0 };
    }
    case 'package': {
      const bare = value.split(':').pop();                  // npm:@scope/pkg -> @scope/pkg
      const short = bare.split('/').pop().replace(/^@/, ''); // -> pkg
      for (const p of ids.packages) {
        const pn = norm(p);
        if (pn === bare) return { score: 1, via: 'package', hint: p };
        if (pn === short && short.length >= 4) return { score: 0.85, via: 'package', hint: p };
      }
      for (const s of ids.symbols) {
        const sn = norm(s);
        if (sn === bare) return { score: 0.9, via: 'package', hint: s };
        if (sn === short && short.length >= 6) return { score: 0.8, via: 'package', hint: s };
      }
      return { score: 0 };
    }
    case 'base_image': {
      for (const r of ids.runtimes) {
        const [name, num] = r.split(' ');
        if (value.startsWith(name) && num && value.includes(num)) return { score: 0.9, via: 'runtime', hint: r };
      }
      return { score: 0 };
    }
    case 'action_pin': {
      const [rowName, rowVersion] = value.split('@');
      for (const s of ids.symbols) {
        const [name, version] = norm(s).split('@');
        if (name.length < 6 || name !== rowName) continue;
        // Both sides name a version: only a match if it is the same version.
        if (version && rowVersion && version !== rowVersion) continue;
        return { score: version && rowVersion ? 1 : 0.75, via: 'action', hint: s };
      }
      return { score: 0 };
    }
    default:
      return { score: 0 };
  }
}

/**
 * @param {{title:string, body:string}} item
 * @param {Array} inventory rows for the same vendor
 * @returns {{matches:Array, files:Array, matchedFiles:number, confidence:number, identifiers:Object}}
 */
export function mapImpact(item, inventory, { minConfidence = 0.7, maxMatches = 60 } = {}) {
  const ids = extractIdentifiers(`${item.title}\n${item.body || ''}`);
  const matches = [];
  const files = new Map();

  for (const row of inventory) {
    const m = matchRow(row, ids);
    if (m.score < minConfidence) continue;
    matches.push({
      kind: row.kind,
      value: row.value,
      file: row.file,
      line: row.line,
      snippet: row.snippet,
      via: m.via,
      hint: m.hint,
      confidence: Math.round(m.score * 100) / 100
    });
    if (row.file) {
      const entry = files.get(row.file) || { file: row.file, lines: [], kinds: new Set() };
      if (row.line && !entry.lines.includes(row.line)) entry.lines.push(row.line);
      entry.kinds.add(row.kind);
      files.set(row.file, entry);
    }
    if (matches.length >= maxMatches) break;
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  const confidence = matches.length ? Math.max(...matches.map((m) => m.confidence)) : 0;
  return {
    matches,
    files: [...files.values()].map((f) => ({ file: f.file, lines: f.lines.sort((a, b) => a - b).slice(0, 20), kinds: [...f.kinds] })),
    matchedFiles: files.size,
    confidence,
    identifiers: ids
  };
}
