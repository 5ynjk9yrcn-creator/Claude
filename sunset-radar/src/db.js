// Thin wrapper over node:sqlite. SQLite is deliberate: this product is meant
// to run unattended on one small box for years without a DBA.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { log } from './log.js';
import { MIGRATIONS } from './migrations.js';

let db = null;

export function getDb() {
  if (db) return db;
  const dir = path.dirname(config.dbPath);
  if (config.dbPath !== ':memory:' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  return db;
}

export function closeDb() {
  if (db) { try { db.close(); } catch { /* already closed */ } db = null; }
}

export function migrate() {
  const d = getDb();
  d.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(d.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  let count = 0;
  for (const [name, sql] of MIGRATIONS) {
    if (applied.has(name)) continue;
    d.exec('BEGIN');
    try {
      d.exec(sql);
      d.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, nowIso());
      d.exec('COMMIT');
      count++;
      log.info('migration applied', { name });
    } catch (err) {
      d.exec('ROLLBACK');
      throw new Error(`migration ${name} failed: ${err.message}`);
    }
  }
  return count;
}

// --- small query helpers -------------------------------------------------
export const all = (sql, ...params) => getDb().prepare(sql).all(...params);
export const one = (sql, ...params) => getDb().prepare(sql).get(...params) ?? null;
export const run = (sql, ...params) => getDb().prepare(sql).run(...params);

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();

// JSON columns are stored as TEXT; these keep the call sites tidy.
export const toJson = (v) => (v === undefined || v === null ? null : JSON.stringify(v));
export const fromJson = (v, dflt = null) => {
  if (v === null || v === undefined || v === '') return dflt;
  try { return JSON.parse(v); } catch { return dflt; }
};

// Key/value store used for scheduler cursors and advisory locks.
export function kvGet(key, dflt = null) {
  const row = one('SELECT value FROM kv WHERE key = ?', key);
  return row ? fromJson(row.value, dflt) : dflt;
}
export function kvSet(key, value) {
  run('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    key, toJson(value), nowIso());
}
