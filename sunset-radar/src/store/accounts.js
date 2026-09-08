// Accounts, sessions, API keys. Password hashing is scrypt from node:crypto —
// no dependency, and the parameters are written into the stored hash so they
// can be raised later without breaking old rows.
import crypto from 'node:crypto';
import { all, one, run, nowIso } from '../db.js';
import { id, token, sha256 } from './ids.js';
import { config, planFor } from '../config.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 }).toString('hex');
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, N, r, p, salt, key] = stored.split('$');
  try {
    const candidate = crypto.scryptSync(password, salt, key.length / 2, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
    const expected = Buffer.from(key, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch { return false; }
}

export function createAccount({ email, password, name = null, plan = 'free' }) {
  const now = nowIso();
  const accountId = id('acct');
  run(
    `INSERT INTO accounts (id, email, name, password_hash, plan, status, created_at, updated_at, trial_ends_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    accountId, email.toLowerCase().trim(), name, password ? hashPassword(password) : null, plan, now, now,
    new Date(Date.now() + 14 * 86400000).toISOString()
  );
  return getAccount(accountId);
}

export const getAccount = (accountId) => one('SELECT * FROM accounts WHERE id = ?', accountId);
export const getAccountByEmail = (email) => one('SELECT * FROM accounts WHERE email = ?', String(email || '').toLowerCase().trim());
export const listAccounts = () => all('SELECT * FROM accounts ORDER BY created_at');

export function authenticate(email, password) {
  const account = getAccountByEmail(email);
  if (!account || !account.password_hash) return null;
  return verifyPassword(password, account.password_hash) ? account : null;
}

export function updateAccount(accountId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getAccount(accountId);
  const set = keys.map((k) => `${k} = ?`).join(', ');
  run(`UPDATE accounts SET ${set}, updated_at = ? WHERE id = ?`, ...keys.map((k) => fields[k]), nowIso(), accountId);
  return getAccount(accountId);
}

// --- sessions ------------------------------------------------------------

export function createSession(accountId, userAgent = null) {
  const sessionId = token(32);
  const expires = new Date(Date.now() + config.sessionTtlDays * 86400000).toISOString();
  run('INSERT INTO sessions (id, account_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)',
    sha256(sessionId), accountId, nowIso(), expires, (userAgent || '').slice(0, 200));
  return { token: sessionId, expiresAt: expires };
}

export function accountForSession(sessionToken) {
  if (!sessionToken) return null;
  const row = one('SELECT * FROM sessions WHERE id = ?', sha256(sessionToken));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE id = ?', row.id);
    return null;
  }
  return getAccount(row.account_id);
}

export const destroySession = (sessionToken) => run('DELETE FROM sessions WHERE id = ?', sha256(sessionToken || ''));
export const purgeExpiredSessions = () => run('DELETE FROM sessions WHERE expires_at < ?', nowIso());

// --- API keys ------------------------------------------------------------

export function createApiKey(accountId, name = 'default') {
  const secret = `sr_${token(24)}`;
  const prefix = secret.slice(0, 11);
  run('INSERT INTO api_keys (id, account_id, name, prefix, hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id('key'), accountId, name.slice(0, 60), prefix, sha256(secret), nowIso());
  return { secret, prefix, name };
}

export function accountForApiKey(secret) {
  if (!secret || !secret.startsWith('sr_')) return null;
  const row = one('SELECT * FROM api_keys WHERE prefix = ? AND revoked_at IS NULL', secret.slice(0, 11));
  if (!row) return null;
  const given = Buffer.from(sha256(secret));
  const known = Buffer.from(row.hash);
  if (given.length !== known.length || !crypto.timingSafeEqual(given, known)) return null;
  run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', nowIso(), row.id);
  return getAccount(row.account_id);
}

export const listApiKeys = (accountId) => all('SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE account_id = ? ORDER BY created_at DESC', accountId);
export const revokeApiKey = (accountId, keyId) => run('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND account_id = ?', nowIso(), keyId, accountId);

// --- quotas --------------------------------------------------------------

export function quotaFor(account) {
  return planFor(account?.plan || 'free');
}

export function withinProjectQuota(account) {
  const limit = quotaFor(account).projects;
  const used = one('SELECT COUNT(*) AS n FROM projects WHERE account_id = ?', account.id).n;
  return { ok: used < limit, used, limit };
}

export function withinVendorQuota(account, projectId) {
  const limit = quotaFor(account).vendors;
  const used = one('SELECT COUNT(*) AS n FROM watchlist WHERE project_id = ? AND muted = 0', projectId).n;
  return { ok: used < limit, used, limit };
}

export function bumpUsage(accountId, field, amount = 1) {
  const month = new Date().toISOString().slice(0, 7);
  run(`INSERT INTO usage (account_id, month, ${field}) VALUES (?, ?, ?)
       ON CONFLICT(account_id, month) DO UPDATE SET ${field} = ${field} + excluded.${field}`,
    accountId, month, amount);
}

export function recordAudit(accountId, action, detail = null, ip = null) {
  run('INSERT INTO audit_log (id, account_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id('aud'), accountId, action, detail ? JSON.stringify(detail).slice(0, 2000) : null, ip, nowIso());
}
