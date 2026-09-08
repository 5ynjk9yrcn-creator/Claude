// The free scan: anyone pastes a public repository URL and gets a shareable
// report of the deprecations that repo is already carrying. No account, no
// access to private code, no trust required — which is the point. It is also
// how the shared source pool gets warm: the first person to scan a repo using
// an unwatched vendor pays for the fetch, everyone after reads the cache.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { log } from '../log.js';
import { all, one, run, nowIso, toJson, fromJson } from '../db.js';
import { id, token } from '../store/ids.js';
import { scanRepo } from '../scan/scanner.js';
import { VENDORS } from '../catalog/vendors.js';
import { getVendorBySlug } from '../store/catalog.js';
import { mapImpact } from '../analyze/impact.js';
import { severityFor, severityRank } from '../analyze/risk.js';
import { pollVendorSources } from './poll.js';

const exec = promisify(execFile);

export const ALLOWED_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org', 'git.sr.ht']);
const MAX_CLONE_MB = 400;
const CLONE_TIMEOUT_MS = 120000;
const SCAN_TTL_DAYS = 30;

/**
 * Accept only what we are willing to clone: a public https repo on a known
 * host, no credentials, no ssh, no path traversal.
 * @returns {{ok:true, url:string, host:string, owner:string, name:string, label:string}|{ok:false, error:string}}
 */
export function parseRepoUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Paste a repository URL.' };

  let candidate = raw;
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) candidate = `https://github.com/${raw}`; // "owner/repo" shorthand
  if (candidate.startsWith('git@')) return { ok: false, error: 'Use the https URL, not the SSH one.' };

  let url;
  try { url = new URL(candidate); } catch { return { ok: false, error: 'That does not look like a URL.' }; }
  if (url.protocol !== 'https:') return { ok: false, error: 'Only https URLs are accepted.' };
  if (url.username || url.password) return { ok: false, error: 'Remove the credentials from the URL.' };

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, error: `Only public repos on ${[...ALLOWED_HOSTS].join(', ')} can be scanned. Self-host Sunset Radar to scan anything else.` };
  }

  const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length < 2) return { ok: false, error: 'That URL does not point at a repository.' };
  const [owner, name] = parts;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name) || owner.startsWith('.') || name.startsWith('.')) {
    return { ok: false, error: 'That repository name is not one we can clone.' };
  }

  return { ok: true, url: `https://${host}/${owner}/${name}`, host, owner, name, label: `${owner}/${name}` };
}

// One box, one queue: never let strangers start more than a couple of clones
// at once.
let running = 0;
const MAX_CONCURRENT = 2;
export const queueDepth = () => running;

export function createPublicScan({ repoUrl, ip = null }) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // A recent report for the same repo is reused rather than re-cloned.
  const recent = one(
    `SELECT * FROM public_scans WHERE repo_url = ? AND status = 'ready' AND created_at > ? ORDER BY created_at DESC LIMIT 1`,
    parsed.url, new Date(Date.now() - 6 * 3600000).toISOString()
  );
  if (recent) return { ok: true, scan: recent, reused: true, parsed };

  const scanId = id('scn');
  const t = token(12);
  run(`INSERT INTO public_scans (id, token, repo_url, repo_name, status, ip, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)`,
    scanId, t, parsed.url, parsed.label, ip, nowIso(),
    new Date(Date.now() + SCAN_TTL_DAYS * 86400000).toISOString());
  return { ok: true, scan: getPublicScan(t), reused: false, parsed };
}

export const getPublicScan = (t) => {
  const row = one('SELECT * FROM public_scans WHERE token = ?', t);
  return row ? { ...row, report: fromJson(row.report, null) } : null;
};

export const countRecentScansFrom = (ip, hours = 1) =>
  one('SELECT COUNT(*) AS n FROM public_scans WHERE ip = ? AND created_at > ?', ip, new Date(Date.now() - hours * 3600000).toISOString()).n;

export const attachEmail = (t, email) => run('UPDATE public_scans SET email = ? WHERE token = ?', String(email).slice(0, 200), t);
export const markViewed = (t) => run('UPDATE public_scans SET views = views + 1 WHERE token = ?', t);

/** Run one queued scan to completion. Never throws: failure is a report state. */
export async function runPublicScan(t, { warm = true } = {}) {
  const scan = getPublicScan(t);
  if (!scan) return null;
  if (scan.status === 'ready' || scan.status === 'running') return scan;
  if (running >= MAX_CONCURRENT) return scan; // stays queued; the caller retries

  running++;
  run("UPDATE public_scans SET status = 'running' WHERE token = ?", t);
  const dir = path.join(config.reposDir, 'public', scan.id);

  try {
    await clone(scan.repo_url, dir);
    const result = scanRepo(dir, { maxFiles: 12000 });
    const report = await buildReport({ repo: scan.repo_name, repoUrl: scan.repo_url, result, warm });
    run("UPDATE public_scans SET status = 'ready', report = ?, finished_at = ? WHERE token = ?", toJson(report), nowIso(), t);
    log.info('public scan complete', { repo: scan.repo_name, integrations: report.summary.integrations, findings: report.summary.findings });
  } catch (err) {
    run("UPDATE public_scans SET status = 'failed', error = ?, finished_at = ? WHERE token = ?", String(err.message).slice(0, 300), nowIso(), t);
    log.warn('public scan failed', { repo: scan.repo_name, error: err.message });
  } finally {
    running--;
    fs.rmSync(dir, { recursive: true, force: true }); // the code never lingers on disk
  }
  return getPublicScan(t);
}

async function clone(url, dir) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.rmSync(dir, { recursive: true, force: true });
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', GIT_CONFIG_NOSYSTEM: '1' };
  try {
    await exec('git', ['clone', '--depth', '1', '--single-branch', '--no-tags', url, dir], { timeout: CLONE_TIMEOUT_MS, env, maxBuffer: 4 * 1024 * 1024 });
  } catch (err) {
    const stderr = String(err.stderr || err.message);
    if (/could not read Username|Authentication failed|not found/i.test(stderr)) throw new Error('That repository is private or does not exist.');
    if (err.killed) throw new Error('That repository took too long to clone.');
    throw new Error('Could not clone that repository.');
  }
  const mb = dirSizeMb(dir);
  if (mb > MAX_CLONE_MB) throw new Error(`That repository is larger than the ${MAX_CLONE_MB} MB free-scan limit.`);
}

function dirSizeMb(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    let entries;
    try { entries = fs.readdirSync(stack.pop(), { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(e.parentPath || e.path || dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) { try { total += fs.statSync(full).size; } catch { /* raced */ } }
    }
  }
  return total / (1024 * 1024);
}

/**
 * Turn a scan into a report: which integrations are here, and which published
 * changes already apply to them. Pure apart from the optional warm poll.
 */
export async function buildReport({ repo, repoUrl, result, warm = true, now = Date.now(), maxFindings = 60 }) {
  const detected = result.vendors.filter((v) => v.detected);
  const vendorRows = new Map();
  for (const v of detected) {
    const row = getVendorBySlug(v.slug);
    if (row) vendorRows.set(v.slug, row);
  }

  if (warm && vendorRows.size) {
    // "Cold" means no items from a real feed. Demo rows do not count as
    // coverage, or a demo install would never warm itself up.
    const cold = [...vendorRows.values()].filter((row) => one(
      `SELECT COUNT(*) AS n FROM items i JOIN sources s ON s.id = i.source_id
       WHERE i.vendor_id = ? AND s.enabled = 1 AND s.url NOT LIKE 'demo://%'`, row.id).n === 0);
    if (cold.length) {
      try { await pollVendorSources(cold.map((c) => c.id), { limit: 12 }); }
      catch (err) { log.warn('warm poll failed', { error: err.message }); }
    }
  }

  const catalog = new Map(VENDORS.map((v) => [v.slug, v]));
  const integrations = [];
  const findings = [];
  const seenDedupe = new Set();

  for (const v of detected) {
    const row = vendorRows.get(v.slug);
    const meta = catalog.get(v.slug) || {};
    const files = new Set(v.evidence.map((e) => e.file).filter(Boolean));
    integrations.push({
      slug: v.slug,
      name: row?.name || meta.name || v.slug,
      category: row?.category || meta.category || null,
      confidence: v.confidence,
      counts: v.counts,
      files: files.size,
      sources: row ? all('SELECT COUNT(*) AS n FROM sources WHERE vendor_id = ? AND enabled = 1', row.id)[0].n : 0,
      evidence: v.evidence.slice(0, 8).map((e) => ({ kind: e.kind, value: e.value, file: e.file, line: e.line }))
    });
    if (!row) continue;

    const inventory = v.evidence.map((e) => ({ kind: e.kind, value: e.value, file: e.file, line: e.line, snippet: e.snippet }));
    const items = all(
      `SELECT i.* FROM items i JOIN sources s ON s.id = i.source_id
       WHERE i.vendor_id = ? AND s.url NOT LIKE 'demo://%'
       ORDER BY i.risk_score DESC, COALESCE(i.published_at, i.created_at) DESC LIMIT 150`,
      row.id
    );

    for (const item of items) {
      if (item.dedupe_key) {
        if (seenDedupe.has(item.dedupe_key)) continue;
      }
      const impact = mapImpact({ title: item.title, body: item.body || '' }, inventory);
      const { severity, total } = severityFor({ score: item.risk_score, matchedFiles: impact.matchedFiles, deadlineAt: item.deadline_at, now });

      // A report is a sales document as much as a security one, so the bar is
      // higher than the dashboard's: either it touches this code, or it is
      // serious enough that anyone using this vendor should know.
      const floor = impact.matchedFiles > 0 ? 'low' : 'high';
      if (severityRank(severity) < severityRank(floor)) continue;
      const published = item.published_at ? new Date(item.published_at).getTime() : null;
      if (published !== null && published < now - 400 * 86400000 && impact.matchedFiles === 0) continue;

      if (item.dedupe_key) seenDedupe.add(item.dedupe_key);
      findings.push({
        severity,
        score: total,
        vendorSlug: v.slug,
        vendorName: row.name,
        title: item.title,
        url: item.url,
        summary: item.summary,
        publishedAt: item.published_at,
        deadlineAt: item.deadline_at,
        categories: fromJson(item.categories, []),
        matchedFiles: impact.matchedFiles,
        files: impact.files.slice(0, 10),
        matches: impact.matches.slice(0, 8).map((m) => ({ kind: m.kind, value: m.value, file: m.file, line: m.line, via: m.via, hint: m.hint }))
      });
    }
  }

  findings.sort((a, b) =>
    severityRank(b.severity) - severityRank(a.severity) ||
    b.matchedFiles - a.matchedFiles ||
    String(a.deadlineAt || '9999').localeCompare(String(b.deadlineAt || '9999')));

  // A lifecycle feed can publish a dozen future cycles at once. If none of
  // them touch this code, the reader needs the next one, not all of them.
  const unmatchedPerVendor = new Map();
  const kept = findings.filter((f) => {
    if (f.matchedFiles > 0) return true;
    const n = (unmatchedPerVendor.get(f.vendorSlug) || 0) + 1;
    unmatchedPerVendor.set(f.vendorSlug, n);
    return n <= 2;
  }).slice(0, maxFindings);

  const bySeverity = {};
  for (const f of kept) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  const dated = kept.filter((f) => f.deadlineAt);
  const expired = dated.filter((f) => new Date(f.deadlineAt).getTime() < now);
  const upcoming = dated.filter((f) => new Date(f.deadlineAt).getTime() >= now).sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt));

  return {
    repo,
    repoUrl,
    scannedAt: new Date(now).toISOString(),
    stats: result.stats,
    integrations,
    findings: kept,
    summary: {
      integrations: integrations.length,
      unmonitored: integrations.filter((i) => i.sources === 0).length,
      findings: kept.length,
      matched: kept.filter((f) => f.matchedFiles > 0).length,
      bySeverity,
      expired: expired.length,
      withDeadline: dated.length,
      soonest: upcoming[0]?.deadlineAt || null,
      files: result.stats.files
    }
  };
}

/** Housekeeping: reports are not kept forever. */
export const purgeExpiredScans = () => run('DELETE FROM public_scans WHERE expires_at < ?', nowIso());
