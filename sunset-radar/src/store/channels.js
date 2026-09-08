// Alert channels. A channel belongs to an account and may be scoped to one
// project; severity floors are per channel so an on-call Slack room can take
// only criticals while email takes everything.
import { all, one, run, nowIso } from '../db.js';
import { id, token } from './ids.js';

export const CHANNEL_KINDS = ['slack', 'webhook', 'email'];

export function createChannel(accountId, { kind, target, projectId = null, minSeverity = 'medium', digest = 0 }) {
  if (!CHANNEL_KINDS.includes(kind)) throw new Error(`unknown channel kind: ${kind}`);
  const channelId = id('chn');
  run(`INSERT INTO channels (id, account_id, project_id, kind, target, min_severity, digest, secret, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    channelId, accountId, projectId, kind, target.slice(0, 500), minSeverity, digest ? 1 : 0, token(18), nowIso());
  return getChannel(channelId);
}

export const getChannel = (channelId) => one('SELECT * FROM channels WHERE id = ?', channelId);
export const listChannels = (accountId) => all('SELECT * FROM channels WHERE account_id = ? ORDER BY created_at', accountId);
export const deleteChannel = (accountId, channelId) => run('DELETE FROM channels WHERE id = ? AND account_id = ?', channelId, accountId);
export const setChannelEnabled = (accountId, channelId, enabled) =>
  run('UPDATE channels SET enabled = ? WHERE id = ? AND account_id = ?', enabled ? 1 : 0, channelId, accountId);

export const channelsFor = (accountId, projectId) =>
  all('SELECT * FROM channels WHERE account_id = ? AND enabled = 1 AND (project_id IS NULL OR project_id = ?)', accountId, projectId);

export function markChannelResult(channelId, ok, error = null) {
  if (ok) run('UPDATE channels SET last_ok_at = ?, last_error = NULL WHERE id = ?', nowIso(), channelId);
  else run('UPDATE channels SET last_error = ? WHERE id = ?', String(error || '').slice(0, 400), channelId);
}

// A delivery row per (channel, finding, kind) makes retries idempotent: we
// never send the same alert twice, even if a cycle dies halfway through.
export function claimDelivery(channelId, findingId, kind = 'alert') {
  const existing = one('SELECT * FROM deliveries WHERE channel_id = ? AND finding_id IS ? AND kind = ?', channelId, findingId, kind);
  if (existing && existing.status === 'sent') return null;
  if (existing) {
    if (existing.attempts >= 5) return null;
    run('UPDATE deliveries SET attempts = attempts + 1 WHERE id = ?', existing.id);
    return existing.id;
  }
  const deliveryId = id('dlv');
  run('INSERT INTO deliveries (id, channel_id, finding_id, kind, status, attempts, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    deliveryId, channelId, findingId, kind, 'pending', nowIso());
  return deliveryId;
}

export function completeDelivery(deliveryId, ok, error = null) {
  if (ok) run('UPDATE deliveries SET status = ?, delivered_at = ?, last_error = NULL WHERE id = ?', 'sent', nowIso(), deliveryId);
  else run('UPDATE deliveries SET status = ?, last_error = ? WHERE id = ?', 'failed', String(error || '').slice(0, 400), deliveryId);
}

export const recentDeliveries = (accountId, limit = 50) => all(`
  SELECT d.*, c.kind AS channel_kind, c.target FROM deliveries d
  JOIN channels c ON c.id = d.channel_id
  WHERE c.account_id = ? ORDER BY d.created_at DESC LIMIT ?`, accountId, limit);
