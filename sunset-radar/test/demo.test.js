import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';

await freshDb();
const { seedDemo } = await import('../src/demo.js');
const { listFindings, upcomingDeadlines } = await import('../src/store/findings.js');
const { tick } = await import('../src/scheduler.js');

test('the demo seed produces a realistic radar', async () => {
  const out = await seedDemo();
  assert.ok(out.summary.vendors >= 8, `expected the sample repo to reveal several vendors, got ${out.summary.vendors}`);
  assert.ok(out.findings >= 6, `expected findings, got ${out.findings}`);
  assert.ok(out.bySeverity.critical >= 1);

  const findings = listFindings({ status: 'open' });
  const charges = findings.find((f) => f.title.includes('/v1/charges'));
  assert.equal(charges.severity, 'critical');
  assert.ok(charges.impact.files.some((f) => f.file === 'src/billing.js'));

  const node = findings.find((f) => f.vendor_slug === 'nodejs');
  assert.ok(node.matched_files >= 2, 'the Node 18 EOL should hit the Dockerfile and CI config');

  assert.ok(!findings.some((f) => f.title.includes('app icon guidelines')), 'pure noise should be filtered');
});

test('deadlines are ordered soonest first', async () => {
  const deadlines = upcomingDeadlines({ days: 2000 });
  const dates = deadlines.map((d) => d.deadline_at);
  assert.deepEqual(dates, [...dates].sort());
});

test('a scheduler tick runs every job without throwing', async () => {
  const results = await tick({ now: new Date('2026-09-01T03:00:00Z') });
  assert.ok(results.poll, 'the poll job should report stats');
  assert.ok(results.dispatch, 'the dispatch job should report stats');
  assert.equal(typeof results.rescan, 'number');
});
