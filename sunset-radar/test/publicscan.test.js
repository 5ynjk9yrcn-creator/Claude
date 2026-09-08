import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, fixture } from './helpers.js';

await freshDb();
const { parseRepoUrl, buildReport, createPublicScan, getPublicScan, countRecentScansFrom } = await import('../src/pipeline/publicscan.js');
const { scanRepo } = await import('../src/scan/scanner.js');
const { getVendorBySlug, addSource } = await import('../src/store/catalog.js');
const { upsertItem } = await import('../src/store/findings.js');
const { makeItem } = await import('../src/parse/feed.js');

function publish(slug, { title, body, published = '2026-08-01', demo = false }) {
  const vendor = getVendorBySlug(slug);
  const source = addSource(vendor.id, {
    kind: 'html',
    url: demo ? `demo://${slug}/x` : `https://example.test/${slug}/${Math.random().toString(36).slice(2)}`,
    enabled: !demo
  });
  return upsertItem({ ...source, vendor_id: vendor.id }, makeItem({ title, url: 'https://example.test/a', guid: title, published, body })).item;
}

test('only public repos on known hosts are accepted', () => {
  assert.equal(parseRepoUrl('https://github.com/acme/app').url, 'https://github.com/acme/app');
  assert.equal(parseRepoUrl('acme/app').url, 'https://github.com/acme/app', 'owner/repo shorthand');
  assert.equal(parseRepoUrl('https://github.com/acme/app.git').url, 'https://github.com/acme/app');
  for (const bad of ['git@github.com:acme/app.git', 'https://evil.example/a/b', 'http://github.com/a/b',
                     'https://user:pw@github.com/a/b', 'https://github.com/onlyowner', 'file:///etc/passwd', '']) {
    assert.equal(parseRepoUrl(bad).ok, false, `${bad} must be rejected`);
  }
});

test('a report names the integrations and the changes that apply', async () => {
  publish('stripe', {
    title: 'The /v1/charges endpoint will be removed',
    body: 'The /v1/charges endpoint is deprecated and will be removed on March 1, 2027. You must migrate to /v1/payment_intents.'
  });
  publish('stripe', { title: 'New dashboard filters', body: 'Filter by metadata. No action is required.' });

  const result = scanRepo(fixture('sample-repo'));
  const report = await buildReport({ repo: 'acme/checkout', repoUrl: 'https://github.com/acme/checkout', result, warm: false });

  assert.ok(report.summary.integrations >= 6);
  assert.ok(report.integrations.some((i) => i.slug === 'stripe'));

  const charges = report.findings.find((f) => f.title.includes('/v1/charges'));
  assert.ok(charges, 'the charges removal should appear');
  assert.equal(charges.severity, 'critical');
  assert.ok(charges.files.some((f) => f.file === 'src/billing.js'));
  assert.ok(!report.findings.some((f) => f.title === 'New dashboard filters'), 'noise stays out of the report');
});

test('one vendor cannot flood the report with changes that match nothing', async () => {
  for (const cycle of ['9.0', '8.2', '8.0', '7.4', '7.2']) {
    publish('redis', {
      title: `Redis ${cycle} reaches end of life on 2027-1${cycle[0] === '9' ? 1 : 0}-01`,
      body: `Redis release cycle ${cycle}. End of life: 2027-10-01. Plan the upgrade before this date; after it there are no security fixes.`,
      published: '2026-05-01'
    });
  }
  const result = scanRepo(fixture('sample-repo'));
  const report = await buildReport({ repo: 'acme/checkout', repoUrl: 'https://github.com/acme/checkout', result, warm: false });
  const redis = report.findings.filter((f) => f.vendorSlug === 'redis');
  assert.ok(redis.length <= 2, `expected at most two unmatched Redis rows, got ${redis.length}`);
});

test('demo data never reaches a public report', async () => {
  publish('twilio', { title: 'Demo-only pricing change is being removed', body: 'This will be removed on March 1, 2027. You must migrate.', demo: true });
  const result = scanRepo(fixture('sample-repo'));
  const report = await buildReport({ repo: 'acme/checkout', repoUrl: 'https://github.com/acme/checkout', result, warm: false });
  assert.ok(!report.findings.some((f) => f.title.includes('Demo-only')), 'demo rows are not real vendor announcements');
});

test('a distant deadline that matches nothing is not urgent', async () => {
  publish('postgresql', {
    title: 'PostgreSQL 19 reaches end of life on 2031-11-13',
    body: 'PostgreSQL release cycle 19. End of life: 2031-11-13. Plan the upgrade before this date.',
    published: '2026-06-01'
  });
  const result = scanRepo(fixture('sample-repo'));
  const report = await buildReport({ repo: 'acme/checkout', repoUrl: 'https://github.com/acme/checkout', result, warm: false });
  assert.ok(!report.findings.some((f) => f.title.includes('2031')), 'a 2031 deadline is not an outstanding change');
});

test('scans are recorded, deduplicated and attributable', () => {
  const first = createPublicScan({ repoUrl: 'https://github.com/acme/app', ip: '10.0.0.1' });
  assert.equal(first.ok, true);
  assert.equal(first.reused, false);
  assert.equal(getPublicScan(first.scan.token).repo_name, 'acme/app');
  assert.equal(countRecentScansFrom('10.0.0.1'), 1);

  const bad = createPublicScan({ repoUrl: 'ssh://nope', ip: '10.0.0.1' });
  assert.equal(bad.ok, false);
});
