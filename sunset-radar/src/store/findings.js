// Items (what a vendor announced) and findings (what that means for one
// project). One item fans out to many findings — that is what makes the
// hosted version cheap to run: every source is fetched once for everybody.
import crypto from 'node:crypto';
import { all, one, run, nowIso, toJson, fromJson } from '../db.js';
import { id } from './ids.js';
import { scoreItem, extractDeadline, severityFor, severityRank, SEVERITIES } from '../analyze/risk.js';
import { mapImpact } from '../analyze/impact.js';
import { heuristicSummary } from '../analyze/llm.js';
import { listInventory, projectsWatching } from './projects.js';

/**
 * A stable key for "the same announcement", independent of which feed carried
 * it: the vendor plus the title reduced to its alphanumeric skeleton.
 */
export function dedupeKey(vendorId, title) {
  const skeleton = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);
  return crypto.createHash('sha256').update(`${vendorId}|${skeleton}`).digest('hex').slice(0, 24);
}

/**
 * Store a parsed announcement. Returns null when we have seen it before, so
 * callers can cheaply tell "new" from "already known".
 */
export function upsertItem(source, parsed) {
  const existing = one('SELECT * FROM items WHERE source_id = ? AND guid = ?', source.id, parsed.guid);
  const scored = scoreItem(parsed);
  const deadline = parsed.deadlineAt || extractDeadline(`${parsed.title}\n${parsed.body || ''}`);
  const summary = heuristicSummary(parsed, scored.signals);

  if (existing) {
    // Vendors edit changelog entries in place; a changed hash means the
    // announcement itself moved, so re-score it.
    if (existing.hash === parsed.hash) return { item: existing, isNew: false, changed: false };
    run(`UPDATE items SET title = ?, url = ?, body = ?, published_at = ?, hash = ?, risk_score = ?,
         categories = ?, signals = ?, deadline_at = ?, summary = ?, dedupe_key = ? WHERE id = ?`,
      parsed.title, parsed.url, parsed.body, parsed.publishedAt, parsed.hash, scored.score,
      toJson(scored.categories), toJson(scored.signals), deadline, summary,
      dedupeKey(source.vendor_id, parsed.title), existing.id);
    return { item: one('SELECT * FROM items WHERE id = ?', existing.id), isNew: false, changed: true };
  }

  const itemId = id('itm');
  run(`INSERT INTO items (id, source_id, vendor_id, guid, title, url, body, published_at, hash,
       risk_score, categories, signals, deadline_at, summary, enriched, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    itemId, source.id, source.vendor_id, parsed.guid, parsed.title, parsed.url, parsed.body,
    parsed.publishedAt, parsed.hash, scored.score, toJson(scored.categories), toJson(scored.signals),
    deadline, summary, dedupeKey(source.vendor_id, parsed.title), nowIso());
  return { item: one('SELECT * FROM items WHERE id = ?', itemId), isNew: true, changed: true };
}

export const getItem = (itemId) => hydrateItem(one('SELECT * FROM items WHERE id = ?', itemId));
const hydrateItem = (row) => (row ? { ...row, categories: fromJson(row.categories, []), signals: fromJson(row.signals, []) } : null);

export const recentItems = ({ limit = 50, vendorId = null, minScore = 0 } = {}) => {
  const clauses = ['i.risk_score >= ?'];
  const params = [minScore];
  if (vendorId) { clauses.push('i.vendor_id = ?'); params.push(vendorId); }
  return all(`SELECT i.*, v.name AS vendor_name, v.slug AS vendor_slug
              FROM items i JOIN vendors v ON v.id = i.vendor_id
              WHERE ${clauses.join(' AND ')}
              ORDER BY COALESCE(i.published_at, i.created_at) DESC LIMIT ?`, ...params, limit).map(hydrateItem);
};

/**
 * Fan one item out to every project watching that vendor, mapping impact
 * against each project's own inventory.
 *
 * @returns {Array} created findings
 */
export const STALE_ITEM_DAYS = 400;

export function fanOutItem(item, { minSeverity = 'low', projects = null, now = Date.now(), staleDays = STALE_ITEM_DAYS } = {}) {
  const targets = projects || projectsWatching(item.vendor_id);
  const created = [];
  const published = item.published_at ? new Date(item.published_at).getTime() : null;
  const stale = published !== null && published < now - staleDays * 86400000;

  for (const project of targets) {
    const settings = project.settings || {};
    const floor = settings.minSeverity || minSeverity;
    const inventory = listInventory(project.id, { vendorId: item.vendor_id });
    const impact = mapImpact({ title: item.title, body: item.body || '' }, inventory);
    const { severity, total } = severityFor({
      score: item.risk_score,
      matchedFiles: impact.matchedFiles,
      deadlineAt: item.deadline_at,
      now
    });

    if (severityRank(severity) < severityRank(floor)) continue;
    // Old news is only news if it still touches this codebase.
    if (stale && impact.matchedFiles === 0) continue;

    const existing = one('SELECT * FROM findings WHERE project_id = ? AND item_id = ?', project.id, item.id);

    // The same announcement carried by a second feed must not raise a second
    // finding for the same project.
    if (!existing && item.dedupe_key) {
      const twin = one(`SELECT f.id FROM findings f JOIN items i ON i.id = f.item_id
                        WHERE f.project_id = ? AND i.vendor_id = ? AND i.dedupe_key = ? AND f.item_id != ?`,
        project.id, item.vendor_id, item.dedupe_key, item.id);
      if (twin) continue;
    }
    const payload = {
      matches: impact.matches.slice(0, 40),
      files: impact.files.slice(0, 40),
      identifiers: {
        endpoints: impact.identifiers.endpoints.slice(0, 25),
        versions: impact.identifiers.versions.slice(0, 25),
        runtimes: impact.identifiers.runtimes.slice(0, 10)
      }
    };

    if (existing) {
      // Severity can move: a deadline gets closer, or a rescan finds new usage.
      if (existing.severity !== severity || existing.matched_files !== impact.matchedFiles) {
        run('UPDATE findings SET severity = ?, score = ?, impact = ?, matched_files = ?, deadline_at = ?, updated_at = ? WHERE id = ?',
          severity, total, toJson(payload), impact.matchedFiles, item.deadline_at, nowIso(), existing.id);
      }
      continue;
    }

    const findingId = id('fnd');
    run(`INSERT INTO findings (id, project_id, item_id, vendor_id, severity, score, impact, matched_files,
         deadline_at, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      findingId, project.id, item.id, item.vendor_id, severity, total, toJson(payload),
      impact.matchedFiles, item.deadline_at, nowIso(), nowIso());
    created.push(getFinding(findingId));
  }
  return created;
}

const FINDING_SELECT = `
  SELECT f.*, i.title, i.url, i.body, i.summary, i.published_at, i.categories, i.risk_score,
         v.name AS vendor_name, v.slug AS vendor_slug, p.name AS project_name, p.account_id
  FROM findings f
  JOIN items i ON i.id = f.item_id
  JOIN vendors v ON v.id = f.vendor_id
  JOIN projects p ON p.id = f.project_id`;

const hydrateFinding = (row) => (row ? { ...row, impact: fromJson(row.impact, { matches: [], files: [] }), categories: fromJson(row.categories, []) } : null);

export const getFinding = (findingId) => hydrateFinding(one(`${FINDING_SELECT} WHERE f.id = ?`, findingId));

export function listFindings({ accountId = null, projectId = null, status = null, minSeverity = null, limit = 100, offset = 0, vendorId = null, withDeadline = false } = {}) {
  const clauses = [];
  const params = [];
  if (accountId) { clauses.push('p.account_id = ?'); params.push(accountId); }
  if (projectId) { clauses.push('f.project_id = ?'); params.push(projectId); }
  if (vendorId) { clauses.push('f.vendor_id = ?'); params.push(vendorId); }
  if (status) { clauses.push('f.status = ?'); params.push(status); }
  if (withDeadline) clauses.push('f.deadline_at IS NOT NULL');
  if (minSeverity) {
    const allowed = SEVERITIES.slice(severityRank(minSeverity));
    clauses.push(`f.severity IN (${allowed.map(() => '?').join(',')})`);
    params.push(...allowed);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return all(`${FINDING_SELECT} ${where}
    ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
             CASE WHEN f.deadline_at IS NULL THEN 1 ELSE 0 END, f.deadline_at ASC, f.created_at DESC
    LIMIT ? OFFSET ?`, ...params, limit, offset).map(hydrateFinding);
}

export function countFindings({ accountId = null, projectId = null } = {}) {
  const clauses = ["f.status = 'open'"];
  const params = [];
  if (accountId) { clauses.push('p.account_id = ?'); params.push(accountId); }
  if (projectId) { clauses.push('f.project_id = ?'); params.push(projectId); }
  const rows = all(`SELECT f.severity, COUNT(*) AS n FROM findings f JOIN projects p ON p.id = f.project_id
                    WHERE ${clauses.join(' AND ')} GROUP BY f.severity`, ...params);
  const out = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
  for (const r of rows) { out[r.severity] = r.n; out.total += r.n; }
  return out;
}

export function setFindingStatus(findingId, status, { snoozedUntil = null } = {}) {
  run('UPDATE findings SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ?', status, snoozedUntil, nowIso(), findingId);
  return getFinding(findingId);
}

export const markNotified = (findingId) => run('UPDATE findings SET notified_at = ? WHERE id = ?', nowIso(), findingId);

/** Findings that have never been sent anywhere yet. */
export const unnotifiedFindings = (limit = 200) =>
  all(`${FINDING_SELECT} WHERE f.notified_at IS NULL AND f.status = 'open' ORDER BY f.created_at LIMIT ?`, limit).map(hydrateFinding);

/** Deadline calendar: what breaks, and when. */
export const upcomingDeadlines = ({ accountId = null, projectId = null, days = 365, limit = 50 } = {}) => {
  const clauses = ["f.status = 'open'", 'f.deadline_at IS NOT NULL', 'f.deadline_at <= ?'];
  const params = [new Date(Date.now() + days * 86400000).toISOString()];
  if (accountId) { clauses.push('p.account_id = ?'); params.push(accountId); }
  if (projectId) { clauses.push('f.project_id = ?'); params.push(projectId); }
  return all(`${FINDING_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY f.deadline_at ASC LIMIT ?`, ...params, limit).map(hydrateFinding);
};
