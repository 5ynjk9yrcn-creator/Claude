// JSON API. Same engine as the UI, addressed with an API key — this is what
// customers wire into CI, dashboards, and their own tooling.
import { router } from '../http/server.js';
import { CATALOG_VERSION } from '../catalog/vendors.js';
import { PLANS } from '../config.js';
import { all, one } from '../db.js';
import { withinProjectQuota, quotaFor } from '../store/accounts.js';
import { createProject, listProjects, getProjectFor, listInventory, inventorySummary, listWatchlist, deleteProject } from '../store/projects.js';
import { listFindings, getFinding, setFindingStatus, countFindings, upcomingDeadlines } from '../store/findings.js';
import { listVendors, listSources } from '../store/catalog.js';
import { scanProject } from '../pipeline/scan.js';
import { listChannels, createChannel, deleteChannel } from '../store/channels.js';

const opts = { auth: true, api: true };

const publicFinding = (f) => ({
  id: f.id,
  severity: f.severity,
  score: f.score,
  status: f.status,
  title: f.title,
  summary: f.summary,
  vendor: { slug: f.vendor_slug, name: f.vendor_name },
  project: { id: f.project_id, name: f.project_name },
  announcement_url: f.url,
  published_at: f.published_at,
  deadline_at: f.deadline_at,
  matched_files: f.matched_files,
  files: (f.impact?.files || []).map((x) => ({ file: x.file, lines: x.lines })),
  categories: f.categories,
  created_at: f.created_at
});

router.get('/api/v1/me', (ctx) => {
  const plan = quotaFor(ctx.account);
  ctx.json({
    account: { id: ctx.account.id, email: ctx.account.email, plan: ctx.account.plan, created_at: ctx.account.created_at },
    limits: plan,
    usage: one('SELECT * FROM usage WHERE account_id = ? AND month = ?', ctx.account.id, new Date().toISOString().slice(0, 7)) || {},
    counts: countFindings({ accountId: ctx.account.id }),
    catalog_version: CATALOG_VERSION
  });
}, opts);

router.get('/api/v1/projects', (ctx) => {
  ctx.json({
    projects: listProjects(ctx.account.id).map((p) => ({
      id: p.id, name: p.name, repo_path: p.repo_path, repo_url: p.repo_url,
      last_scan_at: p.last_scan_at, last_scan_stats: p.last_scan_stats,
      counts: countFindings({ projectId: p.id })
    }))
  });
}, opts);

router.post('/api/v1/projects', async (ctx) => {
  const quota = withinProjectQuota(ctx.account);
  if (!quota.ok) return ctx.json({ error: 'project quota exceeded', limit: quota.limit, upgrade: Object.values(PLANS).filter((p) => p.projects > quota.limit).map((p) => p.id) }, 402);
  const { name, repo_path = null, repo_url = null, scan = true } = ctx.body;
  if (!name) return ctx.error('name is required');
  const project = createProject(ctx.account.id, { name, repoPath: repo_path, repoUrl: repo_url });
  let scanResult = null;
  if (scan && (repo_path || repo_url)) {
    try { scanResult = (await scanProject(project.id)).summary; }
    catch (err) { return ctx.json({ project, scan_error: err.message }, 201); }
  }
  ctx.json({ project, scan: scanResult }, 201);
}, { ...opts, limit: 'write' });

router.delete('/api/v1/projects/:id', (ctx) => {
  if (!getProjectFor(ctx.account.id, ctx.params.id)) return ctx.error('not found', 404);
  deleteProject(ctx.account.id, ctx.params.id);
  ctx.json({ deleted: true });
}, opts);

router.post('/api/v1/projects/:id/scan', async (ctx) => {
  const project = getProjectFor(ctx.account.id, ctx.params.id);
  if (!project) return ctx.error('not found', 404);
  try {
    const { summary, stats } = await scanProject(project.id);
    ctx.json({ ok: true, summary, stats });
  } catch (err) {
    ctx.json({ ok: false, error: err.message }, 422);
  }
}, { ...opts, limit: 'write' });

router.get('/api/v1/projects/:id/inventory', (ctx) => {
  const project = getProjectFor(ctx.account.id, ctx.params.id);
  if (!project) return ctx.error('not found', 404);
  ctx.json({
    summary: inventorySummary(project.id),
    watchlist: listWatchlist(project.id).map((w) => ({ vendor: w.slug, name: w.name, muted: !!w.muted, origin: w.origin, sources: w.sources })),
    evidence: listInventory(project.id).map((i) => ({ vendor: i.vendor_slug, kind: i.kind, value: i.value, file: i.file, line: i.line, confidence: i.confidence }))
  });
}, opts);

router.get('/api/v1/findings', (ctx) => {
  const findings = listFindings({
    accountId: ctx.account.id,
    projectId: ctx.query.project_id || null,
    status: ctx.query.status || null,
    minSeverity: ctx.query.min_severity || null,
    withDeadline: ctx.query.with_deadline === 'true',
    limit: Math.min(parseInt(ctx.query.limit, 10) || 50, 200),
    offset: parseInt(ctx.query.offset, 10) || 0
  });
  ctx.json({ count: findings.length, findings: findings.map(publicFinding) });
}, opts);

router.get('/api/v1/findings/:id', (ctx) => {
  const finding = getFinding(ctx.params.id);
  if (!finding || finding.account_id !== ctx.account.id) return ctx.error('not found', 404);
  ctx.json({ finding: { ...publicFinding(finding), body: finding.body, impact: finding.impact } });
}, opts);

router.patch('/api/v1/findings/:id', (ctx) => {
  const finding = getFinding(ctx.params.id);
  if (!finding || finding.account_id !== ctx.account.id) return ctx.error('not found', 404);
  const status = ctx.body.status;
  if (!['open', 'acknowledged', 'resolved', 'ignored', 'snoozed'].includes(status)) return ctx.error('invalid status');
  ctx.json({ finding: publicFinding(setFindingStatus(finding.id, status, { snoozedUntil: ctx.body.snoozed_until || null })) });
}, opts);

router.get('/api/v1/deadlines', (ctx) => {
  const days = Math.min(parseInt(ctx.query.days, 10) || 180, 2000);
  const findings = upcomingDeadlines({ accountId: ctx.account.id, days, limit: 200 });
  ctx.json({ days, count: findings.length, deadlines: findings.map(publicFinding) });
}, opts);

router.get('/api/v1/vendors', (ctx) => {
  const sources = listSources();
  ctx.json({
    catalog_version: CATALOG_VERSION,
    vendors: listVendors().map((v) => ({
      slug: v.slug, name: v.name, category: v.category, homepage: v.homepage,
      sources: sources.filter((s) => s.vendor_id === v.id).map((s) => ({ kind: s.kind, url: s.url, last_polled_at: s.last_polled_at, last_status: s.last_status, failures: s.failure_count }))
    }))
  });
}, opts);

router.get('/api/v1/channels', (ctx) => {
  ctx.json({ channels: listChannels(ctx.account.id).map((c) => ({ id: c.id, kind: c.kind, target: c.target, min_severity: c.min_severity, digest: !!c.digest, enabled: !!c.enabled, last_ok_at: c.last_ok_at, last_error: c.last_error })) });
}, opts);

router.post('/api/v1/channels', (ctx) => {
  const { kind, target, min_severity = 'medium', digest = false, project_id = null } = ctx.body;
  if (!kind || !target) return ctx.error('kind and target are required');
  try {
    const channel = createChannel(ctx.account.id, { kind, target, minSeverity: min_severity, digest, projectId: project_id });
    ctx.json({ channel: { id: channel.id, kind: channel.kind, target: channel.target, secret: channel.secret } }, 201);
  } catch (err) { ctx.error(err.message); }
}, { ...opts, limit: 'write' });

router.delete('/api/v1/channels/:id', (ctx) => {
  deleteChannel(ctx.account.id, ctx.params.id);
  ctx.json({ deleted: true });
}, opts);

router.get('/api/v1/runs', (ctx) => {
  ctx.json({ runs: all('SELECT id, kind, started_at, finished_at, ok, stats, error FROM runs ORDER BY started_at DESC LIMIT 25') });
}, opts);
