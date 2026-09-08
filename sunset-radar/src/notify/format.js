// One finding, rendered for each destination. The shape of the message is the
// product: severity, the deadline, and the files the reader has to touch.
import { config } from '../config.js';

const EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' };

export const daysUntil = (iso, now = Date.now()) => (iso ? Math.round((new Date(iso).getTime() - now) / 86400000) : null);

export function deadlineLabel(iso, now = Date.now()) {
  if (!iso) return null;
  const days = daysUntil(iso, now);
  const date = iso.slice(0, 10);
  if (days < 0) return `${date} (${Math.abs(days)} days ago — already in effect)`;
  if (days === 0) return `${date} (today)`;
  return `${date} (in ${days} day${days === 1 ? '' : 's'})`;
}

export function findingUrl(finding) {
  return `${config.baseUrl}/findings/${finding.id}`;
}

export function plainText(finding, { now = Date.now() } = {}) {
  const lines = [];
  lines.push(`[${finding.severity.toUpperCase()}] ${finding.vendor_name}: ${finding.title}`);
  if (finding.summary) lines.push('', finding.summary);
  const dl = deadlineLabel(finding.deadline_at, now);
  if (dl) lines.push('', `Deadline: ${dl}`);
  const files = finding.impact?.files || [];
  if (files.length) {
    lines.push('', `Your code (${finding.matched_files} file${finding.matched_files === 1 ? '' : 's'}):`);
    for (const f of files.slice(0, 8)) lines.push(`  - ${f.file}${f.lines?.length ? ':' + f.lines.slice(0, 4).join(',') : ''}`);
    if (files.length > 8) lines.push(`  …and ${files.length - 8} more`);
  } else {
    lines.push('', 'No direct match in your scanned code — flagged because you use this vendor.');
  }
  lines.push('', `Project: ${finding.project_name}`);
  if (finding.url) lines.push(`Announcement: ${finding.url}`);
  lines.push(`Details: ${findingUrl(finding)}`);
  return lines.join('\n');
}

export function slackPayload(finding, { now = Date.now() } = {}) {
  const dl = deadlineLabel(finding.deadline_at, now);
  const files = finding.impact?.files || [];
  const fields = [
    { type: 'mrkdwn', text: `*Severity*\n${EMOJI[finding.severity] || ''} ${finding.severity}` },
    { type: 'mrkdwn', text: `*Vendor*\n${finding.vendor_name}` },
    { type: 'mrkdwn', text: `*Project*\n${finding.project_name}` },
    { type: 'mrkdwn', text: `*Deadline*\n${dl || 'none stated'}` }
  ];
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: truncate(`${EMOJI[finding.severity] || ''} ${finding.title}`, 148), emoji: true } },
    { type: 'section', fields },
    ...(finding.summary ? [{ type: 'section', text: { type: 'mrkdwn', text: truncate(finding.summary, 2900) } }] : []),
    ...(files.length
      ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Affects ${finding.matched_files} file${finding.matched_files === 1 ? '' : 's'} in your code:*\n` + files.slice(0, 6).map((f) => `• \`${f.file}${f.lines?.length ? ':' + f.lines.slice(0, 3).join(',') : ''}\``).join('\n') } }]
      : [{ type: 'context', elements: [{ type: 'mrkdwn', text: '_No direct code match — flagged because this vendor is in your stack._' }] }]),
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open finding' }, url: findingUrl(finding) },
        ...(finding.url ? [{ type: 'button', text: { type: 'plain_text', text: 'Vendor announcement' }, url: finding.url }] : [])
      ]
    }
  ];
  return { text: `[${finding.severity}] ${finding.vendor_name}: ${truncate(finding.title, 200)}`, blocks };
}

export function webhookPayload(finding) {
  return {
    event: 'finding.created',
    id: finding.id,
    severity: finding.severity,
    score: finding.score,
    status: finding.status,
    vendor: { slug: finding.vendor_slug, name: finding.vendor_name },
    project: { id: finding.project_id, name: finding.project_name },
    title: finding.title,
    summary: finding.summary,
    announcement_url: finding.url,
    published_at: finding.published_at,
    deadline_at: finding.deadline_at,
    days_until_deadline: daysUntil(finding.deadline_at),
    matched_files: finding.matched_files,
    impact: finding.impact,
    url: findingUrl(finding),
    created_at: finding.created_at
  };
}

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const truncate = (s = '', n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const SEV_COLOR = { critical: '#b42318', high: '#b54708', medium: '#a15c07', low: '#175cd3', info: '#475467' };

export function emailHtml(findings, { title = 'Sunset Radar alert', intro = '' } = {}) {
  const rows = findings.map((f) => {
    const dl = deadlineLabel(f.deadline_at);
    const files = (f.impact?.files || []).slice(0, 5);
    return `
    <tr><td style="padding:0 0 18px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e7ec;border-radius:10px;border-left:4px solid ${SEV_COLOR[f.severity] || '#475467'}">
        <tr><td style="padding:16px 18px">
          <div style="font:600 11px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${SEV_COLOR[f.severity] || '#475467'}">${esc(f.severity)} · ${esc(f.vendor_name)}</div>
          <div style="font:600 16px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#101828;margin:6px 0 8px"><a href="${esc(findingUrl(f))}" style="color:#101828;text-decoration:none">${esc(truncate(f.title, 140))}</a></div>
          ${f.summary ? `<div style="font:400 14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#475467;margin-bottom:10px">${esc(truncate(f.summary, 320))}</div>` : ''}
          ${dl ? `<div style="font:600 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#b42318;margin-bottom:8px">Deadline: ${esc(dl)}</div>` : ''}
          ${files.length
            ? `<div style="font:400 13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#344054;background:#f9fafb;border-radius:6px;padding:10px 12px">${files.map((x) => esc(x.file) + (x.lines?.length ? ':' + x.lines.slice(0, 3).join(',') : '')).join('<br>')}</div>`
            : `<div style="font:400 13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#667085">No direct code match — flagged because this vendor is in your stack.</div>`}
          <div style="margin-top:12px"><a href="${esc(findingUrl(f))}" style="font:600 13px/1 -apple-system,Segoe UI,Roboto,sans-serif;color:#175cd3;text-decoration:none">Open finding →</a></div>
        </td></tr>
      </table>
    </td></tr>`;
  }).join('');

  return `<!doctype html><html><body style="margin:0;background:#f2f4f7;padding:28px 12px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px">
      <tr><td style="padding-bottom:18px;font:700 18px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;color:#101828">${esc(title)}</td></tr>
      ${intro ? `<tr><td style="padding-bottom:16px;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#475467">${esc(intro)}</td></tr>` : ''}
      ${rows}
      <tr><td style="padding-top:8px;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#98a2b3">
        Sent by Sunset Radar · <a href="${esc(config.baseUrl)}/settings" style="color:#98a2b3">alert settings</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function emailSubject(findings) {
  if (findings.length === 1) {
    const f = findings[0];
    return `[${f.severity}] ${f.vendor_name}: ${truncate(f.title, 90)}`;
  }
  const worst = findings[0]?.severity || 'info';
  return `Sunset Radar: ${findings.length} changes need attention (worst: ${worst})`;
}
