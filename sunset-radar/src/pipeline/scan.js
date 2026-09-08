// Scanning a project: resolve the code (local path or git clone), build the
// inventory, then re-evaluate recent announcements against the new inventory
// so newly-detected usage immediately lights up existing findings.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { log } from '../log.js';
import { all, run, nowIso, toJson } from '../db.js';
import { id } from '../store/ids.js';
import { scanRepo } from '../scan/scanner.js';
import { applyScan, getProject, listWatchlist } from '../store/projects.js';
import { fanOutItem, getItem } from '../store/findings.js';
import { getAccount, quotaFor } from '../store/accounts.js';

const exec = promisify(execFile);

export async function resolveRepo(project) {
  if (project.repo_path && fs.existsSync(project.repo_path)) return { dir: project.repo_path, cloned: false };
  if (!project.repo_url) throw new Error('project has no readable repo_path and no repo_url');

  fs.mkdirSync(config.reposDir, { recursive: true });
  const dir = path.join(config.reposDir, project.id);
  const url = project.repo_url;
  if (!/^https:\/\/[\w.-]+\/[\w./~-]+$/.test(url)) throw new Error('repo_url must be an https git URL');

  if (fs.existsSync(path.join(dir, '.git'))) {
    await exec('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', project.default_branch || 'HEAD'], { timeout: 120000 });
    await exec('git', ['-C', dir, 'reset', '--hard', 'FETCH_HEAD'], { timeout: 60000 });
    return { dir, cloned: false, pulled: true };
  }
  await exec('git', ['clone', '--depth', '1', '--single-branch', url, dir], { timeout: 300000 });
  return { dir, cloned: true };
}

export async function scanProject(projectId, { autoWatch = true } = {}) {
  const project = getProject(projectId);
  if (!project) throw new Error(`no such project: ${projectId}`);
  const account = getAccount(project.account_id);
  const runId = id('run');
  run('INSERT INTO runs (id, kind, started_at) VALUES (?, ?, ?)', runId, 'scan', nowIso());

  try {
    const { dir, cloned } = await resolveRepo(project);
    const settings = project.settings || {};
    const result = scanRepo(dir, {
      extraSkip: settings.excludeDirs || [],
      detectThreshold: settings.detectThreshold ?? 0.5,
      maxFiles: settings.maxFiles ?? 20000
    });
    const summary = applyScan(projectId, result, { autoWatch, watchLimit: quotaFor(account).vendors });
    const refreshed = refreshFindings(projectId);

    const stats = { ...result.stats, ...summary, cloned, refreshed, dir };
    run('UPDATE runs SET finished_at = ?, ok = 1, stats = ? WHERE id = ?', nowIso(), toJson(stats), runId);
    log.info('scan complete', { project: projectId, vendors: summary.vendors, evidence: summary.evidence, watched: summary.watched });
    return { project: getProject(projectId), result, summary, stats };
  } catch (err) {
    run('UPDATE runs SET finished_at = ?, ok = 0, error = ? WHERE id = ?', nowIso(), err.message, runId);
    throw err;
  }
}

/**
 * Replay recent announcements for this project's watched vendors. Cheap, and
 * it means a first scan immediately shows the backlog that already applies.
 */
export function refreshFindings(projectId, { days = 400, limit = 800 } = {}) {
  const project = getProject(projectId);
  if (!project) return 0;
  const vendorIds = listWatchlist(projectId).filter((w) => !w.muted).map((w) => w.vendor_id);
  if (!vendorIds.length) return 0;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const placeholders = vendorIds.map(() => '?').join(',');
  const items = all(
    `SELECT id FROM items WHERE vendor_id IN (${placeholders}) AND COALESCE(published_at, created_at) >= ? ORDER BY risk_score DESC LIMIT ?`,
    ...vendorIds, since, limit
  );
  let created = 0;
  for (const row of items) {
    const item = getItem(row.id);
    if (!item) continue;
    created += fanOutItem(item, { projects: [project] }).length;
  }
  return created;
}
