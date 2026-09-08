import test from 'node:test';
import assert from 'node:assert/strict';
import { scanRepo, scoreConfidence } from '../src/scan/scanner.js';
import { fixture } from './helpers.js';

const repo = fixture('sample-repo');

test('detects the vendors a repo actually uses', () => {
  const { vendors } = scanRepo(repo);
  const detected = vendors.filter((v) => v.detected).map((v) => v.slug);
  for (const slug of ['stripe', 'openai', 'slack', 'twilio', 'supabase', 'nodejs', 'github', 'docker']) {
    assert.ok(detected.includes(slug), `expected ${slug} to be detected, got ${detected.join(', ')}`);
  }
});

test('does not invent vendors the repo never mentions', () => {
  const { vendors } = scanRepo(repo);
  const detected = vendors.filter((v) => v.detected).map((v) => v.slug);
  for (const slug of ['shopify', 'salesforce', 'zendesk', 'algolia', 'plaid']) {
    assert.ok(!detected.includes(slug), `${slug} should not be detected`);
  }
});

test('records file and line evidence for every signal', () => {
  const { vendors } = scanRepo(repo);
  const stripe = vendors.find((v) => v.slug === 'stripe');
  const endpoint = stripe.evidence.find((e) => e.kind === 'endpoint' && e.value === '/v1/charges');
  assert.ok(endpoint, 'expected the /v1/charges endpoint to be recorded');
  assert.equal(endpoint.file, 'src/billing.js');
  assert.ok(endpoint.line > 0);

  const version = stripe.evidence.find((e) => e.kind === 'api_version' && e.value === '2024-06-20');
  assert.ok(version, 'expected the pinned Stripe-Version to be recorded');
});

test('picks up runtime pins from Dockerfile, manifest and CI config', () => {
  const { vendors } = scanRepo(repo);
  const node = vendors.find((v) => v.slug === 'nodejs');
  const files = new Set(node.evidence.map((e) => e.file));
  assert.ok(files.has('Dockerfile'));
  assert.ok(files.has('.github/workflows/ci.yml'));
  const gh = vendors.find((v) => v.slug === 'github');
  assert.ok(gh.evidence.some((e) => e.kind === 'action_pin' && e.value === 'actions/checkout@v3'));
});

test('evidence in prose counts for less than evidence in code', () => {
  const codeOnly = scoreConfidence({ weights: { host: 1 }, counts: { host: 1 } });
  const docOnly = scoreConfidence({ weights: { host: 0.3 }, counts: { host: 1 } });
  assert.ok(codeOnly > docOnly);
});

test('a bare environment variable name is never enough on its own', () => {
  const envOnly = scoreConfidence({ weights: { env: 8 }, counts: { env: 8 } });
  assert.ok(envOnly < 0.5, `env-only confidence should stay below the auto-watch bar, got ${envOnly}`);
});

test('skips vendored, build and binary paths', () => {
  const { stats } = scanRepo(repo);
  assert.ok(stats.files > 0 && stats.files < 50);
});
