import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freshDb } from './helpers.js';

await freshDb();
const { readRepoList, aggregate, toMarkdown, toCsv } = await import('../src/pipeline/bulk.js');

const report = (repo, over = {}) => ({
  repo, repoUrl: `https://github.com/${repo}`,
  summary: { integrations: 5, findings: 2, matched: 1, expired: 0, soonest: '2027-01-01T00:00:00Z', ...over.summary },
  integrations: over.integrations || [{ slug: 'stripe', name: 'Stripe', evidence: [{ kind: 'api_version', value: '2024-06-20' }] }],
  findings: over.findings || [{ vendorSlug: 'stripe', publishedAt: '2026-01-01T00:00:00Z', deadlineAt: '2026-07-01T00:00:00Z' }]
});

test('a repo list tolerates comments, shorthand and duplicates', () => {
  const file = path.join(os.tmpdir(), `repos-${Date.now()}.txt`);
  fs.writeFileSync(file, [
    '# a comment',
    'acme/app',
    'https://github.com/acme/app',      // same repo, different form
    'https://github.com/other/thing.git',
    'git@github.com:nope/nope.git',     // rejected
    '',
    'https://evil.example/a/b'          // rejected
  ].join('\n'));
  const repos = readRepoList(file);
  fs.rmSync(file, { force: true });
  assert.deepEqual(repos.map((r) => r.label), ['acme/app', 'other/thing']);
});

test('the aggregate answers the questions the post asks', () => {
  const agg = aggregate([
    report('a/one', { summary: { integrations: 6, findings: 3, matched: 2, expired: 1 } }),
    report('b/two', { summary: { integrations: 4, findings: 0, matched: 0, expired: 0 }, findings: [] }),
    report('c/three', { summary: { integrations: 2, findings: 1, matched: 0, expired: 1 } })
  ]);
  const h = agg.headline;
  assert.equal(h.reposScanned, 3);
  assert.equal(h.carryingAnyChange, 2);
  assert.equal(h.carryingExpiredDeadline, 2);
  assert.equal(h.carryingExpiredDeadlinePct, 66.7);
  assert.equal(h.medianIntegrations, 4);
  assert.equal(h.medianNoticeDays, 181, 'notice = deadline minus announcement date');
  assert.equal(agg.vendors[0].slug, 'stripe');
  assert.equal(agg.vendors[0].reposUsing, 3);
});

test('commit-SHA pins are left out of the exposure table', () => {
  const agg = aggregate([report('a/one', {
    integrations: [{ slug: 'github', name: 'GitHub', evidence: [
      { kind: 'action_pin', value: 'actions/checkout@v3' },
      { kind: 'action_pin', value: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1' }
    ] }]
  })]);
  const values = agg.exposures.map((e) => e.value);
  assert.ok(values.includes('actions/checkout@v3'));
  assert.ok(!values.some((v) => /[0-9a-f]{40}/.test(v)), 'a SHA pin is deliberate, not an exposure');
});

test('the post states the claims and the method', () => {
  const md = toMarkdown(aggregate([report('a/one', { summary: { integrations: 6, findings: 3, matched: 2, expired: 1 } })]));
  assert.match(md, /# The Deprecation Report/);
  assert.match(md, /public repositories scanned/);
  assert.match(md, /past a deadline that has already come and gone/);
  assert.match(md, /## Method/);
  assert.match(md, /a floor, not a ceiling/, 'the limits of static analysis are stated, not buried');
});

test('the lead list is valid CSV', () => {
  const csv = toCsv(aggregate([report('a/one'), report('b,quoted"repo')]));
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'repository,url,integrations,outstanding_changes,code_matched,past_deadline,next_deadline');
  assert.equal(lines.length, 3);
  assert.ok(lines.some((l) => l.startsWith('"b,quoted""repo"')), 'commas and quotes are escaped');
});
