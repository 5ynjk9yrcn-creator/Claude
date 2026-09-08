// The free scan: the front of the funnel. Unauthenticated, shareable, and
// deliberately limited to public repositories so nobody has to trust us with
// anything to try it.
import { router } from '../http/server.js';
import { config } from '../config.js';
import { log } from '../log.js';
import * as pages from '../ui/pages.js';
import {
  createPublicScan, runPublicScan, getPublicScan, parseRepoUrl,
  countRecentScansFrom, attachEmail, markViewed
} from '../pipeline/publicscan.js';

router.get('/scan', (ctx) => {
  ctx.html(pages.scanForm({ account: ctx.account, error: ctx.query.err || null, value: ctx.query.repo || '' }));
});

router.post('/scan', (ctx) => {
  const repo = ctx.body.repo || '';
  const parsed = parseRepoUrl(repo);
  if (!parsed.ok) return ctx.html(pages.scanForm({ account: ctx.account, error: parsed.error, value: repo }), 400);

  // Cloning costs CPU, disk and bandwidth, so anonymous scans are capped per
  // address on top of the request limiter.
  if (countRecentScansFrom(ctx.ip, 1) >= 6) {
    return ctx.html(pages.scanForm({ account: ctx.account, value: repo, error: 'That is a lot of scans from one place in an hour. Try again later, or self-host it and scan without limits.' }), 429);
  }

  const created = createPublicScan({ repoUrl: repo, ip: ctx.ip });
  if (!created.ok) return ctx.html(pages.scanForm({ account: ctx.account, error: created.error, value: repo }), 400);

  // Run it in the background: a big repo takes longer than a request should.
  if (!created.reused) {
    runPublicScan(created.scan.token).catch((err) => log.error('public scan crashed', { error: err.message }));
  }
  ctx.redirect(`/r/${created.scan.token}`);
}, { limit: 'publicscan' });

router.get('/r/:token', (ctx) => {
  const scan = getPublicScan(ctx.params.token);
  if (!scan) return ctx.html(pages.scanForm({ account: ctx.account, error: 'That report has expired or never existed.' }), 404);

  if (scan.status === 'queued' || scan.status === 'running') {
    // Nudge the queue along in case the process restarted mid-scan.
    if (scan.status === 'queued') runPublicScan(scan.token).catch(() => {});
    return ctx.html(pages.scanPending({ account: ctx.account, scan }), 200, { 'refresh': '3' });
  }
  markViewed(scan.token);
  ctx.html(pages.scanReport({ account: ctx.account, scan, saved: ctx.query.saved === '1' }));
});

router.post('/r/:token/email', (ctx) => {
  const scan = getPublicScan(ctx.params.token);
  if (!scan) return ctx.error('not found', 404);
  const email = String(ctx.body.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ctx.redirect(`/r/${scan.token}?err=1`);
  attachEmail(scan.token, email);
  log.info('scan email captured', { repo: scan.repo_name });
  ctx.redirect(`/r/${scan.token}?saved=1`);
}, { limit: 'write' });
