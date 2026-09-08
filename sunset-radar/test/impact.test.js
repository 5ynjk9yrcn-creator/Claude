import test from 'node:test';
import assert from 'node:assert/strict';
import { mapImpact, extractIdentifiers, matchRow } from '../src/analyze/impact.js';

const inventory = [
  { kind: 'endpoint', value: '/v1/charges', file: 'src/billing.js', line: 9, snippet: '' },
  { kind: 'endpoint', value: '/v1/customers', file: 'src/users.js', line: 3, snippet: '' },
  { kind: 'api_version', value: '2024-06-20', file: 'src/billing.js', line: 4, snippet: '' },
  { kind: 'symbol', value: 'text-embedding-ada-002', file: 'src/ai.js', line: 17, snippet: '' },
  { kind: 'symbol', value: 'stripe.charges.list', file: 'src/billing.js', line: 24, snippet: '' },
  { kind: 'package', value: 'npm:@supabase/supabase-js', file: 'package.json', line: 8, snippet: '' },
  { kind: 'action_pin', value: 'actions/checkout@v3', file: '.github/workflows/ci.yml', line: 7, snippet: '' },
  { kind: 'api_version', value: '18', file: 'Dockerfile', line: 1, snippet: '' }
];

test('maps an endpoint removal to the file that calls it', () => {
  const r = mapImpact({ title: 'Deprecating /v1/charges', body: 'The /v1/charges endpoint will be removed.' }, inventory);
  assert.equal(r.matchedFiles, 1);
  assert.equal(r.files[0].file, 'src/billing.js');
});

test('matches a pinned API version named in the announcement', () => {
  const r = mapImpact({ title: 'Version 2024-06-20 retired', body: 'Accounts on API version 2024-06-20 must upgrade.' }, inventory);
  assert.ok(r.matches.some((m) => m.kind === 'api_version' && m.value === '2024-06-20'));
});

test('matches bare hyphenated identifiers like model names', () => {
  const r = mapImpact({ title: 'Shutting down text-embedding-ada-002', body: 'The model is retired.' }, inventory);
  assert.ok(r.matches.some((m) => m.file === 'src/ai.js'));
});

test('matches a package by its short name', () => {
  const r = mapImpact({ title: 'supabase-js v3 released', body: 'BREAKING: supabase-js v3 drops the old overload.' }, inventory);
  assert.ok(r.matches.some((m) => m.kind === 'package'));
});

test('matches a pinned GitHub Action only on the same version', () => {
  const same = matchRow(inventory.find((r) => r.kind === 'action_pin'), extractIdentifiers('upgrade actions/checkout@v3 to v4'));
  assert.ok(same.score >= 0.9);
  const other = matchRow(inventory.find((r) => r.kind === 'action_pin'), extractIdentifiers('actions/checkout@v2 is affected'));
  assert.equal(other.score, 0);
});

test('matches a runtime version to a Dockerfile pin', () => {
  const r = mapImpact({ title: 'Node.js 18 is past end of life', body: 'Node 18 no longer receives security updates.' }, inventory);
  assert.ok(r.matches.some((m) => m.file === 'Dockerfile'));
});

test('does not match an unrelated announcement', () => {
  const r = mapImpact({ title: 'New dashboard filters', body: 'You can now filter by tag in the dashboard.' }, inventory);
  assert.equal(r.matchedFiles, 0);
});

test('does not match a sibling endpoint', () => {
  const r = mapImpact({ title: 'Refunds API update', body: 'The /v1/refunds endpoint gains a field.' }, inventory);
  assert.ok(!r.matches.some((m) => m.value === '/v1/charges'));
});

test('ignores ordinary hyphenated English as identifiers', () => {
  const ids = extractIdentifiers('This is a field-by-field, non-breaking, well-known change.');
  for (const bad of ['field-by-field', 'non-breaking', 'well-known']) {
    assert.ok(!ids.symbols.includes(bad), `${bad} should not be treated as an identifier`);
  }
});
