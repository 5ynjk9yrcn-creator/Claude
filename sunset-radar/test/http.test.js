import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, fixture } from './helpers.js';

await freshDb();
const { Router } = await import('../src/http/router.js');
const { createServer } = await import('../src/http/server.js');
const { createAccount, createApiKey } = await import('../src/store/accounts.js');
const { createProject, applyScan } = await import('../src/store/projects.js');
const { scanRepo } = await import('../src/scan/scanner.js');
const { verifyStripeSignature } = await import('../src/routes/billing.js');
await import('../src/routes/ui.js');
await import('../src/routes/api.js');
const crypto = await import('node:crypto');

const account = createAccount({ email: 'http@example.com', password: 'password123' });
const key = createApiKey(account.id, 'test').secret;
const project = createProject(account.id, { name: 'Acme', repoPath: fixture('sample-repo') });
applyScan(project.id, scanRepo(fixture('sample-repo')), { watchLimit: 100 });

const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const call = (path, options = {}) => fetch(base + path, { redirect: 'manual', ...options });
const auth = (path, options = {}) => call(path, { ...options, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...options.headers } });

test('router matches params and reports method mismatches', () => {
  const r = new Router();
  r.get('/findings/:id', () => {});
  assert.equal(r.match('GET', '/findings/abc').params.id, 'abc');
  assert.ok(r.match('POST', '/findings/abc').methodNotAllowed);
  assert.equal(r.match('GET', '/nope'), null);
});

test('public pages render and the health check reports state', async () => {
  const landing = await call('/');
  assert.equal(landing.status, 200);
  assert.match(await landing.text(), /Sunset Radar/);
  const health = await (await call('/healthz')).json();
  assert.equal(health.status, 'ok');
  assert.ok(health.sources > 0);
});

test('the app redirects anonymous browsers and 401s anonymous API calls', async () => {
  const page = await call('/dashboard');
  assert.equal(page.status, 302);
  assert.match(page.headers.get('location'), /\/login/);
  assert.equal((await call('/api/v1/findings')).status, 401);
  assert.equal((await call('/api/v1/findings', { headers: { authorization: 'Bearer sr_nope' } })).status, 401);
});

test('a session cookie signs the browser in', async () => {
  const res = await call('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'http@example.com', password: 'password123' }).toString()
  });
  assert.equal(res.status, 302);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('sr_session='));
  assert.ok(cookie, 'a session cookie should be set');
  assert.match(cookie, /HttpOnly/);

  const dash = await call('/dashboard', { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(dash.status, 200);
  assert.match(await dash.text(), /Radar/);
});

test('a wrong password does not sign anyone in', async () => {
  const res = await call('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'http@example.com', password: 'wrong' }).toString()
  });
  assert.equal(res.status, 401);
  assert.equal(res.headers.getSetCookie().length, 0);
});

test('the API exposes projects, inventory and findings', async () => {
  const me = await (await auth('/api/v1/me')).json();
  assert.equal(me.account.email, 'http@example.com');

  const projects = await (await auth('/api/v1/projects')).json();
  assert.equal(projects.projects.length, 1);

  const inv = await (await auth(`/api/v1/projects/${project.id}/inventory`)).json();
  assert.ok(inv.summary.some((v) => v.slug === 'stripe'));
  assert.ok(inv.evidence.some((e) => e.file === 'src/billing.js'));

  const findings = await (await auth('/api/v1/findings')).json();
  assert.ok(Array.isArray(findings.findings));

  const vendors = await (await auth('/api/v1/vendors')).json();
  assert.ok(vendors.vendors.length > 30);
});

test('one account cannot read another account‘s data', async () => {
  const other = createAccount({ email: 'other@example.com', password: 'password123' });
  const otherKey = createApiKey(other.id, 'k').secret;
  const res = await fetch(`${base}/api/v1/projects/${project.id}/inventory`, { headers: { authorization: `Bearer ${otherKey}` } });
  assert.equal(res.status, 404);
});

test('the API enforces plan quotas', async () => {
  const res = await auth('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name: 'Second', scan: false }) });
  assert.equal(res.status, 402, 'the free plan allows one project');
  const body = await res.json();
  assert.match(body.error, /quota/);
});

test('stripe webhook signatures are verified', () => {
  const secret = 'whsec_test';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.default.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  assert.ok(verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret));
  assert.ok(!verifyStripeSignature(payload, `t=${t},v1=${'0'.repeat(64)}`, secret), 'a wrong signature must fail');
  assert.ok(!verifyStripeSignature(payload, `t=${t - 8000},v1=${sig}`, secret), 'an old timestamp must fail');
  assert.ok(!verifyStripeSignature(payload, '', secret));
});

test('unknown routes 404 in the right format', async () => {
  assert.equal((await call('/api/v1/nope')).status, 404);
  const html = await call('/nope');
  assert.equal(html.status, 404);
  assert.match(html.headers.get('content-type'), /text\/html/);
});

test('repeated failed logins are rate limited', async () => {
  let limited = false;
  for (let i = 0; i < 30; i++) {
    const res = await call('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'nobody@example.com', password: 'x' }).toString()
    });
    if (res.status === 429) { limited = true; break; }
  }
  assert.ok(limited, 'brute force attempts should hit the limiter');
});
