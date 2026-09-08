import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';

await freshDb();
const {
  createAccount, authenticate, hashPassword, verifyPassword, createSession, accountForSession,
  destroySession, createApiKey, accountForApiKey, revokeApiKey, listApiKeys, withinProjectQuota, bumpUsage
} = await import('../src/store/accounts.js');
const { one, run } = await import('../src/db.js');

test('passwords are salted, hashed, and never stored in the clear', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.ok(!hash.includes('correct horse'));
  assert.ok(verifyPassword('correct horse battery staple', hash));
  assert.ok(!verifyPassword('wrong', hash));
  assert.notEqual(hashPassword('same'), hashPassword('same'), 'salts must differ');
});

test('authentication rejects unknown and wrong credentials', () => {
  createAccount({ email: 'a@example.com', password: 'password123' });
  assert.ok(authenticate('a@example.com', 'password123'));
  assert.equal(authenticate('a@example.com', 'nope'), null);
  assert.equal(authenticate('nobody@example.com', 'password123'), null);
  assert.ok(authenticate('A@EXAMPLE.COM', 'password123'), 'email should be case insensitive');
});

test('sessions resolve, expire and can be destroyed', () => {
  const account = createAccount({ email: 'b@example.com', password: 'password123' });
  const session = createSession(account.id);
  assert.equal(accountForSession(session.token).id, account.id);
  assert.equal(accountForSession('not-a-token'), null);

  run('UPDATE sessions SET expires_at = ?', new Date(Date.now() - 1000).toISOString());
  assert.equal(accountForSession(session.token), null, 'an expired session must not authenticate');

  const live = createSession(account.id);
  destroySession(live.token);
  assert.equal(accountForSession(live.token), null);
});

test('session tokens are stored hashed', () => {
  const account = createAccount({ email: 'c@example.com', password: 'password123' });
  const session = createSession(account.id);
  const row = one('SELECT id FROM sessions WHERE account_id = ?', account.id);
  assert.notEqual(row.id, session.token, 'the raw token must not be in the database');
});

test('API keys authenticate until revoked', () => {
  const account = createAccount({ email: 'd@example.com', password: 'password123' });
  const key = createApiKey(account.id, 'ci');
  assert.match(key.secret, /^sr_/);
  assert.equal(accountForApiKey(key.secret).id, account.id);
  assert.equal(accountForApiKey('sr_wrong'), null);
  assert.equal(accountForApiKey(''), null);

  const [row] = listApiKeys(account.id);
  revokeApiKey(account.id, row.id);
  assert.equal(accountForApiKey(key.secret), null, 'a revoked key must stop working');
});

test('plan quotas are enforced from the plan table', () => {
  const account = createAccount({ email: 'e@example.com', password: 'password123' });
  const quota = withinProjectQuota(account);
  assert.equal(quota.limit, 1);
  assert.ok(quota.ok);
});

test('usage accumulates per month', () => {
  const account = createAccount({ email: 'f@example.com', password: 'password123' });
  bumpUsage(account.id, 'scans', 2);
  bumpUsage(account.id, 'scans');
  const row = one('SELECT * FROM usage WHERE account_id = ?', account.id);
  assert.equal(row.scans, 3);
});
