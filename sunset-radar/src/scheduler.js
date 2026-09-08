// The autopilot. One interval, a few jobs, each guarded so a slow job can
// never overlap itself. This is what makes the product run without an
// operator: polling, rescanning, alerting and housekeeping all happen here.
import { config, PLANS } from './config.js';
import { log } from './log.js';
import { all, one, kvGet, kvSet, run, nowIso } from './db.js';
import { pollCycle } from './pipeline/poll.js';
import { scanProject } from './pipeline/scan.js';
import { dispatchPending, sendDigests } from './notify/dispatch.js';
import { sweepRateLimits } from './http/ratelimit.js';
import { purgeExpiredSessions } from './store/accounts.js';
import { listAllProjects } from './store/projects.js';

let timer = null;
const inFlight = new Set();

async function job(name, fn) {
  if (inFlight.has(name)) { log.debug('job still running, skipping', { name }); return; }
  inFlight.add(name);
  try {
    await fn();
  } catch (err) {
    log.error('job failed', { name, error: err.message });
  } finally {
    inFlight.delete(name);
  }
}

/** The fastest polling cadence any paying account is entitled to. */
export function pollFloorMinutes() {
  const plans = all('SELECT DISTINCT plan FROM accounts WHERE status = ?', 'active').map((r) => PLANS[r.plan]?.pollMinutes ?? PLANS.free.pollMinutes);
  return plans.length ? Math.min(...plans) : PLANS.free.pollMinutes;
}

export async function tick({ now = new Date() } = {}) {
  const results = {};

  await job('poll', async () => {
    const floor = pollFloorMinutes();
    const stats = await pollCycle({ limit: 30, defaultMinutes: floor });
    kvSet('last_poll_at', nowIso());
    results.poll = stats;
  });

  await job('dispatch', async () => {
    results.dispatch = await dispatchPending({ limit: 100 });
  });

  // Digest once a day, at the configured UTC hour.
  await job('digest', async () => {
    const stamp = now.toISOString().slice(0, 10);
    if (now.getUTCHours() !== config.scheduler.digestHourUtc) return;
    if (kvGet('last_digest_day') === stamp) return;
    results.digest = await sendDigests({ hours: 24 });
    kvSet('last_digest_day', stamp);
  });

  // Rescan repos so the inventory tracks the code as it changes.
  await job('rescan', async () => {
    const cutoff = new Date(Date.now() - config.scheduler.rescanHours * 3600000).toISOString();
    const due = listAllProjects().filter((p) => (p.repo_path || p.repo_url) && (!p.last_scan_at || p.last_scan_at < cutoff)).slice(0, 3);
    for (const project of due) {
      try { await scanProject(project.id); }
      catch (err) { log.warn('rescan failed', { project: project.id, error: err.message }); }
    }
    results.rescan = due.length;
  });

  await job('housekeeping', async () => {
    sweepRateLimits();
    purgeExpiredSessions();
    // Keep the run log from growing forever.
    run("DELETE FROM runs WHERE started_at < ?", new Date(Date.now() - 30 * 86400000).toISOString());
  });

  return results;
}

export function startScheduler() {
  if (!config.scheduler.enabled) { log.info('scheduler disabled'); return null; }
  const intervalMs = Math.max(15, config.scheduler.tickSeconds) * 1000;
  log.info('scheduler started', { tick_seconds: config.scheduler.tickSeconds, poll_floor_minutes: pollFloorMinutes() });
  // Kick once shortly after boot so a fresh install fills in without waiting.
  const warmup = setTimeout(() => tick().catch((e) => log.error('warmup tick failed', { error: e.message })), 4000);
  warmup.unref?.();
  timer = setInterval(() => { tick().catch((err) => log.error('tick failed', { error: err.message })); }, intervalMs);
  return timer;
}

export function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}
