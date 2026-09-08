// Optional LLM enrichment. The product is fully functional without it — the
// heuristics decide what matters — but a key buys sharper summaries and a
// second opinion on severity for the handful of items that scored high.
import { config } from '../config.js';
import { log } from '../log.js';

const SYSTEM = `You triage third-party API change announcements for engineering teams.
You are given one announcement and the list of ways the reader's codebase touches that vendor.
Reply with JSON only, no prose, matching exactly:
{"breaking": true|false, "severity": "critical"|"high"|"medium"|"low"|"info",
 "summary": "<=240 chars, plain, what changes and what the reader must do",
 "action": "<=200 chars, the concrete migration step, or empty string",
 "deadline": "YYYY-MM-DD" or null,
 "affected": ["identifier", ...]}
Rules: breaking=true only if existing working code stops working or requires changes.
severity=critical only if the reader's listed usage is directly hit and the deadline is near or past.
Marketing, new optional features, and pure bug fixes are info. Never invent a deadline that is not stated.`;

export function llmEnabled() {
  return Boolean(config.llm.enabled && config.llm.apiKey);
}

export async function enrichItem(item, { usage = [], timeoutMs = 20000 } = {}) {
  if (!llmEnabled()) return null;
  const usageLines = usage.slice(0, 25).map((u) => `- ${u.kind}: ${u.value} (${u.file}${u.line ? ':' + u.line : ''})`).join('\n') || '- (no detected usage detail)';
  const prompt = [
    `VENDOR: ${item.vendorName || 'unknown'}`,
    `TITLE: ${item.title}`,
    `PUBLISHED: ${item.publishedAt || 'unknown'}`,
    `ANNOUNCEMENT:\n${(item.body || '').slice(0, 6000)}`,
    `\nHOW THIS CODEBASE USES THE VENDOR:\n${usageLines}`
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.llm.baseUrl}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.llm.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.llm.model,
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      log.warn('llm request failed', { status: res.status });
      return null;
    }
    const json = await res.json();
    const text = (json.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return parseVerdict(text);
  } catch (err) {
    log.warn('llm enrichment error', { error: err.message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function parseVerdict(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let parsed;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const severities = ['critical', 'high', 'medium', 'low', 'info'];
  return {
    breaking: Boolean(parsed.breaking),
    severity: severities.includes(parsed.severity) ? parsed.severity : null,
    summary: String(parsed.summary || '').slice(0, 400),
    action: String(parsed.action || '').slice(0, 300),
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline || '') ? `${parsed.deadline}T00:00:00.000Z` : null,
    affected: Array.isArray(parsed.affected) ? parsed.affected.slice(0, 20).map(String) : []
  };
}

// Without a key we still want a one-line human summary. This picks the most
// informative sentence rather than just truncating.
export function heuristicSummary(item, signals = []) {
  const body = (item.body || '').replace(/\s+/g, ' ').trim();
  if (!body) return item.title;
  const sentences = body.split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
  const keywords = /\b(deprecat|remov|breaking|must|require|migrat|sunset|end of life|no longer|effective|will be|upgrade)\b/i;
  const best = sentences.find((s) => keywords.test(s)) || sentences[0] || body;
  return best.slice(0, 280).trim();
}
