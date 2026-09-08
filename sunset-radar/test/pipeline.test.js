import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { freshDb, fixture } from './helpers.js';

await freshDb();
const { createAccount } = await import('../src/store/accounts.js');
const { createProject, applyScan, listWatchlist, listInventory, inventorySummary } = await import('../src/store/projects.js');
const { scanRepo } = await import('../src/scan/scanner.js');
const { getVendorBySlug, addSource, duePolls, markSourcePolled } = await import('../src/store/catalog.js');
const { pollSource, pollCycle } = await import('../src/pipeline/poll.js');
const { listFindings, countFindings, setFindingStatus } = await import('../src/store/findings.js');

const account = createAccount({ email: 'pipe@example.com', password: 'password123' });
const project = createProject(account.id, { name: 'Acme', repoPath: fixture('sample-repo') });
applyScan(project.id, scanRepo(fixture('sample-repo')), { watchLimit: 100 });

const fakeFetch = (body, { status = 200, etag = 'W/"1"' } = {}) => async () => ({
  ok: status < 400, status, notModified: false, body, etag, lastModified: null, contentType: 'application/xml', url: 'x', error: status < 400 ? null : `HTTP ${status}`
});

test('a scan produces a watchlist and file-level inventory', () => {
  const watched = listWatchlist(project.id).filter((w) => !w.muted).map((w) => w.slug);
  assert.ok(watched.includes('stripe'));
  assert.ok(listInventory(project.id).length > 10);
  assert.ok(inventorySummary(project.id).some((v) => v.slug === 'openai'));
});

test('a rescan retires evidence that has left the code', () => {
  const before = listInventory(project.id).length;
  applyScan(project.id, { vendors: [], stats: {} }, { watchLimit: 100 });
  assert.equal(listInventory(project.id).length, 0, 'all evidence should be retired');
  applyScan(project.id, scanRepo(fixture('sample-repo')), { watchLimit: 100 });
  assert.equal(listInventory(project.id).length, before, 'and restored when the code comes back');
});

test('polling a feed creates items, and polling again creates none', async () => {
  const vendor = getVendorBySlug('stripe');
  const source = { ...addSource(vendor.id, { kind: 'rss', url: 'https://example.test/feed.xml' }), vendor_slug: 'stripe', vendor_name: 'Stripe' };
  const body = fs.readFileSync(fixture('sample-rss.xml'), 'utf8');

  const first = await pollSource(source, { fetchImpl: fakeFetch(body) });
  assert.equal(first.newItems, 2);

  const again = await pollSource({ ...source, content_hash: null }, { fetchImpl: fakeFetch(body) });
  assert.equal(again.newItems, 0, 'the same guids must not produce new items');
});

test('an unchanged body short-circuits before parsing', async () => {
  const vendor = getVendorBySlug('twilio');
  const source = { ...addSource(vendor.id, { kind: 'rss', url: 'https://example.test/twilio.xml' }), vendor_slug: 'twilio' };
  const body = '<rss><channel><item><title>Hi</title><guid>1</guid></item></channel></rss>';
  await pollSource(source, { fetchImpl: fakeFetch(body) });
  const reread = duePolls({ now: Date.now() + 86400000, defaultMinutes: 1 }).find((s) => s.url === source.url);
  const second = await pollSource(reread, { fetchImpl: fakeFetch(body) });
  assert.ok(second.skipped, 'identical content should be skipped');
});

test('a 304 is treated as success, a 500 as failure with backoff', async () => {
  const vendor = getVendorBySlug('slack');
  const source = { ...addSource(vendor.id, { kind: 'rss', url: 'https://example.test/slack.xml' }), vendor_slug: 'slack' };
  const notModified = await pollSource(source, { fetchImpl: async () => ({ ok: true, status: 304, notModified: true, body: '', etag: null, lastModified: null, contentType: '', url: 'x', error: null }) });
  assert.ok(notModified.skipped);
  const failed = await pollSource(source, { fetchImpl: fakeFetch('', { status: 500 }) });
  assert.equal(failed.error, 'HTTP 500');
  const row = duePolls({ now: Date.now(), defaultMinutes: 0 }).find((s) => s.url === source.url);
  assert.equal(row, undefined, 'a failing source should back off rather than be retried immediately');
});

test('items fan out into findings scored against this project', async () => {
  const stats = await pollCycle({ fetchImpl: fakeFetch(fs.readFileSync(fixture('sample-rss.xml'), 'utf8')), enrich: false, limit: 5 });
  assert.ok(stats.sources > 0);
  const findings = listFindings({ accountId: account.id });
  const charges = findings.find((f) => f.title.includes('/v1/charges'));
  assert.ok(charges, 'the charges deprecation should become a finding');
  assert.equal(charges.severity, 'critical');
  assert.ok(charges.matched_files >= 1);
  assert.ok(charges.impact.files.some((f) => f.file === 'src/billing.js'));
});

test('noise does not become a finding', () => {
  const findings = listFindings({ accountId: account.id, limit: 200 });
  assert.ok(!findings.some((f) => f.title === 'New dashboard filters'), 'a pure feature note should be filtered out');
});

test('findings can be acknowledged and counted', () => {
  const [first] = listFindings({ accountId: account.id, status: 'open' });
  const before = countFindings({ accountId: account.id }).total;
  setFindingStatus(first.id, 'acknowledged');
  assert.equal(countFindings({ accountId: account.id }).total, before - 1);
});
