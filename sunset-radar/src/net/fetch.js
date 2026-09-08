// Outbound HTTP with the manners a polite crawler needs: conditional GETs,
// a byte cap, timeouts, bounded retries, and a stable user agent.
import { config } from '../config.js';
import { log } from '../log.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @returns {Promise<{ok:boolean, status:number, notModified:boolean, body:string,
 *   etag:string|null, lastModified:string|null, contentType:string, url:string, error:string|null}>}
 */
export async function fetchUrl(url, { etag, lastModified, timeoutMs, retries, headers = {} } = {}) {
  if (config.http.offline) {
    return { ok: false, status: 0, notModified: false, body: '', etag: null, lastModified: null, contentType: '', url, error: 'offline mode' };
  }
  const limit = timeoutMs ?? config.http.timeoutMs;
  const maxRetries = retries ?? config.http.retries;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limit);
    try {
      const h = {
        'user-agent': config.http.userAgent,
        accept: 'application/atom+xml, application/rss+xml, application/json;q=0.9, text/html;q=0.8, */*;q=0.5',
        'accept-encoding': 'gzip, deflate',
        ...headers
      };
      if (etag) h['if-none-match'] = etag;
      if (lastModified) h['if-modified-since'] = lastModified;

      const res = await fetch(url, { signal: controller.signal, headers: h, redirect: 'follow' });
      if (res.status === 304) {
        return { ok: true, status: 304, notModified: true, body: '', etag: etag ?? null, lastModified: lastModified ?? null, contentType: '', url, error: null };
      }
      const contentType = res.headers.get('content-type') || '';
      const body = await readCapped(res, config.http.maxBytes);
      const result = {
        ok: res.ok,
        status: res.status,
        notModified: false,
        body,
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
        contentType,
        url: res.url || url,
        error: res.ok ? null : `HTTP ${res.status}`
      };
      // 5xx and 429 are worth another go; 4xx are not.
      if (!res.ok && (res.status >= 500 || res.status === 429) && attempt < maxRetries) {
        lastError = result.error;
        continue;
      }
      return result;
    } catch (err) {
      lastError = err.name === 'AbortError' ? `timeout after ${limit}ms` : err.message;
      log.debug('fetch failed', { url, attempt, error: lastError });
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, notModified: false, body: '', etag: null, lastModified: null, contentType: '', url, error: lastError || 'unknown error' };
}

async function readCapped(res, maxBytes) {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    chunks.push(value);
    if (total >= maxBytes) { try { await reader.cancel(); } catch { /* already done */ } break; }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}
