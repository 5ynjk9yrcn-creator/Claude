// Sending. Every alert goes through a claimed delivery row, so a crash mid
// cycle can never double-send and never silently drop.
import crypto from 'node:crypto';
import { log } from '../log.js';
import { config } from '../config.js';
import { severityRank } from '../analyze/risk.js';
import { unnotifiedFindings, markNotified, listFindings } from '../store/findings.js';
import { channelsFor, claimDelivery, completeDelivery, markChannelResult, getChannel } from '../store/channels.js';
import { bumpUsage } from '../store/accounts.js';
import { slackPayload, webhookPayload, plainText, emailHtml, emailSubject } from './format.js';
import { sendEmail } from './email.js';

export async function deliverToChannel(channel, finding) {
  switch (channel.kind) {
    case 'slack': {
      const res = await postJson(channel.target, slackPayload(finding));
      return res;
    }
    case 'webhook': {
      const payload = webhookPayload(finding);
      const body = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', channel.secret || '').update(body).digest('hex');
      return await postJson(channel.target, payload, {
        'x-sunsetradar-signature': `sha256=${signature}`,
        'x-sunsetradar-event': 'finding.created',
        'x-sunsetradar-delivery': finding.id
      });
    }
    case 'email': {
      const res = await sendEmail({
        to: channel.target,
        subject: emailSubject([finding]),
        html: emailHtml([finding], { title: `${finding.severity.toUpperCase()}: ${finding.vendor_name}` }),
        text: plainText(finding)
      });
      return res;
    }
    default:
      return { ok: false, error: `unknown channel kind ${channel.kind}` };
  }
}

async function postJson(url, payload, extraHeaders = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'user-agent': config.http.userAgent, ...extraHeaders },
      body: JSON.stringify(payload)
    });
    clearTimeout(timer);
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send everything that has not been sent. Returns per-channel counts.
 */
export async function dispatchPending({ limit = 200, dryRun = false } = {}) {
  const findings = unnotifiedFindings(limit);
  const stats = { findings: findings.length, sent: 0, failed: 0, skipped: 0, byKind: {} };

  for (const finding of findings) {
    const channels = channelsFor(finding.account_id, finding.project_id).filter((c) => !c.digest);
    let anyAttempt = false;

    for (const channel of channels) {
      if (severityRank(finding.severity) < severityRank(channel.min_severity)) { stats.skipped++; continue; }
      // A new channel must not replay the backlog: a first scan legitimately
      // surfaces years of history, and nobody wants 200 Slack messages for it.
      // A channel reports what is found after it exists; the dashboard keeps
      // the rest.
      if (finding.created_at < channel.created_at) { stats.skipped++; continue; }
      const deliveryId = claimDelivery(channel.id, finding.id, 'alert');
      if (!deliveryId) { stats.skipped++; continue; }
      anyAttempt = true;
      if (dryRun) { completeDelivery(deliveryId, true); stats.sent++; continue; }

      const res = await deliverToChannel(channel, finding);
      completeDelivery(deliveryId, res.ok, res.error);
      markChannelResult(channel.id, res.ok, res.error);
      stats.byKind[channel.kind] = (stats.byKind[channel.kind] || 0) + 1;
      if (res.ok) { stats.sent++; bumpUsage(finding.account_id, 'notifications'); }
      else { stats.failed++; log.warn('delivery failed', { channel: channel.kind, error: res.error }); }
    }

    // Mark the finding notified once it has been offered to every channel —
    // including when there are none, so the queue cannot grow forever.
    if (!anyAttempt || channels.length === 0) markNotified(finding.id);
    else markNotified(finding.id);
  }
  return stats;
}

/**
 * Digest: one message per digest channel covering the window, rather than one
 * per finding. This is what most teams actually leave switched on.
 */
export async function sendDigests({ accountIds = null, hours = 24, dryRun = false } = {}) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const stats = { channels: 0, sent: 0, failed: 0, empty: 0 };
  const { listAccounts } = await import('../store/accounts.js');
  const accounts = accountIds ? accountIds.map((id) => ({ id })) : listAccounts();

  for (const account of accounts) {
    const channels = channelsFor(account.id, null).filter((c) => c.digest);
    for (const channel of channels) {
      stats.channels++;
      const findings = listFindings({
        accountId: account.id,
        projectId: channel.project_id || null,
        status: 'open',
        minSeverity: channel.min_severity,
        limit: 25
      }).filter((f) => f.created_at >= since);

      if (!findings.length) { stats.empty++; continue; }
      const deliveryId = claimDelivery(channel.id, null, `digest:${since.slice(0, 13)}`);
      if (!deliveryId) continue;
      if (dryRun) { completeDelivery(deliveryId, true); stats.sent++; continue; }

      let res;
      if (channel.kind === 'email') {
        res = await sendEmail({
          to: channel.target,
          subject: emailSubject(findings),
          html: emailHtml(findings, { title: 'Your Sunset Radar digest', intro: `${findings.length} change${findings.length === 1 ? '' : 's'} in the last ${hours} hours.` }),
          text: findings.map((f) => plainText(f)).join('\n\n---\n\n')
        });
      } else if (channel.kind === 'slack') {
        res = await postJson(channel.target, {
          text: `Sunset Radar digest — ${findings.length} change${findings.length === 1 ? '' : 's'} need attention`,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: `Sunset Radar digest — ${findings.length} item${findings.length === 1 ? '' : 's'}` } },
            ...findings.slice(0, 12).map((f) => ({
              type: 'section',
              text: { type: 'mrkdwn', text: `*${f.severity.toUpperCase()}* · ${f.vendor_name}\n<${config.baseUrl}/findings/${f.id}|${f.title.slice(0, 140)}>${f.deadline_at ? `\n_Deadline ${f.deadline_at.slice(0, 10)}_` : ''}${f.matched_files ? ` · ${f.matched_files} file(s) affected` : ''}` }
            }))
          ]
        });
      } else {
        res = await postJson(channel.target, { event: 'digest', count: findings.length, findings: findings.map(webhookPayload) });
      }

      completeDelivery(deliveryId, res.ok, res.error);
      markChannelResult(channel.id, res.ok, res.error);
      res.ok ? stats.sent++ : stats.failed++;
    }
  }
  return stats;
}

/** Fire a synthetic alert so a user can prove a channel works. */
export async function sendTest(channelId) {
  const channel = getChannel(channelId);
  if (!channel) return { ok: false, error: 'no such channel' };
  const sample = {
    id: 'test',
    severity: 'high',
    score: 88,
    status: 'open',
    vendor_slug: 'stripe',
    vendor_name: 'Stripe',
    project_id: channel.project_id || 'test',
    project_name: 'Test project',
    title: 'Test alert: /v1/charges will be removed',
    summary: 'This is a test alert from Sunset Radar. If you can read this, the channel works.',
    url: 'https://docs.stripe.com/changelog',
    published_at: new Date().toISOString(),
    deadline_at: new Date(Date.now() + 45 * 86400000).toISOString(),
    matched_files: 2,
    impact: { files: [{ file: 'src/billing.js', lines: [42, 88] }, { file: 'src/webhooks.js', lines: [17] }], matches: [] },
    created_at: new Date().toISOString()
  };
  const res = await deliverToChannel(channel, sample);
  markChannelResult(channel.id, res.ok, res.error);
  return res;
}
