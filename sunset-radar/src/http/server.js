// The HTTP layer. node:http directly — no framework, no middleware stack, no
// supply chain. Handlers get one context object and return by calling helpers.
import http from 'node:http';
import { URL } from 'node:url';
import { config } from '../config.js';
import { log } from '../log.js';
import { Router } from './router.js';
import { accountForSession, accountForApiKey, getAccountByEmail } from '../store/accounts.js';
import { rateLimit } from './ratelimit.js';

export const router = new Router();

const MAX_BODY = 1024 * 512;

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseBody(raw, contentType = '') {
  const text = raw.toString('utf8');
  if (!text) return {};
  if (contentType.includes('application/json')) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return { _raw: text };
}

export function createContext(req, res, url, body, rawBody) {
  const cookies = parseCookies(req.headers.cookie || '');
  const ctx = {
    req, res, url, body, rawBody, cookies,
    params: {},
    query: Object.fromEntries(url.searchParams),
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '',
    account: null,
    auth: null,

    json(data, status = 200, headers = {}) {
      const payload = JSON.stringify(data, null, 2);
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), ...headers });
      res.end(payload);
    },
    html(markup, status = 200, headers = {}) {
      res.writeHead(status, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; form-action 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'same-origin',
        ...headers
      });
      res.end(markup);
    },
    text(body2, status = 200, headers = {}) {
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers });
      res.end(body2);
    },
    redirect(location, status = 302, headers = {}) {
      res.writeHead(status, { location, ...headers });
      res.end();
    },
    setCookie(name, value, { maxAge = 2592000, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
      const secure = config.baseUrl.startsWith('https');
      const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, `SameSite=${sameSite}`];
      if (httpOnly) parts.push('HttpOnly');
      if (secure) parts.push('Secure');
      const prev = res.getHeader('set-cookie');
      res.setHeader('set-cookie', prev ? [].concat(prev, parts.join('; ')) : parts.join('; '));
    },
    clearCookie(name) { ctx.setCookie(name, '', { maxAge: 0 }); },
    error(message, status = 400) { ctx.json({ error: message }, status); }
  };
  return ctx;
}

/** Resolve the caller: API key beats session cookie. */
function authenticate(ctx) {
  const header = ctx.req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const account = accountForApiKey(header.slice(7).trim());
    if (account) { ctx.account = account; ctx.auth = 'api_key'; return; }
  }
  const sessionToken = ctx.cookies.sr_session;
  if (sessionToken) {
    const account = accountForSession(sessionToken);
    if (account) { ctx.account = account; ctx.auth = 'session'; return; }
  }
  // Self-hosted single-tenant: the owner is whoever reaches the box.
  if (config.singleTenant) {
    const owner = getAccountByEmail(process.env.OWNER_EMAIL || 'owner@localhost');
    if (owner) { ctx.account = owner; ctx.auth = 'single_tenant'; }
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const started = Date.now();
    let url;
    try {
      url = new URL(req.url, config.baseUrl);
    } catch {
      res.writeHead(400); res.end('bad request'); return;
    }

    let ctx;
    try {
      const raw = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readBody(req);
      ctx = createContext(req, res, url, parseBody(raw, req.headers['content-type'] || ''), raw);
    } catch (err) {
      res.writeHead(413, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }

    const hit = router.match(req.method, url.pathname);
    try {
      if (!hit) { notFound(ctx); return; }
      if (hit.methodNotAllowed) { ctx.json({ error: 'method not allowed' }, 405); return; }

      ctx.params = hit.params;
      authenticate(ctx);

      const limit = rateLimit(ctx, hit.route);
      if (!limit.ok) { ctx.json({ error: 'rate limit exceeded', retry_after: limit.retryAfter }, 429, { 'retry-after': String(limit.retryAfter) }); return; }

      if (hit.route.auth && !ctx.account) {
        if (hit.route.api) ctx.json({ error: 'unauthorized' }, 401);
        else ctx.redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
        return;
      }

      await hit.route.handler(ctx);
    } catch (err) {
      log.error('request failed', { path: url.pathname, error: err.message, stack: (err.stack || '').split('\n')[1]?.trim() });
      if (!res.headersSent) {
        if (hit?.route?.api) ctx.json({ error: 'internal error' }, 500);
        else ctx.html('<h1>Something went wrong</h1><p>The error has been logged.</p>', 500);
      }
    } finally {
      log.debug('request', { method: req.method, path: url.pathname, status: res.statusCode, ms: Date.now() - started });
    }
  });
}

function notFound(ctx) {
  if (ctx.url.pathname.startsWith('/api/')) ctx.json({ error: 'not found' }, 404);
  else ctx.html('<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font:16px system-ui;padding:60px;text-align:center"><h1>404</h1><p>Nothing here. <a href="/">Go home</a>.</p>', 404);
}
