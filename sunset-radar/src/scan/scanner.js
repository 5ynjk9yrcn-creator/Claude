// Repo scanner. Pure and side-effect free: give it a directory, get back an
// inventory of third-party integrations with file:line evidence. Everything
// downstream (impact mapping, alert routing) hangs off this.
import fs from 'node:fs';
import path from 'node:path';
import { VENDORS } from '../catalog/vendors.js';

export const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'bower_components', 'vendor', 'dist', 'build', 'out',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', 'coverage', '__pycache__',
  '.venv', 'venv', 'env', '.tox', '.mypy_cache', '.pytest_cache', 'target',
  'Pods', '.gradle', '.idea', '.vscode', '.terraform', 'tmp', '.expo', '.parcel-cache'
]);

const SKIP_FILE_RE = /(\.min\.(js|css)|\.map|\.lock|-lock\.json|\.snap|\.log|\.png|\.jpe?g|\.gif|\.webp|\.svg|\.ico|\.pdf|\.zip|\.gz|\.tgz|\.br|\.woff2?|\.ttf|\.eot|\.mp4|\.mp3|\.wasm|\.class|\.jar|\.so|\.dylib|\.dll|\.exe|\.pyc)$/i;

const TEXT_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|kts|php|cs|swift|m|mm|sh|bash|zsh|sql|graphql|gql|json|ya?ml|toml|ini|cfg|conf|env|properties|xml|gradle|tf|tfvars|md|mdx|txt|html|vue|svelte|astro|erb|ejs|hbs|dockerfile|makefile)$/i;

const MANIFEST_NAMES = new Set([
  'package.json', 'requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'Pipfile',
  'setup.py', 'setup.cfg', 'go.mod', 'Gemfile', 'composer.json', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'Cargo.toml', 'Dockerfile', 'docker-compose.yml',
  'docker-compose.yaml', '.tool-versions', '.nvmrc', 'runtime.txt', 'app.json', 'eas.json'
]);

// --- catalog index -------------------------------------------------------

function buildIndex(vendors) {
  const packageIndex = new Map(); // "eco:name" -> slug
  const envIndex = new Map();     // ENV_NAME -> [slug]
  const hosts = [];               // { host, slug }
  const compiled = [];            // per-vendor compiled regexes + hints

  for (const v of vendors) {
    const d = v.detect || {};
    for (const [eco, names] of Object.entries(d.packages || {})) {
      for (const name of names) packageIndex.set(`${eco}:${name.toLowerCase()}`, v.slug);
    }
    for (const e of d.envVars || []) {
      const list = envIndex.get(e) || [];
      list.push(v.slug);
      envIndex.set(e, list);
    }
    for (const h of d.hosts || []) hosts.push({ host: h.toLowerCase(), slug: v.slug });

    const hints = new Set([v.slug.replace(/-/g, '')]);
    for (const names of Object.values(d.packages || {})) {
      for (const n of names) {
        const base = n.split('/').pop().replace(/^@/, '').toLowerCase();
        if (base.length > 2) hints.add(base);
      }
    }
    for (const h of d.hosts || []) hints.add(h.split('/')[0].toLowerCase());
    for (const e of d.envVars || []) hints.add(e.split('_')[0].toLowerCase());
    hints.add(v.slug.toLowerCase());

    compiled.push({
      slug: v.slug,
      hints: [...hints].filter((h) => h.length >= 3),
      symbols: (d.symbols || []).map((r) => new RegExp(r, 'g')),
      versionPins: (d.versionPins || []).map((r) => new RegExp(r, 'gi')),
      pinNames: (d.versionPins || []).filter((r) => /^[A-Za-z][\w-]*$/.test(r))
    });
  }
  // Longest hosts first so "slack.com/api" wins over a bare domain.
  hosts.sort((a, b) => b.host.length - a.host.length);
  return { packageIndex, envIndex, hosts, compiled };
}

// --- file walking --------------------------------------------------------

export function* walk(root, { maxFiles = 20000, maxFileBytes = 1024 * 1024, extraSkip = [] } = {}) {
  const skip = new Set([...SKIP_DIRS, ...extraSkip]);
  const stack = [root];
  let seen = 0;
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        if (skip.has(ent.name)) continue;
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (SKIP_FILE_RE.test(ent.name)) continue;
      const isManifest = MANIFEST_NAMES.has(ent.name) || /^Dockerfile/i.test(ent.name);
      if (!isManifest && !TEXT_EXT.test(ent.name) && ent.name.includes('.')) continue;
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.size > maxFileBytes) continue;
      if (++seen > maxFiles) return;
      yield { full, rel: path.relative(root, full), name: ent.name, size: st.size, isManifest };
    }
  }
}

const readText = (file) => {
  try {
    const buf = fs.readFileSync(file);
    // Cheap binary check: a NUL byte early on means it isn't source.
    if (buf.subarray(0, 1024).includes(0)) return null;
    return buf.toString('utf8');
  } catch { return null; }
};

// Evidence found in prose (README, changelog, docs) is a much weaker signal
// than the same string in code — a README that mentions Twilio does not mean
// the code calls Twilio.
const DOC_EXT = /\.(md|mdx|txt|rst|adoc)$/i;
const fileWeight = (rel) => (DOC_EXT.test(rel) ? 0.3 : /(^|[\\/])(test|tests|__tests__|examples?|docs?|fixtures?)[\\/]/i.test(rel) ? 0.6 : 1);

const lineOf = (text, index) => {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
};

const snippetAt = (text, index, span = 100) => {
  const start = text.lastIndexOf('\n', index) + 1;
  let end = text.indexOf('\n', index);
  if (end === -1) end = text.length;
  return text.slice(start, Math.min(end, start + span)).trim().slice(0, 200);
};

// --- manifest parsers ----------------------------------------------------

function parseManifest(name, text) {
  const out = []; // { eco, dep, line }
  const add = (eco, dep, idx) => out.push({ eco, dep, idx });
  try {
    if (name === 'package.json' || name === 'app.json' || name === 'eas.json') {
      const json = JSON.parse(text);
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const dep of Object.keys(json[field] || {})) add('npm', dep, text.indexOf(`"${dep}"`));
      }
      if (json.engines?.node) add('runtime', `node${json.engines.node}`, text.indexOf('"engines"'));
    } else if (name === 'composer.json') {
      const json = JSON.parse(text);
      for (const field of ['require', 'require-dev']) {
        for (const dep of Object.keys(json[field] || {})) add('php', dep, text.indexOf(`"${dep}"`));
      }
    } else if (/^requirements.*\.txt$/.test(name) || name === 'runtime.txt') {
      for (const m of text.matchAll(/^\s*([A-Za-z0-9._-]+)\s*(?:[=<>!~[]|$)/gm)) add('pypi', m[1], m.index);
    } else if (name === 'pyproject.toml' || name === 'Pipfile' || name === 'setup.py' || name === 'setup.cfg') {
      for (const m of text.matchAll(/["']?([A-Za-z0-9._-]{2,})["']?\s*[=<>~^]+\s*["'][0-9*^~<>= .]+["']/g)) add('pypi', m[1], m.index);
      for (const m of text.matchAll(/^\s*["']([A-Za-z0-9._-]{2,})["']\s*,?\s*$/gm)) add('pypi', m[1], m.index);
    } else if (name === 'go.mod') {
      for (const m of text.matchAll(/^\s*([a-z0-9.\-]+\.[a-z]{2,}\/[^\s]+)\s+v[0-9]/gm)) add('go', m[1], m.index);
    } else if (name === 'Gemfile') {
      for (const m of text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) add('ruby', m[1], m.index);
    } else if (name === 'pom.xml') {
      for (const m of text.matchAll(/<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>/g)) add('java', `${m[1]}:${m[2]}`, m.index);
    } else if (/^build\.gradle/.test(name)) {
      for (const m of text.matchAll(/["']([a-z0-9.\-]+):([a-z0-9.\-]+):[^"']+["']/gi)) add('java', `${m[1]}:${m[2]}`, m.index);
    } else if (name === 'Cargo.toml') {
      for (const m of text.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=\s*[{"]/gm)) add('rust', m[1], m.index);
    }
  } catch { /* malformed manifest: fall through to regex signals */ }
  return out;
}

// --- main scan -----------------------------------------------------------

const URL_RE = /https?:\/\/([A-Za-z0-9.-]+\.[A-Za-z]{2,})(\/[A-Za-z0-9._~\-/{}$:%]*)?/g;
const ENV_TOKEN_RE = /\b([A-Z][A-Z0-9]{1,}(?:_[A-Z0-9]+){1,})\b/g;
const DOCKER_FROM_RE = /^\s*FROM\s+([A-Za-z0-9._/-]+):([A-Za-z0-9._-]+)/gim;
const GH_ACTION_RE = /uses:\s*([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)@(v?[A-Za-z0-9._-]+)/g;

/**
 * @returns {{vendors: Object[], stats: Object}}
 */
export function scanRepo(root, options = {}) {
  const vendors = options.vendors || VENDORS;
  const index = buildIndex(vendors);
  const started = Date.now();
  const byVendor = new Map(); // slug -> { slug, evidence: [], counts: {} }
  const stats = { files: 0, bytes: 0, manifests: 0, skipped: 0 };
  const maxEvidencePerKind = options.maxEvidencePerKind ?? 40;

  const record = (slug, kind, value, file, line, snippet, confidence = 1) => {
    if (!slug || !value) return;
    let v = byVendor.get(slug);
    if (!v) { v = { slug, evidence: [], counts: {}, weights: {}, files: new Set(), kinds: new Set() }; byVendor.set(slug, v); }
    const w = confidence * fileWeight(file);
    v.counts[kind] = (v.counts[kind] || 0) + 1;
    v.weights[kind] = (v.weights[kind] || 0) + w;
    v.files.add(file);
    v.kinds.add(kind);
    if (v.counts[kind] > maxEvidencePerKind) return; // count it, stop storing it
    const val = String(value).slice(0, 300);
    const dupe = v.evidence.some((e) => e.kind === kind && e.value === val && e.file === file && e.line === line);
    if (!dupe) v.evidence.push({ kind, value: val, file, line, snippet: (snippet || '').slice(0, 200), confidence: Math.round(w * 100) / 100 });
  };

  for (const f of walk(root, options)) {
    const text = readText(f.full);
    if (text === null) { stats.skipped++; continue; }
    stats.files++;
    stats.bytes += f.size;
    const lower = text.toLowerCase();

    // 1. Manifest dependencies — the highest-confidence signal.
    if (f.isManifest) {
      stats.manifests++;
      for (const { eco, dep, idx } of parseManifest(f.name, text)) {
        const slug = index.packageIndex.get(`${eco}:${dep.toLowerCase()}`);
        if (slug) record(slug, 'package', `${eco}:${dep}`, f.rel, lineOf(text, Math.max(0, idx)), snippetAt(text, Math.max(0, idx)));
      }
      for (const m of text.matchAll(DOCKER_FROM_RE)) {
        record('docker', 'base_image', `${m[1]}:${m[2]}`, f.rel, lineOf(text, m.index), snippetAt(text, m.index));
        if (/^node$/i.test(m[1])) record('nodejs', 'api_version', m[2], f.rel, lineOf(text, m.index), snippetAt(text, m.index));
        if (/^python$/i.test(m[1])) record('python', 'api_version', m[2], f.rel, lineOf(text, m.index), snippetAt(text, m.index));
      }
    }

    // 2. GitHub Actions pins.
    if (/\.github[\\/]workflows[\\/]/.test(f.rel)) {
      for (const m of text.matchAll(GH_ACTION_RE)) {
        record('github', 'action_pin', `${m[1]}@${m[2]}`, f.rel, lineOf(text, m.index), snippetAt(text, m.index));
      }
    }

    // 3. Hostnames in any file → vendor + endpoint path.
    for (const m of text.matchAll(URL_RE)) {
      const host = m[1].toLowerCase();
      const urlPath = (m[2] || '').replace(/[.,;)'"]+$/, '');
      const full = host + urlPath;
      for (const h of index.hosts) {
        if (full.includes(h.host)) {
          const line = lineOf(text, m.index);
          record(h.slug, 'host', host, f.rel, line, snippetAt(text, m.index));
          if (urlPath && urlPath.length > 1) {
            record(h.slug, 'endpoint', urlPath.split('?')[0].slice(0, 120), f.rel, line, snippetAt(text, m.index), 0.9);
          }
          break; // most specific host wins
        }
      }
    }

    // 4. Environment variable names.
    for (const m of text.matchAll(ENV_TOKEN_RE)) {
      const slugs = index.envIndex.get(m[1]);
      if (!slugs) continue;
      for (const slug of slugs) record(slug, 'env', m[1], f.rel, lineOf(text, m.index), snippetAt(text, m.index), 0.8);
    }

    // 5. Vendor-specific symbols and pinned API versions — only for vendors
    //    the file plausibly mentions, so a big repo stays fast.
    for (const c of index.compiled) {
      if (!c.symbols.length && !c.versionPins.length) continue;
      if (!c.hints.some((h) => lower.includes(h))) continue;
      for (const re of c.symbols) {
        re.lastIndex = 0;
        let m; let hits = 0;
        while ((m = re.exec(text)) !== null && hits < 200) {
          hits++;
          record(c.slug, 'symbol', m[0], f.rel, lineOf(text, m.index), snippetAt(text, m.index), 0.9);
        }
      }
      for (const re of c.versionPins) {
        re.lastIndex = 0;
        let m; let hits = 0;
        while ((m = re.exec(text)) !== null && hits < 50) {
          hits++;
          const raw = m[0];
          const value = extractVersionValue(raw, text, m.index);
          if (value) record(c.slug, 'api_version', value, f.rel, lineOf(text, m.index), snippetAt(text, m.index), 0.85);
        }
      }
    }
  }

  const result = [...byVendor.values()].map((v) => {
    const confidence = scoreConfidence(v);
    return {
      slug: v.slug,
      evidence: v.evidence,
      counts: v.counts,
      kinds: [...v.kinds],
      fileCount: v.files.size,
      confidence,
      // Only confident detections start a watch automatically; the rest are
      // shown as "possible" so the user can confirm with one click.
      detected: confidence >= (options.detectThreshold ?? 0.5)
    };
  });
  result.sort((a, b) => b.confidence - a.confidence || a.slug.localeCompare(b.slug));
  stats.durationMs = Date.now() - started;
  stats.vendors = result.length;
  return { vendors: result, stats };
}

// A pinned version can appear as `Stripe-Version: 2024-06-20`, as a bare
// pattern like `/v18.0/`, or as a JSON pair. Pull out the value either way.
function extractVersionValue(raw, text, idx) {
  if (/^[A-Za-z][\w-]*$/.test(raw)) {
    const after = text.slice(idx + raw.length, idx + raw.length + 60);
    const m = after.match(/["'\s:=]+([A-Za-z0-9][\w.\-]{1,40})/);
    return m ? m[1] : null;
  }
  const m = raw.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}|v?[0-9]+(?:\.[0-9]+)*(?:\.x)?)/);
  return m ? m[1] : raw.slice(0, 60);
}

// Confidence: a manifest dependency is near-certain, a hostname in code is
// strong, an env var name on its own is only a hint. This drives whether we
// start watching a vendor automatically.
const KIND_WEIGHT = { package: 0.65, base_image: 0.55, action_pin: 0.5, host: 0.35, api_version: 0.35, symbol: 0.25, endpoint: 0.15, env: 0.12 };
const WEAK_KINDS = new Set(['env']);

export function scoreConfidence(v) {
  let strong = 0;
  let weak = 0;
  for (const [kind, weight] of Object.entries(v.weights)) {
    // Diminishing returns: ten Stripe imports are not ten times one.
    const contribution = (KIND_WEIGHT[kind] || 0.1) * Math.min(1 + Math.log10(Math.max(weight, 0.1)), 2);
    if (WEAK_KINDS.has(kind)) weak += contribution; else strong += contribution;
  }
  // Hints alone can never clear the auto-watch bar — they need corroboration.
  const score = strong + Math.min(weak, 0.3);
  return Math.round(Math.min(score, 1) * 100) / 100;
}
