// The polling loop: fetch every due source once, turn responses into items,
// fan those items out to the projects that care, and enrich the few that
// score high enough to be worth an LLM call.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { log } from '../log.js';
import { all, run, one, nowIso, toJson } from '../db.js';
import { id } from '../store/ids.js';
import { fetchUrl } from '../net/fetch.js';
import { parseFeed } from '../parse/feed.js';
import { parseChangelogHtml, parseEolJson } from '../parse/html.js';
import { duePolls, markSourcePolled, listSources } from '../store/catalog.js';
import { upsertItem, fanOutItem, getItem } from '../store/findings.js';
import { listInventory } from '../store/projects.js';
import { enrichItem, llmEnabled } from '../analyze/llm.js';
import { severityFor } from '../analyze/risk.js';

export function parseBody(source, body) {
  switch (source.kind) {
    case 'eol':
      return parseEolJson(body, { productName: source.vendor_name || source.label || 'This runtime', sourceUrl: source.url });
    case 'html':
      return parseChangelogHtml(body, { sourceUrl: source.url });
    case 'rss':
    case 'atom':
    case 'github_releases':
    case 'json':
    default:
      return parseFeed(body, { sourceUrl: source.url });
  }
}

/** Fetch and ingest a single source. Never throws: a bad source is data. */
export async function pollSource(source, { fetchImpl = fetchUrl } = {}) {
  const result = { source: source.url, vendor: source.vendor_slug, newItems: 0, changedItems: 0, items: [], status: 0, error: null, skipped: false };
  let res;
  try {
    res = await fetchImpl(source.url, { etag: source.etag, lastModified: source.last_modified });
  } catch (err) {
    markSourcePolled(source.id, { status: 0, error: err.message, ok: false });
    result.error = err.message;
    return result;
  }

  result.status = res.status;
  if (res.notModified) {
    markSourcePolled(source.id, { status: 304, ok: true });
    result.skipped = true;
    return result;
  }
  if (!res.ok) {
    markSourcePolled(source.id, { status: res.status, error: res.error, ok: false });
    result.error = res.error;
    return result;
  }

  const contentHash = crypto.createHash('sha256').update(res.body).digest('hex').slice(0, 32);
  if (contentHash === source.content_hash) {
    // Byte-identical page: nothing changed even though the server would not
    // say so with an ETag.
    markSourcePolled(source.id, { status: res.status, etag: res.etag, lastModified: res.lastModified, contentHash, ok: true });
    result.skipped = true;
    return result;
  }

  let parsed = [];
  try {
    parsed = parseBody({ ...source, vendor_name: source.vendor_name }, res.body);
  } catch (err) {
    markSourcePolled(source.id, { status: res.status, error: `parse: ${err.message}`, ok: false });
    result.error = `parse: ${err.message}`;
    return result;
  }

  for (const p of parsed.slice(0, 200)) {
    if (!p.title) continue;
    const { item, isNew, changed } = upsertItem(source, p);
    if (isNew) { result.newItems++; result.items.push(item); }
    else if (changed) { result.changedItems++; result.items.push(item); }
  }

  markSourcePolled(source.id, { status: res.status, etag: res.etag, lastModified: res.lastModified, contentHash, ok: true });
  return result;
}

async function mapLimit(items, limit, worker) {
  const out = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * One full polling cycle.
 * @returns {Promise<Object>} stats for the run log
 */
export async function pollCycle({ limit = 25, concurrency = config.scheduler.pollConcurrency, defaultMinutes = 60, fetchImpl = fetchUrl, enrich = true, onlyWatched = true } = {}) {
  const runId = id('run');
  const startedAt = nowIso();
  run('INSERT INTO runs (id, kind, started_at) VALUES (?, ?, ?)', runId, 'poll', startedAt);

  const stats = { sources: 0, ok: 0, failed: 0, notModified: 0, newItems: 0, changedItems: 0, findings: 0, enriched: 0, bySeverity: {} };
  try {
    const due = duePolls({ limit, defaultMinutes, onlyWatched });
    stats.sources = due.length;
    const results = await mapLimit(due, concurrency, (source) => pollSource(source, { fetchImpl }));

    const touched = [];
    for (const r of results) {
      if (!r) continue;
      if (r.error) stats.failed++;
      else stats.ok++;
      if (r.skipped) stats.notModified++;
      stats.newItems += r.newItems;
      stats.changedItems += r.changedItems;
      touched.push(...r.items);
    }

    // Enrich before fan-out so the LLM's verdict shapes the severity users see.
    if (enrich && llmEnabled()) {
      const candidates = touched
        .filter((i) => i.risk_score >= config.llm.minRiskScore && !i.enriched)
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, config.llm.maxItemsPerRun);
      for (const item of candidates) {
        const verdict = await enrichItem({ ...item, vendorName: item.vendor_name, publishedAt: item.published_at }, { usage: sampleUsage(item.vendor_id) });
        if (!verdict) continue;
        applyVerdict(item, verdict);
        stats.enriched++;
      }
    }

    for (const item of touched) {
      const fresh = getItem(item.id) || item;
      const findings = fanOutItem(fresh);
      stats.findings += findings.length;
      for (const f of findings) stats.bySeverity[f.severity] = (stats.bySeverity[f.severity] || 0) + 1;
    }

    run('UPDATE runs SET finished_at = ?, ok = 1, stats = ? WHERE id = ?', nowIso(), toJson(stats), runId);
    log.info('poll cycle complete', { sources: stats.sources, newItems: stats.newItems, findings: stats.findings, failed: stats.failed });
    return stats;
  } catch (err) {
    run('UPDATE runs SET finished_at = ?, ok = 0, error = ?, stats = ? WHERE id = ?', nowIso(), err.message, toJson(stats), runId);
    log.error('poll cycle failed', { error: err.message });
    throw err;
  }
}

// A small sample of how any project uses this vendor, so the model can judge
// relevance without us shipping one customer's code into another's prompt.
function sampleUsage(vendorId) {
  const rows = one('SELECT project_id FROM inventory WHERE vendor_id = ? AND active = 1 LIMIT 1', vendorId);
  if (!rows) return [];
  return listInventory(rows.project_id, { vendorId }).slice(0, 25).map((r) => ({ kind: r.kind, value: r.value, file: r.file, line: r.line }));
}

export function applyVerdict(item, verdict) {
  const summary = verdict.summary || item.summary;
  const deadline = verdict.deadline || item.deadline_at;
  // The model can only raise or confirm severity through the score; the
  // heuristics keep the floor so a bad completion cannot silence an alert.
  let score = item.risk_score;
  if (verdict.breaking) score = Math.max(score, 60);
  if (verdict.severity === 'critical') score = Math.max(score, 85);
  else if (verdict.severity === 'high') score = Math.max(score, 65);
  run('UPDATE items SET summary = ?, deadline_at = ?, risk_score = ?, enriched = 1 WHERE id = ?',
    summary, deadline, score, item.id);
}

/**
 * Poll the sources of specific vendors now, ignoring the watch requirement.
 * A free scan of a public repo uses this to warm the shared pool: the first
 * person to scan a repo using an unwatched vendor pays for the fetch, and
 * everyone after them reads it from the database.
 */
export async function pollVendorSources(vendorIds, { limit = 12, concurrency = 4, minAgeMinutes = 30, fetchImpl = fetchUrl, now = Date.now() } = {}) {
  if (!vendorIds.length) return { sources: 0, newItems: 0, failed: 0 };
  const placeholders = vendorIds.map(() => '?').join(',');
  const rows = all(
    `SELECT s.*, v.slug AS vendor_slug, v.name AS vendor_name
     FROM sources s JOIN vendors v ON v.id = s.vendor_id
     WHERE s.vendor_id IN (${placeholders}) AND s.enabled = 1`,
    ...vendorIds
  );
  const fresh = (s) => s.last_polled_at && new Date(s.last_polled_at).getTime() > now - minAgeMinutes * 60000;
  const due = rows.filter((s) => !fresh(s) && s.failure_count < 4).slice(0, limit);

  const stats = { sources: due.length, newItems: 0, failed: 0, items: [] };
  const results = await mapLimit(due, concurrency, (source) => pollSource(source, { fetchImpl }));
  for (const r of results) {
    if (!r) continue;
    if (r.error) stats.failed++;
    stats.newItems += r.newItems;
    stats.items.push(...r.items);
  }
  return stats;
}

/** Re-check every source URL and report which ones are dead. Ops hygiene. */
export async function checkSources({ fetchImpl = fetchUrl, limit = 500 } = {}) {
  const sources = listSources().slice(0, limit);
  const report = [];
  await mapLimit(sources, 6, async (s) => {
    const res = await fetchImpl(s.url, {});
    report.push({ vendor: s.vendor_name, url: s.url, kind: s.kind, status: res.status, ok: res.ok, error: res.error });
  });
  report.sort((a, b) => Number(a.ok) - Number(b.ok) || String(a.vendor).localeCompare(String(b.vendor)));
  return report;
}

export { severityFor };
