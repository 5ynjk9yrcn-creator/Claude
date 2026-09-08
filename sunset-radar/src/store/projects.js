// Projects, their scanned inventory, and the vendor watchlist derived from it.
import { all, one, run, tx, nowIso, toJson, fromJson } from '../db.js';
import { id } from './ids.js';
import { getVendorBySlug } from './catalog.js';

export function createProject(accountId, { name, repoPath = null, repoUrl = null, defaultBranch = 'main', settings = {} }) {
  const projectId = id('prj');
  const now = nowIso();
  run('INSERT INTO projects (id, account_id, name, repo_path, repo_url, default_branch, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    projectId, accountId, name.slice(0, 120), repoPath, repoUrl, defaultBranch, toJson(settings), now, now);
  return getProject(projectId);
}

export const getProject = (projectId) => hydrate(one('SELECT * FROM projects WHERE id = ?', projectId));
export const getProjectFor = (accountId, projectId) => hydrate(one('SELECT * FROM projects WHERE id = ? AND account_id = ?', projectId, accountId));
export const listProjects = (accountId) => all('SELECT * FROM projects WHERE account_id = ? ORDER BY created_at', accountId).map(hydrate);
export const listAllProjects = () => all('SELECT * FROM projects ORDER BY created_at').map(hydrate);
export const deleteProject = (accountId, projectId) => run('DELETE FROM projects WHERE id = ? AND account_id = ?', projectId, accountId);

function hydrate(row) {
  if (!row) return null;
  return { ...row, settings: fromJson(row.settings, {}), last_scan_stats: fromJson(row.last_scan_stats, null) };
}

export function updateProject(projectId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getProject(projectId);
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => (k === 'settings' ? toJson(fields[k]) : fields[k]));
  run(`UPDATE projects SET ${set}, updated_at = ? WHERE id = ?`, ...values, nowIso(), projectId);
  return getProject(projectId);
}

/**
 * Persist a scan result: upsert every piece of evidence, retire evidence that
 * has disappeared from the code, and open a watch on every confident vendor.
 */
export function applyScan(projectId, scanResult, { autoWatch = true, watchLimit = Infinity } = {}) {
  const now = nowIso();
  const summary = { vendors: 0, evidence: 0, retired: 0, watched: 0, skippedOverQuota: 0, unknownVendors: [] };

  tx(() => {
    const seen = new Set();
    for (const v of scanResult.vendors) {
      const vendor = getVendorBySlug(v.slug);
      if (!vendor) { summary.unknownVendors.push(v.slug); continue; }
      summary.vendors++;
      for (const e of v.evidence) {
        const key = [projectId, vendor.id, e.kind, e.value, e.file || '', e.line ?? 0].join('|');
        seen.add(key);
        const existing = one(
          'SELECT id FROM inventory WHERE project_id = ? AND vendor_id = ? AND kind = ? AND value = ? AND file IS ? AND line IS ?',
          projectId, vendor.id, e.kind, e.value, e.file ?? null, e.line ?? null
        );
        if (existing) {
          run('UPDATE inventory SET last_seen = ?, active = 1, snippet = ?, confidence = ? WHERE id = ?', now, e.snippet || null, e.confidence ?? 1, existing.id);
        } else {
          run(`INSERT INTO inventory (id, project_id, vendor_id, kind, value, file, line, snippet, confidence, first_seen, last_seen, active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            id('inv'), projectId, vendor.id, e.kind, e.value, e.file ?? null, e.line ?? null, e.snippet || null, e.confidence ?? 1, now, now);
        }
        summary.evidence++;
      }

      if (autoWatch && v.detected) {
        const already = one('SELECT id FROM watchlist WHERE project_id = ? AND vendor_id = ?', projectId, vendor.id);
        if (!already) {
          const watching = one('SELECT COUNT(*) AS n FROM watchlist WHERE project_id = ? AND muted = 0', projectId).n;
          if (watching >= watchLimit) { summary.skippedOverQuota++; continue; }
          run('INSERT INTO watchlist (id, project_id, vendor_id, origin, muted, created_at) VALUES (?, ?, ?, ?, 0, ?)',
            id('wat'), projectId, vendor.id, 'scan', now);
          summary.watched++;
        }
      }
    }

    // Evidence not seen in this scan is retired, not deleted: history matters
    // when a finding points at a line that has since moved.
    const stale = all('SELECT id, last_seen FROM inventory WHERE project_id = ? AND active = 1 AND last_seen < ?', projectId, now);
    for (const row of stale) { run('UPDATE inventory SET active = 0 WHERE id = ?', row.id); summary.retired++; }
  });

  updateProject(projectId, { last_scan_at: now, last_scan_stats: toJson({ ...scanResult.stats, ...summary }) });
  return summary;
}

export const listInventory = (projectId, { vendorId = null, activeOnly = true } = {}) => {
  const clauses = ['i.project_id = ?'];
  const params = [projectId];
  if (vendorId) { clauses.push('i.vendor_id = ?'); params.push(vendorId); }
  if (activeOnly) clauses.push('i.active = 1');
  return all(`SELECT i.*, v.slug AS vendor_slug, v.name AS vendor_name
              FROM inventory i JOIN vendors v ON v.id = i.vendor_id
              WHERE ${clauses.join(' AND ')} ORDER BY v.name, i.kind, i.value`, ...params);
};

export const inventorySummary = (projectId) => all(`
  SELECT v.id AS vendor_id, v.slug, v.name, v.category,
         COUNT(*) AS evidence,
         COUNT(DISTINCT i.file) AS files,
         MAX(i.confidence) AS confidence,
         (SELECT COUNT(*) FROM watchlist w WHERE w.project_id = i.project_id AND w.vendor_id = v.id AND w.muted = 0) AS watched,
         (SELECT COUNT(*) FROM sources s WHERE s.vendor_id = v.id AND s.enabled = 1) AS sources
  FROM inventory i JOIN vendors v ON v.id = i.vendor_id
  WHERE i.project_id = ? AND i.active = 1
  GROUP BY v.id ORDER BY watched DESC, evidence DESC`, projectId);

// --- watchlist -----------------------------------------------------------

export const listWatchlist = (projectId) => all(`
  SELECT w.*, v.slug, v.name, v.category,
         (SELECT COUNT(*) FROM sources s WHERE s.vendor_id = v.id AND s.enabled = 1) AS sources
  FROM watchlist w JOIN vendors v ON v.id = w.vendor_id
  WHERE w.project_id = ? ORDER BY v.name`, projectId);

export const projectsWatching = (vendorId) => all(`
  SELECT p.*, w.muted FROM watchlist w JOIN projects p ON p.id = w.project_id
  WHERE w.vendor_id = ? AND w.muted = 0`, vendorId).map(hydrate);

export function watchVendor(projectId, vendorId, origin = 'manual') {
  const existing = one('SELECT * FROM watchlist WHERE project_id = ? AND vendor_id = ?', projectId, vendorId);
  if (existing) { run('UPDATE watchlist SET muted = 0 WHERE id = ?', existing.id); return existing.id; }
  const watchId = id('wat');
  run('INSERT INTO watchlist (id, project_id, vendor_id, origin, muted, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    watchId, projectId, vendorId, origin, nowIso());
  return watchId;
}
export const muteVendor = (projectId, vendorId) => run('UPDATE watchlist SET muted = 1 WHERE project_id = ? AND vendor_id = ?', projectId, vendorId);
