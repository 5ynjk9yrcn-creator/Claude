import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreItem, extractDeadline, severityFor, severityRank } from '../src/analyze/risk.js';

const NOW = new Date('2026-09-01T00:00:00Z').getTime();

test('scores a removal announcement far above a feature announcement', () => {
  const removal = scoreItem({ title: 'Deprecating the /v1/charges endpoint', body: 'It will be removed. You must migrate.' });
  const feature = scoreItem({ title: 'New dashboard filters', body: 'You can now filter by tag. No action needed.' });
  assert.ok(removal.score > 60, `removal scored ${removal.score}`);
  assert.ok(feature.score < 20, `feature scored ${feature.score}`);
  assert.ok(removal.categories.includes('removal'));
});

test('"no action required" pulls a score down', () => {
  const loud = scoreItem({ title: 'Rate limit changes', body: 'Rate limits are changing.' });
  const quiet = scoreItem({ title: 'Rate limit changes', body: 'Rate limits are changing. No action is required.' });
  assert.ok(quiet.score < loud.score);
});

test('a signal in the title counts double', () => {
  const inTitle = scoreItem({ title: 'Breaking change to webhooks', body: 'Details follow.' });
  const inBody = scoreItem({ title: 'Webhook update', body: 'This is a breaking change.' });
  assert.ok(inTitle.score > inBody.score);
});

test('extracts the date a change takes effect', () => {
  assert.equal(extractDeadline('will be removed on March 1, 2027.', { now: NOW }).slice(0, 10), '2027-03-01');
  assert.equal(extractDeadline('Effective on 2027-01-15 the model is retired.', { now: NOW }).slice(0, 10), '2027-01-15');
  assert.equal(extractDeadline('starting 3 November 2026 limits apply', { now: NOW }).slice(0, 10), '2026-11-03');
});

test('prefers the soonest future deadline', () => {
  const text = 'Deprecated after 2027-06-01, but disabled on 2026-11-01.';
  assert.equal(extractDeadline(text, { now: NOW }).slice(0, 10), '2026-11-01');
});

test('does not invent deadlines from unrelated dates', () => {
  assert.equal(extractDeadline('Published 2026-01-02. Some new features.', { now: NOW }), null);
});

test('impact and imminence drive severity', () => {
  const base = { score: 70, now: NOW };
  assert.equal(severityFor({ ...base, matchedFiles: 0 }).severity, 'high');
  assert.equal(severityFor({ ...base, matchedFiles: 3 }).severity, 'critical');
  const far = severityFor({ score: 100, matchedFiles: 0, deadlineAt: '2028-01-01T00:00:00Z', now: NOW });
  assert.equal(far.severity, 'high', 'a distant change with no code match is not an emergency');
  const near = severityFor({ score: 100, matchedFiles: 0, deadlineAt: '2026-09-20T00:00:00Z', now: NOW });
  assert.equal(near.severity, 'critical');
});

test('severity ordering is stable', () => {
  assert.ok(severityRank('critical') > severityRank('high'));
  assert.ok(severityRank('high') > severityRank('medium'));
  assert.ok(severityRank('low') > severityRank('info'));
});
