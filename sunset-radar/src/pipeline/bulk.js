// Bulk scanning and the aggregate report.
//
// This is the marketing engine: scan a few hundred public repositories, and
// the output is a set of claims nobody else can make — how much expired API
// surface the ecosystem is carrying, which vendors give the least notice, and
// which pins break the most projects. It is also a lead list: every repo here
// is a team you can email with a true, specific finding about their own code.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { log } from '../log.js';
import { all } from '../db.js';
import { scanRepo } from '../scan/scanner.js';
import { parseRepoUrl, buildReport } from './publicscan.js';
import { getVendorBySlug } from '../store/catalog.js';
import { pollVendorSources } from './poll.js';

const exec = promisify(execFile);

export function readRepoList(file) {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  const seen = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const parsed = parseRepoUrl(line);
    if (!parsed.ok) { log.warn('skipping repo', { line, reason: parsed.error }); continue; }
    if (seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    out.push(parsed);
  }
  return out;
}

/**
 * Scan a list of repositories and return one report each. Failures are
 * recorded, not thrown: a run over 500 repos will always hit a few.
 */
export async function bulkScan(repos, { workDir = null, warm = true, onProgress = null, keepClones = false } = {}) {
  const base = workDir || path.join(config.reposDir, 'bulk');
  fs.mkdirSync(base, { recursive: true });
  const reports = [];
  const failures = [];

  // Warm the pool once up front rather than per repo.
  if (warm) {
    const vendorIds = all('SELECT id FROM vendors').map((v) => v.id);
    try { await pollVendorSources(vendorIds, { limit: 60, concurrency: 5, minAgeMinutes: 120 }); }
    catch (err) { log.warn('bulk warm poll failed', { error: err.message }); }
  }

  for (const [index, repo] of repos.entries()) {
    const dir = path.join(base, repo.owner + '__' + repo.name);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      await exec('git', ['clone', '--depth', '1', '--single-branch', '--no-tags', repo.url, dir], {
        timeout: 180000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '' },
        maxBuffer: 8 * 1024 * 1024
      });
      const result = scanRepo(dir, { maxFiles: 15000 });
      const report = await buildReport({ repo: repo.label, repoUrl: repo.url, result, warm: false, maxFindings: 200 });
      reports.push(report);
      onProgress?.({ index: index + 1, total: repos.length, repo: repo.label, report });
    } catch (err) {
      failures.push({ repo: repo.label, error: String(err.message).slice(0, 200) });
      onProgress?.({ index: index + 1, total: repos.length, repo: repo.label, error: err.message });
    } finally {
      if (!keepClones) fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return { reports, failures };
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * Roll a set of reports into the numbers worth publishing.
 */
export function aggregate(reports, { now = Date.now() } = {}) {
  const repos = reports.length;
  const vendorUse = new Map();      // slug -> repos using it
  const vendorHits = new Map();     // slug -> findings raised
  const exposure = new Map();       // "kind:value" -> repos carrying it
  const leadTimes = new Map();      // slug -> [days of notice]
  const perRepo = [];

  for (const r of reports) {
    const s = r.summary;
    perRepo.push({
      repo: r.repo, url: r.repoUrl,
      integrations: s.integrations, findings: s.findings,
      matched: s.matched, expired: s.expired, soonest: s.soonest
    });

    for (const i of r.integrations) {
      vendorUse.set(i.slug, (vendorUse.get(i.slug) || 0) + 1);
      for (const e of i.evidence) {
        if (e.kind !== 'api_version' && e.kind !== 'base_image' && e.kind !== 'action_pin') continue;
        // A commit-SHA pin is deliberate and unshareable as a statistic; a bare
        // version number means nothing without the thing it versions.
        if (/@[0-9a-f]{40}$/i.test(e.value)) continue;
        const label = e.kind === 'api_version' ? `${i.name || i.slug} ${e.value}` : e.value;
        const key = `${i.slug}:${label}`;
        if (!exposure.has(key)) exposure.set(key, { vendor: i.slug, kind: e.kind, value: label, repos: 0 });
        exposure.get(key).repos++;
      }
    }

    for (const f of r.findings) {
      vendorHits.set(f.vendorSlug, (vendorHits.get(f.vendorSlug) || 0) + 1);
      // Notice period: how long before the deadline the vendor announced it.
      if (f.publishedAt && f.deadlineAt) {
        const days = Math.round((new Date(f.deadlineAt).getTime() - new Date(f.publishedAt).getTime()) / 86400000);
        if (days > 0 && days < 3000) {
          if (!leadTimes.has(f.vendorSlug)) leadTimes.set(f.vendorSlug, []);
          leadTimes.get(f.vendorSlug).push(days);
        }
      }
    }
  }

  const withFindings = perRepo.filter((r) => r.findings > 0);
  const withExpired = perRepo.filter((r) => r.expired > 0);
  const withMatched = perRepo.filter((r) => r.matched > 0);

  return {
    generatedAt: new Date(now).toISOString(),
    repos,
    headline: {
      reposScanned: repos,
      carryingAnyChange: withFindings.length,
      carryingAnyChangePct: pct(withFindings.length, repos),
      carryingExpiredDeadline: withExpired.length,
      carryingExpiredDeadlinePct: pct(withExpired.length, repos),
      carryingCodeMatched: withMatched.length,
      medianIntegrations: median(perRepo.map((r) => r.integrations)),
      medianFindings: median(perRepo.map((r) => r.findings)),
      medianNoticeDays: median([...leadTimes.values()].flat())
    },
    vendors: [...vendorUse.entries()]
      .map(([slug, used]) => {
        const times = leadTimes.get(slug) || [];
        return {
          slug,
          name: getVendorBySlug(slug)?.name || slug,
          reposUsing: used,
          reposUsingPct: pct(used, repos),
          findingsRaised: vendorHits.get(slug) || 0,
          medianNoticeDays: times.length ? median(times) : null,
          shortestNoticeDays: times.length ? Math.min(...times) : null
        };
      })
      .sort((a, b) => b.reposUsing - a.reposUsing),
    exposures: [...exposure.values()].sort((a, b) => b.repos - a.repos).slice(0, 40),
    perRepo: perRepo.sort((a, b) => b.expired - a.expired || b.findings - a.findings)
  };
}

/**
 * The same run as an outreach list. Every row is a team you can email with a
 * true, specific finding about their own code — which is the only cold email
 * anyone answers.
 */
export function toCsv(agg) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = [['repository', 'url', 'integrations', 'outstanding_changes', 'code_matched', 'past_deadline', 'next_deadline']];
  for (const r of agg.perRepo) rows.push([r.repo, r.url, r.integrations, r.findings, r.matched, r.expired, r.soonest ? r.soonest.slice(0, 10) : '']);
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

/** The aggregate as a publishable Markdown post, ready to edit and ship. */
export function toMarkdown(agg, { title = 'The Deprecation Report' } = {}) {
  const h = agg.headline;
  const L = [];
  L.push(`# ${title}`, '');
  L.push(`_${agg.repos} public repositories scanned on ${agg.generatedAt.slice(0, 10)} by [Sunset Radar](https://sunsetradar.dev)._`, '');
  L.push('## What we found', '');
  L.push(`- **${h.carryingAnyChangePct}%** of repositories (${h.carryingAnyChange} of ${h.reposScanned}) are carrying at least one published vendor change that applies to them.`);
  L.push(`- **${h.carryingExpiredDeadlinePct}%** (${h.carryingExpiredDeadline}) are past a deadline that has already come and gone.`);
  L.push(`- ${h.carryingCodeMatched} ${h.carryingCodeMatched === 1 ? 'has' : 'have'} a change we could map to a specific file and line.`);
  L.push(`- The median repository depends on **${h.medianIntegrations}** third-party services we can see.`);
  if (h.medianNoticeDays) L.push(`- The median deprecation gives **${h.medianNoticeDays} days** of notice before the deadline.`);
  L.push('');

  L.push('## Which dependencies show up most', '', '| Vendor | Repos using it | Changes raised | Median notice |', '| --- | --- | --- | --- |');
  for (const v of agg.vendors.slice(0, 20)) {
    L.push(`| ${v.name} | ${v.reposUsing} (${v.reposUsingPct}%) | ${v.findingsRaised} | ${v.medianNoticeDays ? v.medianNoticeDays + ' days' : '—'} |`);
  }
  L.push('');

  const stingy = agg.vendors.filter((v) => v.medianNoticeDays !== null).sort((a, b) => a.medianNoticeDays - b.medianNoticeDays).slice(0, 8);
  if (stingy.length) {
    L.push('## Who gives the least warning', '', '| Vendor | Median notice | Shortest notice seen |', '| --- | --- | --- |');
    for (const v of stingy) L.push(`| ${v.name} | ${v.medianNoticeDays} days | ${v.shortestNoticeDays} days |`);
    L.push('');
  }

  if (agg.exposures.length) {
    L.push('## The pins that appear again and again', '', '| Pin | Kind | Repositories |', '| --- | --- | --- |');
    for (const e of agg.exposures.slice(0, 15)) L.push(`| \`${e.value}\` | ${e.kind.replace('_', ' ')} | ${e.repos} |`);
    L.push('');
  }

  const worst = agg.perRepo.filter((r) => r.expired > 0).slice(0, 15);
  if (worst.length) {
    L.push('## Repositories past a deadline', '');
    L.push('Not a wall of shame — every one of these is a normal, well-maintained project, which is the point. Nobody is watching this, because until now nothing was.', '');
    L.push('| Repository | Integrations | Changes | Past deadline |', '| --- | --- | --- | --- |');
    for (const r of worst) L.push(`| [${r.repo}](${r.url}) | ${r.integrations} | ${r.findings} | ${r.expired} |`);
    L.push('');
  }

  L.push('## Method', '');
  L.push('Each repository was cloned shallow and read statically: dependency manifests, container base images, CI pins, API hostnames, endpoint paths, pinned API version headers and SDK call sites. That inventory was matched against vendor changelogs, release feeds and end-of-life calendars. A change counts only if it is still outstanding; announcements marked "no action required" and deadlines more than a year out with no matching code are excluded.', '');
  L.push('Static analysis has limits: calls built at runtime may not be visible, so these numbers are a floor, not a ceiling.', '');
  return L.join('\n');
}
