import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { freshDb, fixture } from './helpers.js';

await freshDb();
const { createAccount } = await import('../src/store/accounts.js');
const { createProject, applyScan } = await import('../src/store/projects.js');
const { scanRepo } = await import('../src/scan/scanner.js');
const { getVendorBySlug, addSource } = await import('../src/store/catalog.js');
const { upsertItem, fanOutItem, listFindings } = await import('../src/store/findings.js');
const { makeItem } = await import('../src/parse/feed.js');
const { createChannel, listChannels, recentDeliveries } = await import('../src/store/channels.js');
const { dispatchPending, sendDigests } = await import('../src/notify/dispatch.js');
const { plainText, slackPayload, webhookPayload, emailHtml, deadlineLabel } = await import('../src/notify/format.js');
const { buildMime, encodeHeader } = await import('../src/notify/email.js');

const account = createAccount({ email: 'notify@example.com', password: 'password123' });
const project = createProject(account.id, { name: 'Acme', repoPath: fixture('sample-repo') });
applyScan(project.id, scanRepo(fixture('sample-repo')), { watchLimit: 100 });

const vendor = getVendorBySlug('stripe');
const source = addSource(vendor.id, { kind: 'html', url: 'https://example.test/changelog' });

// Raise the finding lazily: a channel only carries what is found after it
// exists, so each test creates its channel before the finding it expects.
function raiseFinding(overrides = {}) {
  const { item } = upsertItem({ ...source, vendor_id: vendor.id }, makeItem({
    title: 'The /v1/charges endpoint will be removed',
    url: 'https://example.test/changelog#charges',
    guid: 'charges-removal',
    published: '2026-08-12',
    body: 'The /v1/charges endpoint is deprecated and will be removed on March 1, 2027. You must migrate to /v1/payment_intents.',
    ...overrides
  }));
  fanOutItem(item, { projects: [project] });
  return item;
}

// A tiny receiver stands in for Slack or a customer's endpoint.
function receiver() {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return { server, received, listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}/hook`))) };
}

test('a finding renders for every destination', () => {
  raiseFinding();
  const [finding] = listFindings({ accountId: account.id });
  assert.match(plainText(finding), /CRITICAL|HIGH/);
  assert.match(plainText(finding), /src\/billing\.js/);
  const slack = slackPayload(finding);
  assert.ok(slack.blocks.length >= 4);
  assert.ok(slack.text.includes('Stripe'));
  const hook = webhookPayload(finding);
  assert.equal(hook.event, 'finding.created');
  assert.equal(hook.vendor.slug, 'stripe');
  assert.ok(Number.isInteger(hook.days_until_deadline));
  assert.match(emailHtml([finding]), /<!doctype html>/);
});

test('deadline labels read in human terms', () => {
  const now = Date.parse('2026-09-01T00:00:00Z');
  assert.match(deadlineLabel('2026-09-21T00:00:00Z', now), /in 20 days/);
  assert.match(deadlineLabel('2026-08-01T00:00:00Z', now), /already in effect/);
  assert.equal(deadlineLabel(null), null);
});

test('webhook delivery is signed and verifiable', async (t) => {
  const r = receiver();
  const url = await r.listen();
  t.after(() => r.server.close());
  const channel = createChannel(account.id, { kind: 'webhook', target: url, minSeverity: 'low' });
  raiseFinding({
    guid: 'charges-removal-2',
    title: 'Removing the legacy charge creation flow',
    body: 'The /v1/charges endpoint is removed on March 1, 2027. You must migrate to /v1/payment_intents.'
  });

  const stats = await dispatchPending();
  assert.ok(stats.sent >= 1, `expected a delivery, got ${JSON.stringify(stats)}`);
  assert.equal(r.received.length, 1);

  const { headers, body } = r.received[0];
  const expected = crypto.createHmac('sha256', channel.secret).update(body).digest('hex');
  assert.equal(headers['x-sunsetradar-signature'], `sha256=${expected}`, 'signature must cover the exact bytes sent');
  const payload = JSON.parse(body);
  assert.equal(payload.vendor.slug, 'stripe');
  assert.ok(payload.impact.files.length >= 1);
});

test('the same finding is never delivered twice', async () => {
  const before = recentDeliveries(account.id).length;
  const stats = await dispatchPending();
  assert.equal(stats.sent, 0, 'nothing new should be sent on a second pass');
  assert.equal(recentDeliveries(account.id).length, before);
});

test('a channel severity floor filters out quieter findings', async (t) => {
  const r = receiver();
  const url = await r.listen();
  t.after(() => r.server.close());
  createChannel(account.id, { kind: 'webhook', target: url, minSeverity: 'critical' });

  const lowItem = upsertItem({ ...source, vendor_id: vendor.id }, makeItem({
    title: 'Dashboard tweak', guid: 'noise-1', url: 'https://example.test/x', published: '2026-08-20',
    body: 'Rate limits are changing slightly for the dashboard search view.'
  }));
  fanOutItem(lowItem.item, { projects: [project] });
  await dispatchPending();
  assert.equal(r.received.length, 0, 'a low severity finding must not reach a critical-only channel');
});

test('a backlog is not replayed into a newly created channel', async (t) => {
  const r = receiver();
  const url = await r.listen();
  t.after(() => r.server.close());
  raiseFinding({
    guid: 'charges-removal-backlog',
    title: 'Charges list pagination is being removed',
    body: 'The /v1/charges list endpoint drops offset pagination on March 1, 2027. You must migrate to cursors.'
  });
  // Backdate it: a real backlog is days old by the time a channel is added.
  const { run } = await import('../src/db.js');
  run("UPDATE findings SET created_at = ? WHERE notified_at IS NULL", new Date(Date.now() - 3 * 86400000).toISOString());
  createChannel(account.id, { kind: 'webhook', target: url, minSeverity: 'low' });
  await dispatchPending();
  assert.equal(r.received.length, 0, 'findings older than the channel stay on the dashboard only');
});

test('digests batch the window into one message', async (t) => {
  const r = receiver();
  const url = await r.listen();
  t.after(() => r.server.close());
  createChannel(account.id, { kind: 'webhook', target: url, minSeverity: 'low', digest: true });
  const stats = await sendDigests({ hours: 24 });
  assert.equal(stats.sent, 1);
  const payload = JSON.parse(r.received[0].body);
  assert.equal(payload.event, 'digest');
  assert.ok(payload.count >= 1);
});

test('MIME messages are well formed', () => {
  const raw = buildMime({ from: 'Radar <a@b.c>', to: 'd@e.f', subject: 'Stripe — removal', html: '<b>hi</b>', text: 'hi' });
  assert.match(raw, /^From: Radar <a@b\.c>/);
  assert.match(raw, /Content-Type: multipart\/alternative; boundary="/);
  assert.match(raw, /=\?UTF-8\?B\?/, 'non-ASCII subjects must be encoded');
  assert.equal(encodeHeader('plain ascii'), 'plain ascii');
});
