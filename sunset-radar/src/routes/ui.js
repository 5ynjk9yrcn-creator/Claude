// Browser-facing routes. Forms post, we redirect with a flash in the query
// string — no client-side state, no JSON round trips.
import { router } from '../http/server.js';
import { config, PLANS } from '../config.js';
import { all, one, kvGet } from '../db.js';
import * as pages from '../ui/pages.js';
import {
  createAccount, authenticate, createSession, destroySession, getAccountByEmail,
  createApiKey, listApiKeys, revokeApiKey, withinProjectQuota, recordAudit, quotaFor
} from '../store/accounts.js';
import { createProject, listProjects, getProjectFor, inventorySummary, listWatchlist, listInventory, watchVendor, muteVendor } from '../store/projects.js';
import { listFindings, countFindings, getFinding, setFindingStatus, upcomingDeadlines } from '../store/findings.js';
import { listSources } from '../store/catalog.js';
import { createChannel, listChannels, deleteChannel, getChannel } from '../store/channels.js';
import { sendTest } from '../notify/dispatch.js';
import { scanProject } from '../pipeline/scan.js';
import { log } from '../log.js';

const flashFrom = (ctx) => (ctx.query.ok ? { kind: 'ok', message: ctx.query.ok } : ctx.query.err ? { kind: 'err', message: ctx.query.err } : null);
const back = (ctx, path, message, kind = 'ok') => ctx.redirect(`${path}?${kind}=${encodeURIComponent(message)}`);

// --- public --------------------------------------------------------------

router.get('/', (ctx) => (ctx.account ? ctx.redirect('/dashboard') : ctx.html(pages.landing())));
router.get('/docs', (ctx) => ctx.html(pages.docs()));

router.get('/healthz', (ctx) => {
  const lastPoll = kvGet('last_poll_at');
  ctx.json({
    status: 'ok',
    version: '1.0.0',
    uptime_s: Math.round(process.uptime()),
    last_poll_at: lastPoll,
    sources: one('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1').n,
    failing_sources: one('SELECT COUNT(*) AS n FROM sources WHERE failure_count > 2').n,
    open_findings: one("SELECT COUNT(*) AS n FROM findings WHERE status = 'open'").n
  });
});

router.get('/login', (ctx) => (ctx.account ? ctx.redirect('/dashboard') : ctx.html(pages.login({ next: ctx.query.next || '/dashboard', error: ctx.query.err }))), { limit: 'auth' });

router.post('/login', (ctx) => {
  const { email = '', password = '', next = '/dashboard' } = ctx.body;
  const account = authenticate(email, password);
  if (!account) {
    recordAudit(null, 'login.failed', { email }, ctx.ip);
    return ctx.html(pages.login({ error: 'Wrong email or password.', email, next }), 401);
  }
  const session = createSession(account.id, ctx.req.headers['user-agent']);
  ctx.setCookie('sr_session', session.token);
  recordAudit(account.id, 'login', null, ctx.ip);
  ctx.redirect(next.startsWith('/') ? next : '/dashboard');
}, { limit: 'auth' });

router.get('/signup', (ctx) => {
  if (ctx.account) return ctx.redirect('/dashboard');
  if (!config.signupsOpen) return ctx.html(pages.login({ error: 'Signups are closed on this install.' }), 403);
  ctx.html(pages.signup({ plan: ctx.query.plan || 'free' }));
}, { limit: 'auth' });

router.post('/signup', async (ctx) => {
  if (!config.signupsOpen) return ctx.error('signups are closed', 403);
  const { email = '', password = '', project = 'My app', repo_path = '', plan = 'free' } = ctx.body;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ctx.html(pages.signup({ error: 'That email does not look right.', email }), 400);
  if (String(password).length < 8) return ctx.html(pages.signup({ error: 'Use at least 8 characters.', email }), 400);
  if (getAccountByEmail(email)) return ctx.html(pages.signup({ error: 'That email already has an account.', email }), 409);

  const account = createAccount({ email, password, plan: PLANS[plan] ? plan : 'free' });
  const created = createProject(account.id, { name: project || 'My app', repoPath: repo_path || null });
  const session = createSession(account.id, ctx.req.headers['user-agent']);
  ctx.setCookie('sr_session', session.token);
  recordAudit(account.id, 'signup', { plan }, ctx.ip);

  if (repo_path) {
    try { await scanProject(created.id); } catch (err) { log.warn('signup scan failed', { error: err.message }); }
  }
  ctx.redirect('/dashboard?ok=' + encodeURIComponent('Account created. Scan your repo to fill the radar.'));
}, { limit: 'auth' });

router.post('/logout', (ctx) => {
  if (ctx.cookies.sr_session) destroySession(ctx.cookies.sr_session);
  ctx.clearCookie('sr_session');
  ctx.redirect('/');
});

// --- app -----------------------------------------------------------------

router.get('/dashboard', (ctx) => {
  const projects = listProjects(ctx.account.id);
  ctx.html(pages.dashboard({
    account: ctx.account,
    counts: countFindings({ accountId: ctx.account.id }),
    findings: listFindings({ accountId: ctx.account.id, status: 'open', limit: 40 }),
    projects,
    watchedVendors: one('SELECT COUNT(DISTINCT w.vendor_id) AS n FROM watchlist w JOIN projects p ON p.id = w.project_id WHERE p.account_id = ? AND w.muted = 0', ctx.account.id).n,
    lastPoll: kvGet('last_poll_at'),
    flash: flashFrom(ctx)
  }));
}, { auth: true });

router.get('/projects/new', (ctx) => ctx.html(pages.newProject({ account: ctx.account, error: ctx.query.err })), { auth: true });

router.post('/projects', async (ctx) => {
  const quota = withinProjectQuota(ctx.account);
  if (!quota.ok) return back(ctx, '/dashboard', `Your plan allows ${quota.limit} project(s). Upgrade to add more.`, 'err');
  const { name = '', repo_path = '', repo_url = '' } = ctx.body;
  if (!name.trim()) return back(ctx, '/projects/new', 'A name is required.', 'err');
  const project = createProject(ctx.account.id, { name: name.trim(), repoPath: repo_path.trim() || null, repoUrl: repo_url.trim() || null });
  try {
    if (repo_path || repo_url) await scanProject(project.id);
  } catch (err) {
    return back(ctx, `/projects/${project.id}`, `Project created, but the scan failed: ${err.message}`, 'err');
  }
  back(ctx, `/projects/${project.id}`, 'Project created and scanned.');
}, { auth: true, limit: 'write' });

router.get('/projects/:id', (ctx) => {
  const project = getProjectFor(ctx.account.id, ctx.params.id);
  if (!project) return ctx.html('<h1>Not found</h1>', 404);
  ctx.html(pages.projectPage({
    account: ctx.account,
    project,
    inventory: inventorySummary(project.id),
    watchlist: listWatchlist(project.id),
    findings: listFindings({ projectId: project.id, status: 'open', limit: 60 }),
    counts: countFindings({ projectId: project.id }),
    flash: flashFrom(ctx)
  }));
}, { auth: true });

router.post('/projects/:id/scan', async (ctx) => {
  const project = getProjectFor(ctx.account.id, ctx.params.id);
  if (!project) return ctx.error('not found', 404);
  try {
    const { summary } = await scanProject(project.id);
    back(ctx, `/projects/${project.id}`, `Scan complete: ${summary.vendors} vendors, ${summary.evidence} signals, ${summary.watched} new watches.`);
  } catch (err) {
    back(ctx, `/projects/${project.id}`, `Scan failed: ${err.message}`, 'err');
  }
}, { auth: true, limit: 'write' });

router.post('/projects/:id/watch', (ctx) => {
  const project = getProjectFor(ctx.account.id, ctx.params.id);
  if (!project) return ctx.error('not found', 404);
  watchVendor(project.id, ctx.body.vendor_id, 'manual');
  back(ctx, `/projects/${project.id}`, 'Now watching that vendor.');
}, { auth: true, limit: 'write' });

router.post('/projects/:id/mute', (ctx) => {
  const project = getProjectFor(ctx.account.id, ctx.params.id);
  if (!project) return ctx.error('not found', 404);
  muteVendor(project.id, ctx.body.vendor_id);
  back(ctx, `/projects/${project.id}`, 'Vendor muted.');
}, { auth: true, limit: 'write' });

router.get('/findings/:id', (ctx) => {
  const finding = getFinding(ctx.params.id);
  if (!finding || finding.account_id !== ctx.account.id) return ctx.html('<h1>Not found</h1>', 404);
  ctx.html(pages.findingPage({
    account: ctx.account,
    finding,
    inventory: listInventory(finding.project_id, { vendorId: finding.vendor_id }),
    flash: flashFrom(ctx)
  }));
}, { auth: true });

router.post('/findings/:id/status', (ctx) => {
  const finding = getFinding(ctx.params.id);
  if (!finding || finding.account_id !== ctx.account.id) return ctx.error('not found', 404);
  const status = ['open', 'acknowledged', 'resolved', 'ignored', 'snoozed'].includes(ctx.body.status) ? ctx.body.status : 'open';
  setFindingStatus(finding.id, status);
  back(ctx, `/findings/${finding.id}`, `Marked ${status}.`);
}, { auth: true, limit: 'write' });

router.get('/deadlines', (ctx) => {
  ctx.html(pages.deadlinesPage({ account: ctx.account, deadlines: upcomingDeadlines({ accountId: ctx.account.id, days: 900, limit: 100 }) }));
}, { auth: true });

router.get('/inventory', (ctx) => {
  const projects = listProjects(ctx.account.id);
  const inventories = {};
  for (const p of projects) inventories[p.id] = inventorySummary(p.id);
  ctx.html(pages.inventoryPage({ account: ctx.account, projects, inventories }));
}, { auth: true });

router.get('/sources', (ctx) => {
  ctx.html(pages.sourcesPage({
    account: ctx.account,
    sources: listSources(),
    runs: all('SELECT * FROM runs ORDER BY started_at DESC LIMIT 15')
  }));
}, { auth: true });

// --- settings ------------------------------------------------------------

router.get('/settings', (ctx) => {
  const month = new Date().toISOString().slice(0, 7);
  ctx.html(pages.settingsPage({
    account: ctx.account,
    channels: listChannels(ctx.account.id),
    apiKeys: listApiKeys(ctx.account.id),
    newKey: ctx.query.key || null,
    quota: { projects: withinProjectQuota(ctx.account), plan: quotaFor(ctx.account) },
    usage: one('SELECT * FROM usage WHERE account_id = ? AND month = ?', ctx.account.id, month),
    flash: flashFrom(ctx)
  }));
}, { auth: true });

router.post('/settings/channels', (ctx) => {
  const { kind, target, min_severity = 'medium', digest = '0' } = ctx.body;
  if (!target) return back(ctx, '/settings', 'A target is required.', 'err');
  if (kind !== 'email' && !/^https:\/\//.test(target)) return back(ctx, '/settings', 'Webhook targets must be https URLs.', 'err');
  try {
    createChannel(ctx.account.id, { kind, target, minSeverity: min_severity, digest: digest === '1' });
    back(ctx, '/settings', 'Channel added. Send a test to confirm it works.');
  } catch (err) {
    back(ctx, '/settings', err.message, 'err');
  }
}, { auth: true, limit: 'write' });

router.post('/settings/channels/:id/test', async (ctx) => {
  const channel = getChannel(ctx.params.id);
  if (!channel || channel.account_id !== ctx.account.id) return ctx.error('not found', 404);
  const res = await sendTest(channel.id);
  back(ctx, '/settings', res.ok ? 'Test sent.' : `Test failed: ${res.error}`, res.ok ? 'ok' : 'err');
}, { auth: true, limit: 'write' });

router.post('/settings/channels/:id/delete', (ctx) => {
  deleteChannel(ctx.account.id, ctx.params.id);
  back(ctx, '/settings', 'Channel deleted.');
}, { auth: true, limit: 'write' });

router.post('/settings/keys', (ctx) => {
  const keys = listApiKeys(ctx.account.id).filter((k) => !k.revoked_at);
  if (keys.length >= quotaFor(ctx.account).apiKeys) return back(ctx, '/settings', 'Key limit reached for your plan.', 'err');
  const created = createApiKey(ctx.account.id, ctx.body.name || 'default');
  recordAudit(ctx.account.id, 'apikey.create', { name: created.name }, ctx.ip);
  ctx.redirect(`/settings?key=${encodeURIComponent(created.secret)}`);
}, { auth: true, limit: 'write' });

router.post('/settings/keys/:id/revoke', (ctx) => {
  revokeApiKey(ctx.account.id, ctx.params.id);
  back(ctx, '/settings', 'Key revoked.');
}, { auth: true, limit: 'write' });
